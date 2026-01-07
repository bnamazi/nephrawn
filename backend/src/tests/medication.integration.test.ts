import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import {
  testApp,
  prisma,
  createTestPatient,
  createTestClinician,
  createTestClinic,
  createClinicMembership,
  getPatientToken,
  getClinicianToken,
  cleanupTestData,
  disconnectPrisma,
} from "./setup.js";

describe("Medication Integration Tests", () => {
  let patientId: string;
  let patientToken: string;
  let clinicianId: string;
  let clinicianToken: string;
  let clinicId: string;

  beforeEach(async () => {
    await cleanupTestData();

    // Create test entities
    const clinic = await createTestClinic();
    clinicId = clinic.id;

    const patient = await createTestPatient();
    patientId = patient.id;
    patientToken = getPatientToken(patient.id);

    const clinician = await createTestClinician();
    clinicianId = clinician.id;
    clinicianToken = getClinicianToken(clinician.id);

    // Create clinic membership
    await createClinicMembership(clinic.id, clinician.id);

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

  // ============================================
  // Patient Medication CRUD
  // ============================================

  describe("Patient Medication CRUD", () => {
    it("creates a medication", async () => {
      const response = await request(testApp)
        .post("/patient/medications")
        .set("Authorization", `Bearer ${patientToken}`)
        .send({
          name: "Lisinopril",
          dosage: "10mg",
          frequency: "Once daily",
          instructions: "Take in the morning with food",
        });

      expect(response.status).toBe(201);
      expect(response.body.medication).toBeDefined();
      expect(response.body.medication.name).toBe("Lisinopril");
      expect(response.body.medication.dosage).toBe("10mg");
      expect(response.body.medication.frequency).toBe("Once daily");
      expect(response.body.medication.isActive).toBe(true);
    });

    it("rejects medication with empty name", async () => {
      const response = await request(testApp)
        .post("/patient/medications")
        .set("Authorization", `Bearer ${patientToken}`)
        .send({
          name: "",
          dosage: "10mg",
        });

      expect(response.status).toBe(400);
    });

    it("lists patient medications", async () => {
      // Create some medications
      await prisma.medication.createMany({
        data: [
          { patientId, name: "Lisinopril", dosage: "10mg", isActive: true },
          { patientId, name: "Metformin", dosage: "500mg", isActive: true },
          { patientId, name: "Old Med", isActive: false },
        ],
      });

      const response = await request(testApp)
        .get("/patient/medications")
        .set("Authorization", `Bearer ${patientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.medications).toHaveLength(2); // Only active
      expect(response.body.medications[0].isActive).toBe(true);
    });

    it("lists all medications including inactive when requested", async () => {
      await prisma.medication.createMany({
        data: [
          { patientId, name: "Lisinopril", isActive: true },
          { patientId, name: "Old Med", isActive: false },
        ],
      });

      const response = await request(testApp)
        .get("/patient/medications?includeInactive=true")
        .set("Authorization", `Bearer ${patientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.medications).toHaveLength(2);
    });

    it("gets a single medication", async () => {
      const medication = await prisma.medication.create({
        data: { patientId, name: "Lisinopril", dosage: "10mg" },
      });

      const response = await request(testApp)
        .get(`/patient/medications/${medication.id}`)
        .set("Authorization", `Bearer ${patientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.medication.id).toBe(medication.id);
      expect(response.body.medication.name).toBe("Lisinopril");
    });

    it("returns 404 for non-existent medication", async () => {
      const response = await request(testApp)
        .get("/patient/medications/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${patientToken}`);

      expect(response.status).toBe(404);
    });

    it("updates a medication", async () => {
      const medication = await prisma.medication.create({
        data: { patientId, name: "Lisinopril", dosage: "10mg" },
      });

      const response = await request(testApp)
        .put(`/patient/medications/${medication.id}`)
        .set("Authorization", `Bearer ${patientToken}`)
        .send({
          dosage: "20mg",
          frequency: "Twice daily",
        });

      expect(response.status).toBe(200);
      expect(response.body.medication.dosage).toBe("20mg");
      expect(response.body.medication.frequency).toBe("Twice daily");
    });

    it("soft deletes a medication", async () => {
      const medication = await prisma.medication.create({
        data: { patientId, name: "Lisinopril" },
      });

      const response = await request(testApp)
        .delete(`/patient/medications/${medication.id}`)
        .set("Authorization", `Bearer ${patientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify soft delete
      const updated = await prisma.medication.findUnique({
        where: { id: medication.id },
      });
      expect(updated?.isActive).toBe(false);
    });

    it("prevents access to other patient's medication", async () => {
      // Create another patient's medication
      const otherPatient = await createTestPatient({ email: "other@example.com" });
      const medication = await prisma.medication.create({
        data: { patientId: otherPatient.id, name: "Other Med" },
      });

      const response = await request(testApp)
        .get(`/patient/medications/${medication.id}`)
        .set("Authorization", `Bearer ${patientToken}`);

      expect(response.status).toBe(404);
    });
  });

  // ============================================
  // Adherence Logging
  // ============================================

  describe("Adherence Logging", () => {
    let medicationId: string;

    beforeEach(async () => {
      const medication = await prisma.medication.create({
        data: { patientId, name: "Lisinopril", dosage: "10mg" },
      });
      medicationId = medication.id;
    });

    it("logs adherence (taken)", async () => {
      const response = await request(testApp)
        .post(`/patient/medications/${medicationId}/log`)
        .set("Authorization", `Bearer ${patientToken}`)
        .send({
          taken: true,
          notes: "Took with breakfast",
        });

      expect(response.status).toBe(201);
      expect(response.body.log).toBeDefined();
      expect(response.body.log.taken).toBe(true);
      expect(response.body.log.notes).toBe("Took with breakfast");
    });

    it("logs adherence (skipped)", async () => {
      const response = await request(testApp)
        .post(`/patient/medications/${medicationId}/log`)
        .set("Authorization", `Bearer ${patientToken}`)
        .send({
          taken: false,
          notes: "Ran out of medication",
        });

      expect(response.status).toBe(201);
      expect(response.body.log.taken).toBe(false);
    });

    it("retrieves adherence logs for a medication", async () => {
      // Create some logs
      await prisma.medicationLog.createMany({
        data: [
          { medicationId, taken: true },
          { medicationId, taken: true },
          { medicationId, taken: false, notes: "Missed dose" },
        ],
      });

      const response = await request(testApp)
        .get(`/patient/medications/${medicationId}/logs`)
        .set("Authorization", `Bearer ${patientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.logs).toHaveLength(3);
    });

    it("prevents logging adherence for other patient's medication", async () => {
      const otherPatient = await createTestPatient({ email: "other2@example.com" });
      const otherMed = await prisma.medication.create({
        data: { patientId: otherPatient.id, name: "Other Med" },
      });

      const response = await request(testApp)
        .post(`/patient/medications/${otherMed.id}/log`)
        .set("Authorization", `Bearer ${patientToken}`)
        .send({ taken: true });

      expect(response.status).toBe(404);
    });
  });

  // ============================================
  // Adherence Summary
  // ============================================

  describe("Adherence Summary", () => {
    it("calculates adherence summary", async () => {
      const med1 = await prisma.medication.create({
        data: { patientId, name: "Lisinopril" },
      });
      const med2 = await prisma.medication.create({
        data: { patientId, name: "Metformin" },
      });

      // Create logs (8 taken, 2 skipped = 80% adherence)
      await prisma.medicationLog.createMany({
        data: [
          { medicationId: med1.id, taken: true },
          { medicationId: med1.id, taken: true },
          { medicationId: med1.id, taken: true },
          { medicationId: med1.id, taken: false },
          { medicationId: med2.id, taken: true },
          { medicationId: med2.id, taken: true },
          { medicationId: med2.id, taken: true },
          { medicationId: med2.id, taken: true },
          { medicationId: med2.id, taken: true },
          { medicationId: med2.id, taken: false },
        ],
      });

      const response = await request(testApp)
        .get("/patient/medications/summary")
        .set("Authorization", `Bearer ${patientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.summary).toBeDefined();
      expect(response.body.summary.totalMedications).toBe(2);
      expect(response.body.summary.totalLogs).toBe(10);
      expect(response.body.summary.takenCount).toBe(8);
      expect(response.body.summary.skippedCount).toBe(2);
      expect(response.body.summary.adherenceRate).toBeCloseTo(0.8);
    });

    it("returns empty summary when no medications", async () => {
      const response = await request(testApp)
        .get("/patient/medications/summary")
        .set("Authorization", `Bearer ${patientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.summary.totalMedications).toBe(0);
      expect(response.body.summary.totalLogs).toBe(0);
      expect(response.body.summary.adherenceRate).toBe(0);
    });
  });

  // ============================================
  // Clinician View
  // ============================================

  describe("Clinician Medication View", () => {
    it("clinician can view enrolled patient's medications", async () => {
      await prisma.medication.createMany({
        data: [
          { patientId, name: "Lisinopril", dosage: "10mg" },
          { patientId, name: "Metformin", dosage: "500mg" },
        ],
      });

      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/medications`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.medications).toHaveLength(2);
    });

    it("clinician cannot view unenrolled patient's medications", async () => {
      const otherPatient = await createTestPatient({ email: "unenrolled@example.com" });

      const response = await request(testApp)
        .get(`/clinician/patients/${otherPatient.id}/medications`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(404);
    });

    it("clinician can view patient's adherence summary", async () => {
      const med = await prisma.medication.create({
        data: { patientId, name: "Lisinopril" },
      });

      await prisma.medicationLog.createMany({
        data: [
          { medicationId: med.id, taken: true },
          { medicationId: med.id, taken: true },
          { medicationId: med.id, taken: false },
        ],
      });

      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/medications/summary`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.summary).toBeDefined();
      expect(response.body.summary.adherenceRate).toBeCloseTo(0.667, 2);
    });

    it("clinician medication view creates interaction log", async () => {
      await prisma.medication.create({
        data: { patientId, name: "Lisinopril" },
      });

      await request(testApp)
        .get(`/clinician/patients/${patientId}/medications`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      const logs = await prisma.interactionLog.findMany({
        where: {
          patientId,
          clinicianId,
          interactionType: "CLINICIAN_MEDICATION_VIEW",
        },
      });

      expect(logs.length).toBe(1);
    });
  });

  // ============================================
  // Interaction Logging
  // ============================================

  describe("Interaction Logging", () => {
    it("logs PATIENT_MEDICATION on create", async () => {
      await request(testApp)
        .post("/patient/medications")
        .set("Authorization", `Bearer ${patientToken}`)
        .send({ name: "Lisinopril" });

      const logs = await prisma.interactionLog.findMany({
        where: {
          patientId,
          interactionType: "PATIENT_MEDICATION",
        },
      });

      expect(logs.length).toBe(1);
    });

    it("logs PATIENT_ADHERENCE_LOG on adherence log", async () => {
      const med = await prisma.medication.create({
        data: { patientId, name: "Lisinopril" },
      });

      await request(testApp)
        .post(`/patient/medications/${med.id}/log`)
        .set("Authorization", `Bearer ${patientToken}`)
        .send({ taken: true });

      const logs = await prisma.interactionLog.findMany({
        where: {
          patientId,
          interactionType: "PATIENT_ADHERENCE_LOG",
        },
      });

      expect(logs.length).toBe(1);
    });
  });
});
