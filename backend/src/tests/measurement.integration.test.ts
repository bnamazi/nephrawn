import { describe, it, expect, beforeEach, afterAll, afterEach } from "vitest";
import request from "supertest";
import {
  testApp,
  prisma,
  createTestPatient,
  createTestClinician,
  getPatientToken,
  cleanupTestData,
  disconnectPrisma,
} from "./setup.js";

describe("Measurement Integration Tests", () => {
  let patientId: string;
  let patientToken: string;
  let clinicianId: string;

  beforeEach(async () => {
    await cleanupTestData();

    // Create test patient and clinician
    const patient = await createTestPatient();
    patientId = patient.id;
    patientToken = getPatientToken(patient.id);

    const clinician = await createTestClinician();
    clinicianId = clinician.id;

    // Create enrollment so clinician can see patient's alerts
    await prisma.enrollment.create({
      data: {
        patientId: patient.id,
        clinicianId: clinician.id,
      },
    });
  });

  afterAll(async () => {
    await cleanupTestData();
    await disconnectPrisma();
  });

  describe("Weight Measurements", () => {
    it("creates a weight measurement in lbs (converts to kg)", async () => {
      const response = await request(testApp)
        .post("/patient/measurements")
        .set("Authorization", `Bearer ${patientToken}`)
        .send({
          type: "WEIGHT",
          value: 150,
          unit: "lbs",
        });

      expect(response.status).toBe(201);
      expect(response.body.measurement).toBeDefined();
      expect(response.body.measurement.type).toBe("WEIGHT");
      expect(response.body.measurement.unit).toBe("kg");
      // 150 lbs ≈ 68.04 kg
      expect(response.body.measurement.value).toBeCloseTo(68.04, 1);
      expect(response.body.convertedFrom).toBe("lbs");
    });

    it("creates a weight measurement in kg", async () => {
      const response = await request(testApp)
        .post("/patient/measurements")
        .set("Authorization", `Bearer ${patientToken}`)
        .send({
          type: "WEIGHT",
          value: 70,
          unit: "kg",
        });

      expect(response.status).toBe(201);
      // Prisma Decimal values are serialized as strings
      expect(response.body.measurement.value).toBe("70");
      expect(response.body.measurement.unit).toBe("kg");
    });

    it("detects duplicate measurements within 5 minutes", async () => {
      // First measurement
      await request(testApp)
        .post("/patient/measurements")
        .set("Authorization", `Bearer ${patientToken}`)
        .send({
          type: "WEIGHT",
          value: 150,
          unit: "lbs",
        });

      // Same measurement again
      const response = await request(testApp)
        .post("/patient/measurements")
        .set("Authorization", `Bearer ${patientToken}`)
        .send({
          type: "WEIGHT",
          value: 150,
          unit: "lbs",
        });

      expect(response.status).toBe(200); // Not 201 - duplicate detected
      expect(response.body.isDuplicate).toBe(true);
    });

    it("rejects weight outside valid range", async () => {
      const response = await request(testApp)
        .post("/patient/measurements")
        .set("Authorization", `Bearer ${patientToken}`)
        .send({
          type: "WEIGHT",
          value: 1000, // Way too high
          unit: "kg",
        });

      expect(response.status).toBe(400);
    });
  });

  describe("Blood Pressure Measurements", () => {
    it("creates blood pressure measurements as a pair", async () => {
      const response = await request(testApp)
        .post("/patient/measurements/blood-pressure")
        .set("Authorization", `Bearer ${patientToken}`)
        .send({
          systolic: 120,
          diastolic: 80,
        });

      expect(response.status).toBe(201);
      expect(response.body.measurements).toBeDefined();
      expect(response.body.measurements.systolic).toBeDefined();
      expect(response.body.measurements.diastolic).toBeDefined();
      expect(response.body.measurements.systolic.value).toBe("120");
      expect(response.body.measurements.diastolic.value).toBe("80");
    });

    it("rejects invalid BP values", async () => {
      const response = await request(testApp)
        .post("/patient/measurements/blood-pressure")
        .set("Authorization", `Bearer ${patientToken}`)
        .send({
          systolic: 350, // Too high
          diastolic: 80,
        });

      expect(response.status).toBe(400);
    });

    it("triggers alert for hypertensive crisis", async () => {
      const response = await request(testApp)
        .post("/patient/measurements/blood-pressure")
        .set("Authorization", `Bearer ${patientToken}`)
        .send({
          systolic: 185, // Crisis level
          diastolic: 100,
        });

      expect(response.status).toBe(201);

      // Check that an alert was created
      const alerts = await prisma.alert.findMany({
        where: { patientId },
      });

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts.some((a) => a.ruleId === "bp_systolic_high")).toBe(true);
    });
  });

  describe("Weight Gain Alert Flow", () => {
    it("triggers alert for rapid weight gain (>3 lbs in 48h)", async () => {
      // Create baseline weight from 24 hours ago (safely within 48h window)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      await prisma.measurement.create({
        data: {
          patientId,
          type: "WEIGHT",
          value: 70, // 70 kg baseline
          unit: "kg",
          timestamp: oneDayAgo,
          source: "manual",
        },
      });

      // Add current weight with gain (~4 lbs = ~1.8 kg, above 1.36kg threshold but below 2.27kg critical)
      const response = await request(testApp)
        .post("/patient/measurements")
        .set("Authorization", `Bearer ${patientToken}`)
        .send({
          type: "WEIGHT",
          value: 71.8, // +1.8 kg gain (triggers WARNING, not CRITICAL)
          unit: "kg",
        });

      expect(response.status).toBe(201);

      // Check for alert
      const alerts = await prisma.alert.findMany({
        where: {
          patientId,
          ruleId: "weight_gain_48h",
        },
      });

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].severity).toBe("WARNING");
    });
  });

  describe("Measurement History", () => {
    it("retrieves measurement history for a type", async () => {
      // Create some measurements
      await prisma.measurement.createMany({
        data: [
          {
            patientId,
            type: "WEIGHT",
            value: 70,
            unit: "kg",
            timestamp: new Date(),
            source: "manual",
          },
          {
            patientId,
            type: "WEIGHT",
            value: 71,
            unit: "kg",
            timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
            source: "manual",
          },
        ],
      });

      const response = await request(testApp)
        .get("/patient/measurements?type=WEIGHT")
        .set("Authorization", `Bearer ${patientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.measurements).toHaveLength(2);
      expect(response.body.measurements[0].type).toBe("WEIGHT");
    });
  });

  describe("Dashboard Data", () => {
    it("returns dashboard with latest measurements and trends", async () => {
      // Create measurements for trends
      const now = new Date();
      const measurements = [];

      for (let i = 0; i < 5; i++) {
        const timestamp = new Date(now.getTime() - i * 12 * 60 * 60 * 1000); // Every 12 hours
        measurements.push({
          patientId,
          type: "WEIGHT" as const,
          value: 70 + i * 0.2, // Slight increase
          unit: "kg",
          timestamp,
          source: "manual",
        });
      }

      await prisma.measurement.createMany({ data: measurements });

      const response = await request(testApp)
        .get("/patient/dashboard")
        .set("Authorization", `Bearer ${patientToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("dashboard");
      expect(response.body.dashboard).toHaveProperty("weight");
      expect(response.body.dashboard).toHaveProperty("bloodPressure");
      expect(response.body.dashboard).toHaveProperty("meta");
    });
  });
});
