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

      // Create RPM time entries totaling 25 minutes (RPM activities only)
      await prisma.timeEntry.create({
        data: {
          patientId,
          clinicianId,
          clinicId,
          entryDate: today,
          durationMinutes: 15,
          activity: "PATIENT_REVIEW", // RPM activity
        },
      });

      await prisma.timeEntry.create({
        data: {
          patientId,
          clinicianId,
          clinicId,
          entryDate: today,
          durationMinutes: 10,
          activity: "DOCUMENTATION", // RPM activity (not CCM)
        },
      });

      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/billing-summary`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.summary.time.totalMinutes).toBe(25);
      expect(response.body.summary.time.rpmMinutes).toBe(25); // All RPM activities
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

      // Non-CCM activity (RPM only)
      await prisma.timeEntry.create({
        data: {
          patientId,
          clinicianId,
          clinicId,
          entryDate: today,
          durationMinutes: 30,
          activity: "PATIENT_REVIEW", // RPM (not CCM)
        },
      });

      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/billing-summary`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.summary.time.totalMinutes).toBe(55);
      // RPM and CCM are mutually exclusive - activities count toward one or the other
      expect(response.body.summary.time.rpmMinutes).toBe(30); // PATIENT_REVIEW only
      expect(response.body.summary.time.ccmMinutes).toBe(25); // CCM activities only
      expect(response.body.summary.time.eligible99490).toBe(true); // 25 >= 20
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

    it("calculates 99091 eligibility for 30+ min physician RPM time", async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Create physician RPM time entry of 35 minutes
      await prisma.timeEntry.create({
        data: {
          patientId,
          clinicianId,
          clinicId,
          entryDate: today,
          durationMinutes: 35,
          activity: "PATIENT_REVIEW", // RPM activity
          performerType: "PHYSICIAN_QHP",
        },
      });

      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/billing-summary`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.summary.time.rpmPhysicianMinutes).toBe(35);
      expect(response.body.summary.time.eligible99091).toBe(true);
      expect(response.body.summary.eligibleCodes).toContain("99091");
      // Should also have 99457 since 35 >= 20
      expect(response.body.summary.eligibleCodes).toContain("99457");
    });

    it("29 minutes of physician RPM time is not eligible for 99091", async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await prisma.timeEntry.create({
        data: {
          patientId,
          clinicianId,
          clinicId,
          entryDate: today,
          durationMinutes: 29,
          activity: "DOCUMENTATION", // RPM activity
          performerType: "PHYSICIAN_QHP",
        },
      });

      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/billing-summary`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.summary.time.rpmPhysicianMinutes).toBe(29);
      expect(response.body.summary.time.eligible99091).toBe(false);
      expect(response.body.summary.eligibleCodes).not.toContain("99091");
    });

    it("clinical staff RPM time does not count toward 99091", async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Create clinical staff RPM time entry
      await prisma.timeEntry.create({
        data: {
          patientId,
          clinicianId,
          clinicId,
          entryDate: today,
          durationMinutes: 45,
          activity: "PATIENT_REVIEW",
          performerType: "CLINICAL_STAFF",
        },
      });

      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/billing-summary`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.summary.time.rpmMinutes).toBe(45);
      expect(response.body.summary.time.rpmPhysicianMinutes).toBe(0);
      expect(response.body.summary.time.eligible99091).toBe(false);
      expect(response.body.summary.eligibleCodes).not.toContain("99091");
      // Should still have 99457 since total RPM time >= 20
      expect(response.body.summary.eligibleCodes).toContain("99457");
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

      // Add RPM time entries for both patients (to count toward 99457)
      await prisma.timeEntry.create({
        data: {
          patientId,
          clinicianId,
          clinicId,
          entryDate: today,
          durationMinutes: 25,
          activity: "PATIENT_REVIEW", // RPM activity
        },
      });

      await prisma.timeEntry.create({
        data: {
          patientId: patient2.id,
          clinicianId,
          clinicId,
          entryDate: today,
          durationMinutes: 30,
          activity: "DOCUMENTATION", // RPM activity (not CCM)
        },
      });

      const response = await request(testApp)
        .get(`/clinician/clinics/${clinicId}/billing-report`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.report.summary.totalPatients).toBe(2);
      expect(response.body.report.summary.patientsWith99457).toBe(2); // Both have 20+ RPM min
      expect(response.body.report.summary.totalRpmMinutes).toBe(55); // 25 + 30
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

  describe("CCM Add-on Codes (99439, 99491, 99437)", () => {
    it("calculates 99439 add-on blocks for additional CCM staff time", async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Create CCM activity with 65 minutes of clinical staff time (20 + 20 + 20 + 5)
      await prisma.timeEntry.create({
        data: {
          patientId,
          clinicianId,
          clinicId,
          entryDate: today,
          durationMinutes: 65,
          activity: "CARE_PLAN_UPDATE", // CCM activity
          performerType: "CLINICAL_STAFF",
        },
      });

      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/billing-summary`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.summary.time.ccmClinicalStaffMinutes).toBe(65);
      expect(response.body.summary.time.eligible99490).toBe(true);
      expect(response.body.summary.time.eligible99439Count).toBe(2); // (65-20)/20 = 2 blocks
      expect(response.body.summary.eligibleCodes).toContain("99490");
      expect(response.body.summary.eligibleCodes.filter((c: string) => c === "99439")).toHaveLength(2);
    });

    it("calculates 99491 for 30+ physician CCM time", async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Create CCM activity with 35 minutes of physician time
      await prisma.timeEntry.create({
        data: {
          patientId,
          clinicianId,
          clinicId,
          entryDate: today,
          durationMinutes: 35,
          activity: "PHONE_CALL", // CCM activity
          performerType: "PHYSICIAN_QHP",
        },
      });

      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/billing-summary`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.summary.time.ccmPhysicianMinutes).toBe(35);
      expect(response.body.summary.time.eligible99491).toBe(true);
      expect(response.body.summary.eligibleCodes).toContain("99491");
    });

    it("calculates 99437 add-on blocks for additional CCM physician time", async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Create CCM activity with 95 minutes of physician time (30 + 30 + 30 + 5)
      await prisma.timeEntry.create({
        data: {
          patientId,
          clinicianId,
          clinicId,
          entryDate: today,
          durationMinutes: 95,
          activity: "COORDINATION", // CCM activity
          performerType: "PHYSICIAN_QHP",
        },
      });

      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/billing-summary`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.summary.time.ccmPhysicianMinutes).toBe(95);
      expect(response.body.summary.time.eligible99491).toBe(true);
      expect(response.body.summary.time.eligible99437Count).toBe(2); // (95-30)/30 = 2 blocks
      expect(response.body.summary.eligibleCodes).toContain("99491");
      expect(response.body.summary.eligibleCodes.filter((c: string) => c === "99437")).toHaveLength(2);
    });

    it("allows both staff and physician CCM codes to coexist", async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Create mixed CCM activities
      await prisma.timeEntry.create({
        data: {
          patientId,
          clinicianId,
          clinicId,
          entryDate: today,
          durationMinutes: 25, // Staff time
          activity: "CARE_PLAN_UPDATE",
          performerType: "CLINICAL_STAFF",
        },
      });

      await prisma.timeEntry.create({
        data: {
          patientId,
          clinicianId,
          clinicId,
          entryDate: today,
          durationMinutes: 35, // Physician time
          activity: "PHONE_CALL",
          performerType: "PHYSICIAN_QHP",
        },
      });

      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/billing-summary`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.summary.time.eligible99490).toBe(true);
      expect(response.body.summary.time.eligible99491).toBe(true);
      expect(response.body.summary.eligibleCodes).toContain("99490");
      expect(response.body.summary.eligibleCodes).toContain("99491");
    });
  });

  describe("PCM Codes (99424, 99425, 99426, 99427)", () => {
    it("includes PCM codes when billing program is RPM_PCM", async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Update enrollment to PCM track
      await prisma.enrollment.updateMany({
        where: { patientId, clinicianId },
        data: { billingProgram: "RPM_PCM" },
      });

      // Create PCM activity with physician time
      await prisma.timeEntry.create({
        data: {
          patientId,
          clinicianId,
          clinicId,
          entryDate: today,
          durationMinutes: 35,
          activity: "PHONE_CALL",
          performerType: "PHYSICIAN_QHP",
        },
      });

      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/billing-summary`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.summary.time.eligible99424).toBe(true);
      expect(response.body.summary.eligibleCodes).toContain("99424");
      // Should NOT contain CCM codes
      expect(response.body.summary.eligibleCodes).not.toContain("99490");
      expect(response.body.summary.eligibleCodes).not.toContain("99491");
    });

    it("calculates 99425 add-on blocks for additional PCM physician time", async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await prisma.enrollment.updateMany({
        where: { patientId, clinicianId },
        data: { billingProgram: "RPM_PCM" },
      });

      // Create PCM activity with 95 minutes of physician time
      await prisma.timeEntry.create({
        data: {
          patientId,
          clinicianId,
          clinicId,
          entryDate: today,
          durationMinutes: 95,
          activity: "COORDINATION",
          performerType: "PHYSICIAN_QHP",
        },
      });

      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/billing-summary`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.summary.time.eligible99424).toBe(true);
      expect(response.body.summary.time.eligible99425Count).toBe(2);
      expect(response.body.summary.eligibleCodes).toContain("99424");
      expect(response.body.summary.eligibleCodes.filter((c: string) => c === "99425")).toHaveLength(2);
    });

    it("uses 99426 for PCM staff time when no physician time", async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await prisma.enrollment.updateMany({
        where: { patientId, clinicianId },
        data: { billingProgram: "RPM_PCM" },
      });

      // Create PCM activity with clinical staff time only
      await prisma.timeEntry.create({
        data: {
          patientId,
          clinicianId,
          clinicId,
          entryDate: today,
          durationMinutes: 35,
          activity: "CARE_PLAN_UPDATE",
          performerType: "CLINICAL_STAFF",
        },
      });

      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/billing-summary`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.summary.time.eligible99426).toBe(true);
      expect(response.body.summary.eligibleCodes).toContain("99426");
      expect(response.body.summary.eligibleCodes).not.toContain("99424");
    });

    it("physician codes take priority over staff codes in PCM track", async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await prisma.enrollment.updateMany({
        where: { patientId, clinicianId },
        data: { billingProgram: "RPM_PCM" },
      });

      // Create both physician and staff PCM time
      await prisma.timeEntry.create({
        data: {
          patientId,
          clinicianId,
          clinicId,
          entryDate: today,
          durationMinutes: 35,
          activity: "PHONE_CALL",
          performerType: "PHYSICIAN_QHP",
        },
      });

      await prisma.timeEntry.create({
        data: {
          patientId,
          clinicianId,
          clinicId,
          entryDate: today,
          durationMinutes: 35,
          activity: "CARE_PLAN_UPDATE",
          performerType: "CLINICAL_STAFF",
        },
      });

      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/billing-summary`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      // Should have physician code but NOT staff code (mutually exclusive in PCM)
      expect(response.body.summary.eligibleCodes).toContain("99424");
      expect(response.body.summary.eligibleCodes).not.toContain("99426");
    });
  });

  describe("CCM vs PCM Mutual Exclusivity", () => {
    it("RPM_CCM track does not include PCM codes", async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Ensure CCM track (default)
      await prisma.enrollment.updateMany({
        where: { patientId, clinicianId },
        data: { billingProgram: "RPM_CCM" },
      });

      await prisma.timeEntry.create({
        data: {
          patientId,
          clinicianId,
          clinicId,
          entryDate: today,
          durationMinutes: 35,
          activity: "PHONE_CALL",
          performerType: "PHYSICIAN_QHP",
        },
      });

      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/billing-summary`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.summary.eligibleCodes).toContain("99491"); // CCM physician
      expect(response.body.summary.eligibleCodes).not.toContain("99424"); // PCM physician
      expect(response.body.summary.eligibleCodes).not.toContain("99426"); // PCM staff
    });

    it("RPM_ONLY track does not include CCM or PCM codes", async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await prisma.enrollment.updateMany({
        where: { patientId, clinicianId },
        data: { billingProgram: "RPM_ONLY" },
      });

      await prisma.timeEntry.create({
        data: {
          patientId,
          clinicianId,
          clinicId,
          entryDate: today,
          durationMinutes: 35,
          activity: "PHONE_CALL",
          performerType: "PHYSICIAN_QHP",
        },
      });

      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/billing-summary`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      // Should not contain any CCM or PCM codes
      expect(response.body.summary.eligibleCodes).not.toContain("99490");
      expect(response.body.summary.eligibleCodes).not.toContain("99491");
      expect(response.body.summary.eligibleCodes).not.toContain("99424");
      expect(response.body.summary.eligibleCodes).not.toContain("99426");
    });
  });

  describe("Billing Program Update Endpoint", () => {
    it("updates billing program successfully", async () => {
      const response = await request(testApp)
        .put(`/clinician/patients/${patientId}/billing-program`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({ billingProgram: "RPM_PCM" });

      expect(response.status).toBe(200);
      expect(response.body.enrollment.billingProgram).toBe("RPM_PCM");

      // Verify change persisted
      const enrollment = await prisma.enrollment.findFirst({
        where: { patientId, clinicianId },
      });
      expect(enrollment?.billingProgram).toBe("RPM_PCM");
    });

    it("rejects invalid billing program", async () => {
      const response = await request(testApp)
        .put(`/clinician/patients/${patientId}/billing-program`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({ billingProgram: "INVALID" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("billingProgram");
    });

    it("returns 404 for unenrolled patient", async () => {
      const otherPatient = await createTestPatient({
        email: "other-billing@example.com",
      });

      const response = await request(testApp)
        .put(`/clinician/patients/${otherPatient.id}/billing-program`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({ billingProgram: "RPM_PCM" });

      expect(response.status).toBe(404);
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
