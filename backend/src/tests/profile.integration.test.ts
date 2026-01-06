import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
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

describe("Patient Profile & Care Plan Integration Tests", () => {
  let patientId: string;
  let clinicianId: string;
  let clinicId: string;
  let enrollmentId: string;
  let patientToken: string;
  let clinicianToken: string;

  beforeAll(async () => {
    // Create test patient
    const patient = await createTestPatient({
      email: `profile-test-patient-${Date.now()}@test.com`,
      name: "Profile Test Patient",
      dateOfBirth: new Date("1970-05-15"),
    });
    patientId = patient.id;
    patientToken = getPatientToken(patientId, patient.email);

    // Create test clinician
    const clinician = await createTestClinician({
      email: `profile-test-clinician-${Date.now()}@test.com`,
      name: "Dr. Profile Test",
    });
    clinicianId = clinician.id;
    clinicianToken = getClinicianToken(clinicianId, clinician.email);

    // Create test clinic
    const clinic = await createTestClinic({
      name: "Profile Test Clinic",
      slug: `profile-test-clinic-${Date.now()}`,
    });
    clinicId = clinic.id;

    // Create clinic membership
    await createClinicMembership(clinicId, clinicianId, "CLINICIAN");

    // Create enrollment
    const enrollment = await prisma.enrollment.create({
      data: {
        patientId,
        clinicianId,
        clinicId,
        enrolledVia: "ADMIN",
      },
    });
    enrollmentId = enrollment.id;
  });

  afterAll(async () => {
    await cleanupTestData();
    await disconnectPrisma();
  });

  describe("Patient Profile - Patient Access", () => {
    it("should return null profile for new patient", async () => {
      const response = await request(testApp)
        .get("/patient/profile")
        .set("Authorization", `Bearer ${patientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.profile).toBeNull();
      expect(response.body.completeness).toBeDefined();
      expect(response.body.completeness.profileScore).toBe(0);
    });

    it("should create profile on first update", async () => {
      const response = await request(testApp)
        .put("/patient/profile")
        .set("Authorization", `Bearer ${patientToken}`)
        .send({
          sex: "MALE",
          heightCm: 175.5,
          ckdStageSelfReported: "STAGE_4",
          hasHeartFailure: true,
          diabetesType: "TYPE_2",
        });

      expect(response.status).toBe(200);
      expect(response.body.profile).toBeDefined();
      expect(response.body.profile.sex).toBe("MALE");
      expect(response.body.profile.heightCm).toBe(175.5);
      expect(response.body.profile.ckdStageSelfReported).toBe("STAGE_4");
      expect(response.body.profile.hasHeartFailure).toBe(true);
      expect(response.body.profile.diabetesType).toBe("TYPE_2");
    });

    it("should show effective CKD stage from self-reported", async () => {
      const response = await request(testApp)
        .get("/patient/profile")
        .set("Authorization", `Bearer ${patientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.profile.ckdStageEffective).toBe("STAGE_4");
      expect(response.body.profile.ckdStageSource).toBe("self_reported");
    });

    it("should validate height range", async () => {
      const response = await request(testApp)
        .put("/patient/profile")
        .set("Authorization", `Bearer ${patientToken}`)
        .send({
          heightCm: 10, // Too short
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("heightCm");
    });

    it("should validate transplant date not in future", async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const response = await request(testApp)
        .put("/patient/profile")
        .set("Authorization", `Bearer ${patientToken}`)
        .send({
          transplantDate: futureDate.toISOString(),
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("transplantDate");
    });

    it("should return profile history", async () => {
      const response = await request(testApp)
        .get("/patient/profile/history")
        .set("Authorization", `Bearer ${patientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.changes).toBeDefined();
      expect(Array.isArray(response.body.changes)).toBe(true);
      expect(response.body.changes.length).toBeGreaterThan(0);
      expect(response.body.changes[0].actor.type).toBe("PATIENT");
    });
  });

  describe("Patient Profile - Clinician Access", () => {
    it("should get patient profile as clinician", async () => {
      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/profile`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.profile).toBeDefined();
      expect(response.body.profile.sex).toBe("MALE");
    });

    it("should allow clinician to set ckdStageClinician", async () => {
      const response = await request(testApp)
        .put(`/clinician/patients/${patientId}/profile`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({
          ckdStageClinician: "STAGE_4",
          heartFailureClass: "CLASS_2",
          reason: "Clinical assessment",
        });

      expect(response.status).toBe(200);
      expect(response.body.profile.ckdStageClinician).toBe("STAGE_4");
      expect(response.body.profile.heartFailureClass).toBe("CLASS_2");
    });

    it("should show clinician CKD stage as effective when set", async () => {
      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/profile`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.profile.ckdStageEffective).toBe("STAGE_4");
      expect(response.body.profile.ckdStageSource).toBe("clinician");
    });

    it("should reject access to non-enrolled patient", async () => {
      // Create another patient not enrolled with this clinician
      const otherPatient = await createTestPatient({
        email: `other-patient-${Date.now()}@test.com`,
        name: "Other Patient",
      });

      const response = await request(testApp)
        .get(`/clinician/patients/${otherPatient.id}/profile`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      // Returns 404 (not 403) to avoid leaking information about non-enrolled patients
      expect(response.status).toBe(404);
    });
  });

  describe("Care Plan", () => {
    it("should return null care plan for new enrollment", async () => {
      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/care-plan`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.carePlan).toBeNull();
      expect(response.body.completeness.showTargetsBanner).toBe(true);
    });

    it("should create care plan on first update", async () => {
      const response = await request(testApp)
        .put(`/clinician/patients/${patientId}/care-plan`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({
          dryWeightKg: 82.5,
          targetBpSystolic: { min: 110, max: 130 },
          targetBpDiastolic: { min: 60, max: 80 },
          fluidRetentionRisk: true,
          reason: "Initial care plan setup",
        });

      expect(response.status).toBe(200);
      expect(response.body.carePlan).toBeDefined();
      expect(response.body.carePlan.dryWeightKg).toBe(82.5);
      expect(response.body.carePlan.dryWeightLbs).toBeCloseTo(181.9, 0);
      expect(response.body.carePlan.targetBpSystolic).toEqual({ min: 110, max: 130 });
      expect(response.body.carePlan.fluidRetentionRisk).toBe(true);
    });

    it("should calculate completeness correctly", async () => {
      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/care-plan`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.completeness.carePlanScore).toBeGreaterThan(0);
      expect(response.body.completeness.showTargetsBanner).toBe(false);
    });

    it("should validate dry weight range", async () => {
      const response = await request(testApp)
        .put(`/clinician/patients/${patientId}/care-plan`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({
          dryWeightKg: 10, // Too low
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("dryWeightKg");
    });

    it("should validate BP target min <= max", async () => {
      const response = await request(testApp)
        .put(`/clinician/patients/${patientId}/care-plan`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({
          targetBpSystolic: { min: 140, max: 120 }, // Invalid: min > max
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("targetBpSystolic");
    });
  });

  describe("Profile History with Care Plan Changes", () => {
    it("should show both profile and care plan changes", async () => {
      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/profile/history`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.changes.length).toBeGreaterThan(0);

      const entityTypes = response.body.changes.map((c: { entityType: string }) => c.entityType);
      expect(entityTypes).toContain("PATIENT_PROFILE");
      expect(entityTypes).toContain("CARE_PLAN");
    });
  });
});

describe("Profile Service Unit Tests", () => {
  afterAll(async () => {
    await cleanupTestData();
    await disconnectPrisma();
  });

  it("should calculate profile completeness correctly", async () => {
    const { calculateProfileCompleteness } = await import("../services/profile.service.js");

    // Null profile
    const nullResult = calculateProfileCompleteness(null);
    expect(nullResult.profileScore).toBe(0);
    expect(nullResult.showProfileBanner).toBe(true);
    expect(nullResult.missingCritical).toContain("ckdStageClinician");
  });

  it("should calculate care plan completeness correctly", async () => {
    const { calculateCarePlanCompleteness } = await import("../services/careplan.service.js");

    // Null care plan
    const nullResult = calculateCarePlanCompleteness(null);
    expect(nullResult.carePlanScore).toBe(0);
    expect(nullResult.showTargetsBanner).toBe(true);
    expect(nullResult.missingCritical).toContain("dryWeightKg");
  });
});
