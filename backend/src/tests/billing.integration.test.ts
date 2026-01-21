import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import {
  testApp,
  prisma,
  createTestPatient,
  createTestClinician,
  createTestClinic,
  createClinicMembership,
  getClinicianToken,
  cleanupTestData,
  disconnectPrisma,
} from "./setup.js";

describe("Billing Integration Tests", () => {
  let patientId: string;
  let clinicianId: string;
  let clinicId: string;
  let clinicianToken: string;

  beforeEach(async () => {
    await cleanupTestData();

    // Create test clinic, patient and clinician
    const clinic = await createTestClinic();
    clinicId = clinic.id;

    const patient = await createTestPatient();
    patientId = patient.id;

    const clinician = await createTestClinician();
    clinicianId = clinician.id;
    clinicianToken = getClinicianToken(clinician.id);

    // Create clinic membership as OWNER
    await createClinicMembership(clinic.id, clinician.id, "OWNER");

    // Create enrollment
    await prisma.enrollment.create({
      data: {
        patientId: patient.id,
        clinicianId: clinician.id,
        clinicId: clinic.id,
      },
    });
  });

  afterAll(async () => {
    await cleanupTestData();
    await disconnectPrisma();
  });

  describe("Device Transmission Days", () => {
    it("counts distinct days with device measurements", async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Create device measurements on different days
      for (let day = 1; day <= 18; day++) {
        const date = new Date(startOfMonth);
        date.setDate(day);
        date.setHours(10, 0, 0, 0);

        await prisma.measurement.create({
          data: {
            patientId,
            type: "WEIGHT",
            value: 70 + day * 0.1,
            unit: "kg",
            timestamp: date,
            source: "withings",
          },
        });
      }

      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/billing-summary`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.summary.deviceTransmission.totalDays).toBe(18);
      expect(response.body.summary.deviceTransmission.eligible99454).toBe(true);
    });

    it("does not count manual measurements toward device days", async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Create manual measurements on 20 days
      for (let day = 1; day <= 20; day++) {
        const date = new Date(startOfMonth);
        date.setDate(day);

        await prisma.measurement.create({
          data: {
            patientId,
            type: "WEIGHT",
            value: 70,
            unit: "kg",
            timestamp: date,
            source: "manual",
          },
        });
      }

      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/billing-summary`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.summary.deviceTransmission.totalDays).toBe(0);
      expect(response.body.summary.deviceTransmission.eligible99454).toBe(false);
    });

    it("counts multiple measurements on same day as one day", async () => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Create multiple measurements on same day
      for (let i = 0; i < 5; i++) {
        const timestamp = new Date(today);
        timestamp.setHours(8 + i, 0, 0, 0);

        await prisma.measurement.create({
          data: {
            patientId,
            type: "WEIGHT",
            value: 70,
            unit: "kg",
            timestamp,
            source: "withings",
          },
        });
      }

      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/billing-summary`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.summary.deviceTransmission.totalDays).toBe(1);
    });

    it("patient with 15 device days is not eligible for 99454", async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Create device measurements on 15 days (below threshold)
      for (let day = 1; day <= 15; day++) {
        const date = new Date(startOfMonth);
        date.setDate(day);

        await prisma.measurement.create({
          data: {
            patientId,
            type: "WEIGHT",
            value: 70,
            unit: "kg",
            timestamp: date,
            source: "withings",
          },
        });
      }

      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/billing-summary`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.summary.deviceTransmission.totalDays).toBe(15);
      expect(response.body.summary.deviceTransmission.eligible99454).toBe(false);
      expect(response.body.summary.eligibleCodes).not.toContain("99454");
    });
  });

  describe("Time Entry Aggregation", () => {
    it("aggregates time entries and determines 99457 eligibility", async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Create time entries totaling 25 minutes
      await prisma.timeEntry.create({
        data: {
          patientId,
          clinicianId,
          clinicId,
          entryDate: today,
          durationMinutes: 15,
          activity: "PATIENT_REVIEW",
        },
      });

      await prisma.timeEntry.create({
        data: {
          patientId,
          clinicianId,
          clinicId,
          entryDate: today,
          durationMinutes: 10,
          activity: "CARE_PLAN_UPDATE",
        },
      });

      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/billing-summary`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.summary.time.totalMinutes).toBe(25);
      expect(response.body.summary.time.rpmMinutes).toBe(25);
      expect(response.body.summary.time.eligible99457).toBe(true);
      expect(response.body.summary.eligibleCodes).toContain("99457");
    });

    it("calculates 99458 blocks for additional 20-minute increments", async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Create time entries totaling 65 minutes (20 + 20 + 20 + 5)
      await prisma.timeEntry.create({
        data: {
          patientId,
          clinicianId,
          clinicId,
          entryDate: today,
          durationMinutes: 65,
          activity: "PATIENT_REVIEW",
        },
      });

      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/billing-summary`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.summary.time.totalMinutes).toBe(65);
      expect(response.body.summary.time.eligible99457).toBe(true);
      expect(response.body.summary.time.eligible99458Count).toBe(2); // (65-20)/20 = 2 complete blocks
      expect(response.body.summary.eligibleCodes).toContain("99457");
      expect(response.body.summary.eligibleCodes.filter((c: string) => c === "99458")).toHaveLength(2);
    });

    it("counts only CCM activities toward 99490", async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Create CCM activities totaling 25 minutes
      await prisma.timeEntry.create({
        data: {
          patientId,
          clinicianId,
          clinicId,
          entryDate: today,
          durationMinutes: 10,
          activity: "CARE_PLAN_UPDATE", // CCM
        },
      });

      await prisma.timeEntry.create({
        data: {
          patientId,
          clinicianId,
          clinicId,
          entryDate: today,
          durationMinutes: 15,
          activity: "COORDINATION", // CCM
        },
      });

      // Non-CCM activity
      await prisma.timeEntry.create({
        data: {
          patientId,
          clinicianId,
          clinicId,
          entryDate: today,
          durationMinutes: 30,
          activity: "PATIENT_REVIEW", // Not CCM
        },
      });

      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/billing-summary`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.summary.time.totalMinutes).toBe(55);
      expect(response.body.summary.time.rpmMinutes).toBe(55);
      expect(response.body.summary.time.ccmMinutes).toBe(25);
      expect(response.body.summary.time.eligible99490).toBe(true);
      expect(response.body.summary.eligibleCodes).toContain("99490");
    });

    it("19 minutes is not eligible for 99457", async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await prisma.timeEntry.create({
        data: {
          patientId,
          clinicianId,
          clinicId,
          entryDate: today,
          durationMinutes: 19,
          activity: "PATIENT_REVIEW",
        },
      });

      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/billing-summary`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.summary.time.totalMinutes).toBe(19);
      expect(response.body.summary.time.eligible99457).toBe(false);
      expect(response.body.summary.eligibleCodes).not.toContain("99457");
    });
  });

  describe("Authorization", () => {
    it("returns 404 for unenrolled patient", async () => {
      const otherPatient = await createTestPatient({
        email: "other@example.com",
      });

      const response = await request(testApp)
        .get(`/clinician/patients/${otherPatient.id}/billing-summary`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Patient not found or not enrolled");
    });

    it("returns 403 for non-admin clinic report access", async () => {
      // Create another clinician with CLINICIAN role (not OWNER/ADMIN)
      const otherClinician = await createTestClinician({
        email: "other.clinician@example.com",
      });
      await createClinicMembership(clinicId, otherClinician.id, "CLINICIAN");
      const otherToken = getClinicianToken(otherClinician.id);

      const response = await request(testApp)
        .get(`/clinician/clinics/${clinicId}/billing-report`)
        .set("Authorization", `Bearer ${otherToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain("requires OWNER or ADMIN role");
    });

    it("allows OWNER to access clinic billing report", async () => {
      const response = await request(testApp)
        .get(`/clinician/clinics/${clinicId}/billing-report`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.report).toBeDefined();
      expect(response.body.report.clinicId).toBe(clinicId);
    });

    it("allows ADMIN to access clinic billing report", async () => {
      const adminClinician = await createTestClinician({
        email: "admin@example.com",
      });
      await createClinicMembership(clinicId, adminClinician.id, "ADMIN");
      const adminToken = getClinicianToken(adminClinician.id);

      const response = await request(testApp)
        .get(`/clinician/clinics/${clinicId}/billing-report`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.report).toBeDefined();
    });
  });

  describe("Clinic Billing Report", () => {
    it("aggregates billing data for all patients in clinic", async () => {
      // Create second patient
      const patient2 = await createTestPatient({
        email: "patient2@example.com",
      });
      await prisma.enrollment.create({
        data: {
          patientId: patient2.id,
          clinicianId,
          clinicId,
        },
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Add time entries for both patients
      await prisma.timeEntry.create({
        data: {
          patientId,
          clinicianId,
          clinicId,
          entryDate: today,
          durationMinutes: 25,
          activity: "PATIENT_REVIEW",
        },
      });

      await prisma.timeEntry.create({
        data: {
          patientId: patient2.id,
          clinicianId,
          clinicId,
          entryDate: today,
          durationMinutes: 30,
          activity: "CARE_PLAN_UPDATE",
        },
      });

      const response = await request(testApp)
        .get(`/clinician/clinics/${clinicId}/billing-report`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.report.summary.totalPatients).toBe(2);
      expect(response.body.report.summary.patientsWith99457).toBe(2);
      expect(response.body.report.summary.totalRpmMinutes).toBe(55);
      expect(response.body.report.patients).toHaveLength(2);
    });

    it("returns empty report for clinic with no patients", async () => {
      // Create new clinic with no enrollments
      const emptyClinic = await createTestClinic({ slug: "empty-clinic" });
      await createClinicMembership(emptyClinic.id, clinicianId, "OWNER");

      const response = await request(testApp)
        .get(`/clinician/clinics/${emptyClinic.id}/billing-report`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.report.summary.totalPatients).toBe(0);
      expect(response.body.report.patients).toHaveLength(0);
    });
  });

  describe("Date Range Filtering", () => {
    it("respects custom date range for billing summary", async () => {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      lastMonth.setDate(15);
      lastMonth.setHours(0, 0, 0, 0);

      // Create time entry in last month
      await prisma.timeEntry.create({
        data: {
          patientId,
          clinicianId,
          clinicId,
          entryDate: lastMonth,
          durationMinutes: 30,
          activity: "PATIENT_REVIEW",
        },
      });

      // Query for last month
      const fromDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
      const toDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);

      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/billing-summary`)
        .query({
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
        })
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.summary.time.totalMinutes).toBe(30);

      // Query for current month should return 0
      const currentResponse = await request(testApp)
        .get(`/clinician/patients/${patientId}/billing-summary`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(currentResponse.status).toBe(200);
      expect(currentResponse.body.summary.time.totalMinutes).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    it("returns zeros when no data exists", async () => {
      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/billing-summary`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.summary.deviceTransmission.totalDays).toBe(0);
      expect(response.body.summary.deviceTransmission.dates).toHaveLength(0);
      expect(response.body.summary.time.totalMinutes).toBe(0);
      expect(response.body.summary.eligibleCodes).toHaveLength(0);
    });

    it("aggregates time entries from multiple clinicians", async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Create second clinician and enroll them with the patient
      const clinician2 = await createTestClinician({
        email: "clinician2@example.com",
      });
      await createClinicMembership(clinicId, clinician2.id, "CLINICIAN");
      await prisma.enrollment.create({
        data: {
          patientId,
          clinicianId: clinician2.id,
          clinicId,
        },
      });

      // Both clinicians log time
      await prisma.timeEntry.create({
        data: {
          patientId,
          clinicianId,
          clinicId,
          entryDate: today,
          durationMinutes: 15,
          activity: "PATIENT_REVIEW",
        },
      });

      await prisma.timeEntry.create({
        data: {
          patientId,
          clinicianId: clinician2.id,
          clinicId,
          entryDate: today,
          durationMinutes: 10,
          activity: "COORDINATION",
        },
      });

      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/billing-summary`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      // Should aggregate time from both clinicians
      expect(response.body.summary.time.totalMinutes).toBe(25);
    });
  });
});
