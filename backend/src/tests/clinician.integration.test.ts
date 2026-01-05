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

describe("Clinician Workflow Integration Tests", () => {
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

  describe("Patient List", () => {
    it("returns enrolled patients for clinician", async () => {
      const response = await request(testApp)
        .get("/clinician/patients")
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.patients).toHaveLength(1);
      expect(response.body.patients[0].id).toBe(patientId);
    });

    it("returns empty list for clinician with no enrollments", async () => {
      // Create another clinician with no enrollments
      const otherClinician = await createTestClinician({
        email: "other.clinician@example.com",
      });
      const otherToken = getClinicianToken(otherClinician.id);

      const response = await request(testApp)
        .get("/clinician/patients")
        .set("Authorization", `Bearer ${otherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.patients).toHaveLength(0);
    });
  });

  describe("Patient Details", () => {
    it("returns patient details for enrolled patient", async () => {
      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.patient.id).toBe(patientId);
    });

    it("returns 404 for non-enrolled patient", async () => {
      // Create another patient not enrolled with this clinician
      const otherPatient = await createTestPatient({
        email: "other.patient@example.com",
      });

      const response = await request(testApp)
        .get(`/clinician/patients/${otherPatient.id}`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe("Alert Workflow", () => {
    let alertId: string;

    beforeEach(async () => {
      // Create a test alert
      const alert = await prisma.alert.create({
        data: {
          patientId,
          triggeredAt: new Date(),
          ruleId: "weight_gain_48h",
          ruleName: "Weight Gain 48h",
          severity: "WARNING",
          status: "OPEN",
          inputs: { delta: 2.0 },
        },
      });
      alertId = alert.id;
    });

    it("lists open alerts for clinician's patients", async () => {
      const response = await request(testApp)
        .get("/clinician/alerts")
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.alerts).toHaveLength(1);
      expect(response.body.alerts[0].id).toBe(alertId);
      expect(response.body.alerts[0].status).toBe("OPEN");
    });

    it("acknowledges an alert", async () => {
      const response = await request(testApp)
        .post(`/clinician/alerts/${alertId}/acknowledge`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Alert acknowledged");

      // Verify the alert was actually updated in the database
      const alert = await prisma.alert.findUnique({ where: { id: alertId } });
      expect(alert?.status).toBe("ACKNOWLEDGED");
      expect(alert?.acknowledgedBy).toBe(clinicianId);
    });

    it("dismisses an alert", async () => {
      const response = await request(testApp)
        .post(`/clinician/alerts/${alertId}/dismiss`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Alert dismissed");

      // Verify the alert was actually updated in the database
      const alert = await prisma.alert.findUnique({ where: { id: alertId } });
      expect(alert?.status).toBe("DISMISSED");
    });

    it("cannot acknowledge alert for non-enrolled patient", async () => {
      // Create another patient and alert not enrolled with this clinician
      const otherPatient = await createTestPatient({
        email: "other.patient@example.com",
      });
      const otherAlert = await prisma.alert.create({
        data: {
          patientId: otherPatient.id,
          triggeredAt: new Date(),
          ruleId: "test",
          ruleName: "Test",
          severity: "INFO",
          status: "OPEN",
          inputs: {},
        },
      });

      const response = await request(testApp)
        .post(`/clinician/alerts/${otherAlert.id}/acknowledge`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(404);
    });

    it("filters alerts by status", async () => {
      // Acknowledge the alert first
      await prisma.alert.update({
        where: { id: alertId },
        data: {
          status: "ACKNOWLEDGED",
          acknowledgedBy: clinicianId,
          acknowledgedAt: new Date(),
        },
      });

      // Query for OPEN alerts (should be empty)
      const openResponse = await request(testApp)
        .get("/clinician/alerts?status=OPEN")
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(openResponse.status).toBe(200);
      expect(openResponse.body.alerts).toHaveLength(0);

      // Query for ACKNOWLEDGED alerts
      const ackResponse = await request(testApp)
        .get("/clinician/alerts?status=ACKNOWLEDGED")
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(ackResponse.status).toBe(200);
      expect(ackResponse.body.alerts).toHaveLength(1);
    });
  });

  describe("Clinical Notes", () => {
    it("creates a note for a patient", async () => {
      const response = await request(testApp)
        .post(`/clinician/patients/${patientId}/notes`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({
          content: "Patient reports feeling better today.",
        });

      expect(response.status).toBe(201);
      expect(response.body.note.content).toBe("Patient reports feeling better today.");
      expect(response.body.note.clinicianId).toBe(clinicianId);
      expect(response.body.note.patientId).toBe(patientId);
    });

    it("lists notes for a patient", async () => {
      // Create some notes
      await prisma.clinicianNote.createMany({
        data: [
          {
            patientId,
            clinicianId,
            content: "First note",
          },
          {
            patientId,
            clinicianId,
            content: "Second note",
          },
        ],
      });

      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/notes`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.notes).toHaveLength(2);
    });

    it("updates own note", async () => {
      const note = await prisma.clinicianNote.create({
        data: {
          patientId,
          clinicianId,
          content: "Original content",
        },
      });

      const response = await request(testApp)
        .put(`/clinician/notes/${note.id}`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({
          content: "Updated content",
        });

      expect(response.status).toBe(200);
      expect(response.body.note.content).toBe("Updated content");
    });

    it("cannot update another clinician's note", async () => {
      // Create another clinician
      const otherClinician = await createTestClinician({
        email: "other.clinician@example.com",
      });

      // Create note by other clinician
      const note = await prisma.clinicianNote.create({
        data: {
          patientId,
          clinicianId: otherClinician.id,
          content: "Other clinician's note",
        },
      });

      const response = await request(testApp)
        .put(`/clinician/notes/${note.id}`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({
          content: "Trying to update",
        });

      // API returns 404 to avoid revealing note existence to unauthorized users
      expect(response.status).toBe(404);
    });

    it("deletes own note", async () => {
      const note = await prisma.clinicianNote.create({
        data: {
          patientId,
          clinicianId,
          content: "Note to delete",
        },
      });

      const response = await request(testApp)
        .delete(`/clinician/notes/${note.id}`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);

      // Verify deletion
      const deletedNote = await prisma.clinicianNote.findUnique({
        where: { id: note.id },
      });
      expect(deletedNote).toBeNull();
    });
  });

  describe("Patient Measurements View", () => {
    it("clinician can view patient measurements", async () => {
      // Create some measurements
      await prisma.measurement.create({
        data: {
          patientId,
          type: "WEIGHT",
          value: 70,
          unit: "kg",
          timestamp: new Date(),
          source: "manual",
        },
      });

      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/measurements?type=WEIGHT`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.measurements).toHaveLength(1);
    });

    it("cannot view measurements for non-enrolled patient", async () => {
      const otherPatient = await createTestPatient({
        email: "other.patient@example.com",
      });

      const response = await request(testApp)
        .get(`/clinician/patients/${otherPatient.id}/measurements?type=WEIGHT`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(404);
    });
  });
});
