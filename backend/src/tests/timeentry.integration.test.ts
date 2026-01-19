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

describe("Time Entry Integration Tests", () => {
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

  describe("Create Time Entry", () => {
    it("creates a time entry for enrolled patient", async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const response = await request(testApp)
        .post(`/clinician/patients/${patientId}/time-entries`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({
          clinicId,
          entryDate: today.toISOString(),
          durationMinutes: 20,
          activity: "PATIENT_REVIEW",
          notes: "Reviewed patient vitals and trends",
        });

      expect(response.status).toBe(201);
      expect(response.body.timeEntry).toBeDefined();
      expect(response.body.timeEntry.durationMinutes).toBe(20);
      expect(response.body.timeEntry.activity).toBe("PATIENT_REVIEW");
      expect(response.body.timeEntry.notes).toBe("Reviewed patient vitals and trends");
    });

    it("rejects time entry for unenrolled patient", async () => {
      const otherPatient = await createTestPatient({
        email: "other.patient@example.com",
      });

      const response = await request(testApp)
        .post(`/clinician/patients/${otherPatient.id}/time-entries`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({
          clinicId,
          entryDate: new Date().toISOString(),
          durationMinutes: 15,
          activity: "PATIENT_REVIEW",
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Patient not found or not enrolled");
    });

    it("rejects time entry with invalid duration", async () => {
      const response = await request(testApp)
        .post(`/clinician/patients/${patientId}/time-entries`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({
          clinicId,
          entryDate: new Date().toISOString(),
          durationMinutes: 150, // exceeds 120 max
          activity: "PATIENT_REVIEW",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Duration must be between 1 and 120 minutes");
    });

    it("rejects time entry with future date", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const response = await request(testApp)
        .post(`/clinician/patients/${patientId}/time-entries`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({
          clinicId,
          entryDate: futureDate.toISOString(),
          durationMinutes: 15,
          activity: "PATIENT_REVIEW",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Entry date cannot be in the future");
    });

    it("rejects time entry older than 7 days", async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);

      const response = await request(testApp)
        .post(`/clinician/patients/${patientId}/time-entries`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({
          clinicId,
          entryDate: oldDate.toISOString(),
          durationMinutes: 15,
          activity: "PATIENT_REVIEW",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Entry date cannot be more than 7 days in the past");
    });

    it("rejects time entry with invalid activity", async () => {
      const response = await request(testApp)
        .post(`/clinician/patients/${patientId}/time-entries`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({
          clinicId,
          entryDate: new Date().toISOString(),
          durationMinutes: 15,
          activity: "INVALID_ACTIVITY",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid activity");
    });

    it("rejects time entry without required fields", async () => {
      const response = await request(testApp)
        .post(`/clinician/patients/${patientId}/time-entries`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({
          clinicId,
          // missing entryDate, durationMinutes, activity
        });

      expect(response.status).toBe(400);
    });
  });

  describe("List Time Entries", () => {
    beforeEach(async () => {
      // Create some test time entries
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      await prisma.timeEntry.createMany({
        data: [
          {
            patientId,
            clinicianId,
            clinicId,
            entryDate: today,
            durationMinutes: 20,
            activity: "PATIENT_REVIEW",
          },
          {
            patientId,
            clinicianId,
            clinicId,
            entryDate: yesterday,
            durationMinutes: 15,
            activity: "PHONE_CALL",
            notes: "Called patient about medication",
          },
        ],
      });
    });

    it("lists time entries for patient", async () => {
      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/time-entries`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.timeEntries).toHaveLength(2);
      expect(response.body.timeEntries[0].durationMinutes).toBeDefined();
    });

    it("filters time entries by date range", async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/time-entries`)
        .query({ from: today.toISOString(), to: today.toISOString() })
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.timeEntries).toHaveLength(1);
    });

    it("returns 404 for unenrolled patient", async () => {
      const otherPatient = await createTestPatient({
        email: "other2.patient@example.com",
      });

      const response = await request(testApp)
        .get(`/clinician/patients/${otherPatient.id}/time-entries`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe("Get Time Entry Summary", () => {
    beforeEach(async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await prisma.timeEntry.createMany({
        data: [
          {
            patientId,
            clinicianId,
            clinicId,
            entryDate: today,
            durationMinutes: 20,
            activity: "PATIENT_REVIEW",
          },
          {
            patientId,
            clinicianId,
            clinicId,
            entryDate: today,
            durationMinutes: 15,
            activity: "PHONE_CALL",
          },
          {
            patientId,
            clinicianId,
            clinicId,
            entryDate: today,
            durationMinutes: 10,
            activity: "PATIENT_REVIEW",
          },
        ],
      });
    });

    it("returns time entry summary", async () => {
      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/time-entries/summary`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.summary).toBeDefined();
      expect(response.body.summary.totalMinutes).toBe(45);
      expect(response.body.summary.entryCount).toBe(3);
      expect(response.body.summary.byActivity.PATIENT_REVIEW).toBe(30);
      expect(response.body.summary.byActivity.PHONE_CALL).toBe(15);
    });
  });

  describe("Update Time Entry", () => {
    let timeEntryId: string;

    beforeEach(async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const entry = await prisma.timeEntry.create({
        data: {
          patientId,
          clinicianId,
          clinicId,
          entryDate: today,
          durationMinutes: 20,
          activity: "PATIENT_REVIEW",
        },
      });
      timeEntryId = entry.id;
    });

    it("updates own time entry", async () => {
      const response = await request(testApp)
        .put(`/clinician/time-entries/${timeEntryId}`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({
          durationMinutes: 25,
          notes: "Updated notes",
        });

      expect(response.status).toBe(200);
      expect(response.body.timeEntry.durationMinutes).toBe(25);
      expect(response.body.timeEntry.notes).toBe("Updated notes");
    });

    it("cannot update another clinician's time entry", async () => {
      // Create another clinician
      const otherClinician = await createTestClinician({
        email: "other.clinician@example.com",
      });
      const otherToken = getClinicianToken(otherClinician.id);

      // Create membership for other clinician
      await createClinicMembership(clinicId, otherClinician.id);

      const response = await request(testApp)
        .put(`/clinician/time-entries/${timeEntryId}`)
        .set("Authorization", `Bearer ${otherToken}`)
        .send({
          durationMinutes: 30,
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Time entry not found or not authorized");
    });

    it("rejects invalid duration on update", async () => {
      const response = await request(testApp)
        .put(`/clinician/time-entries/${timeEntryId}`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({
          durationMinutes: 0,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Duration must be between 1 and 120 minutes");
    });
  });

  describe("Delete Time Entry", () => {
    let timeEntryId: string;

    beforeEach(async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const entry = await prisma.timeEntry.create({
        data: {
          patientId,
          clinicianId,
          clinicId,
          entryDate: today,
          durationMinutes: 20,
          activity: "PATIENT_REVIEW",
        },
      });
      timeEntryId = entry.id;
    });

    it("deletes own time entry", async () => {
      const response = await request(testApp)
        .delete(`/clinician/time-entries/${timeEntryId}`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify deleted
      const entry = await prisma.timeEntry.findUnique({ where: { id: timeEntryId } });
      expect(entry).toBeNull();
    });

    it("cannot delete another clinician's time entry", async () => {
      const otherClinician = await createTestClinician({
        email: "other.clinician2@example.com",
      });
      const otherToken = getClinicianToken(otherClinician.id);

      const response = await request(testApp)
        .delete(`/clinician/time-entries/${timeEntryId}`)
        .set("Authorization", `Bearer ${otherToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Time entry not found or not authorized");
    });
  });

  describe("Get Single Time Entry", () => {
    let timeEntryId: string;

    beforeEach(async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const entry = await prisma.timeEntry.create({
        data: {
          patientId,
          clinicianId,
          clinicId,
          entryDate: today,
          durationMinutes: 20,
          activity: "PATIENT_REVIEW",
          notes: "Test entry",
        },
      });
      timeEntryId = entry.id;
    });

    it("gets time entry by id", async () => {
      const response = await request(testApp)
        .get(`/clinician/time-entries/${timeEntryId}`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.timeEntry.id).toBe(timeEntryId);
      expect(response.body.timeEntry.patient).toBeDefined();
      expect(response.body.timeEntry.clinician).toBeDefined();
    });

    it("returns 404 for non-existent time entry", async () => {
      const response = await request(testApp)
        .get(`/clinician/time-entries/non-existent-id`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(404);
    });

    it("returns 404 when clinician not enrolled with patient", async () => {
      // Create time entry for a different patient
      const otherPatient = await createTestPatient({
        email: "other3.patient@example.com",
      });
      const otherClinician = await createTestClinician({
        email: "other3.clinician@example.com",
      });

      // Enroll other clinician with other patient
      await prisma.enrollment.create({
        data: {
          patientId: otherPatient.id,
          clinicianId: otherClinician.id,
          clinicId,
        },
      });

      const otherEntry = await prisma.timeEntry.create({
        data: {
          patientId: otherPatient.id,
          clinicianId: otherClinician.id,
          clinicId,
          entryDate: new Date(),
          durationMinutes: 10,
          activity: "PATIENT_REVIEW",
        },
      });

      // Our clinician should not be able to see this entry
      const response = await request(testApp)
        .get(`/clinician/time-entries/${otherEntry.id}`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(404);
    });
  });
});
