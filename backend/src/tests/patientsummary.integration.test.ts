import { describe, it, expect, beforeAll, afterAll } from "vitest";
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
import { evaluateRulesAtomic } from "../services/alert.service.js";

describe("Patient Summary Integration Tests", () => {
  let patientId: string;
  let clinicianId: string;
  let clinicId: string;
  let clinicianToken: string;

  beforeAll(async () => {
    // Create test data
    const patient = await createTestPatient({
      email: `summary-patient-${Date.now()}@test.com`,
      name: "Summary Test Patient",
      dateOfBirth: new Date("1965-03-15"),
    });
    patientId = patient.id;

    const clinician = await createTestClinician({
      email: `summary-clinician-${Date.now()}@test.com`,
      name: "Dr. Summary Test",
    });
    clinicianId = clinician.id;
    clinicianToken = getClinicianToken(clinicianId, clinician.email);

    const clinic = await createTestClinic({
      name: "Summary Test Clinic",
      slug: `summary-test-clinic-${Date.now()}`,
    });
    clinicId = clinic.id;

    await createClinicMembership(clinicId, clinicianId, "CLINICIAN");

    await prisma.enrollment.create({
      data: {
        patientId,
        clinicianId,
        clinicId,
        enrolledVia: "ADMIN",
      },
    });

    // Add some measurements
    const now = new Date();
    await prisma.measurement.createMany({
      data: [
        {
          patientId,
          type: "WEIGHT",
          value: 85.0,
          unit: "kg",
          timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        },
        {
          patientId,
          type: "WEIGHT",
          value: 85.5,
          unit: "kg",
          timestamp: now,
        },
        {
          patientId,
          type: "BP_SYSTOLIC",
          value: 135,
          unit: "mmHg",
          timestamp: now,
        },
        {
          patientId,
          type: "BP_DIASTOLIC",
          value: 85,
          unit: "mmHg",
          timestamp: now,
        },
      ],
    });
  });

  afterAll(async () => {
    await cleanupTestData();
    await disconnectPrisma();
  });

  describe("GET /clinician/patients/:patientId/summary", () => {
    it("should return comprehensive patient summary", async () => {
      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/summary`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);

      // Patient info
      expect(response.body.patient).toBeDefined();
      expect(response.body.patient.id).toBe(patientId);
      expect(response.body.patient.name).toBe("Summary Test Patient");

      // Enrollment info
      expect(response.body.enrollment).toBeDefined();
      expect(response.body.enrollment.clinicId).toBe(clinicId);

      // Latest measurements
      expect(response.body.latestMeasurements).toBeDefined();
      expect(response.body.latestMeasurements.weight).toBeDefined();
      expect(response.body.latestMeasurements.weight.value).toBe(85.5);
      expect(response.body.latestMeasurements.systolic).toBeDefined();
      expect(response.body.latestMeasurements.systolic.value).toBe(135);

      // Measurement summaries
      expect(response.body.measurementSummaries).toBeDefined();
      expect(response.body.measurementSummaries.weight).toBeDefined();
      expect(response.body.measurementSummaries.bloodPressure).toBeDefined();

      // Profile and care plan (should be null initially)
      expect(response.body.profile).toBeNull();
      expect(response.body.carePlan).toBeNull();

      // Completeness
      expect(response.body.completeness).toBeDefined();
      expect(response.body.completeness.profileScore).toBe(0);
      expect(response.body.completeness.carePlanScore).toBe(0);

      // Banners
      expect(response.body.banners).toBeDefined();
      expect(response.body.banners.showTargetsBanner).toBe(true);
      expect(response.body.banners.showProfileBanner).toBe(true);

      // Last activity
      expect(response.body.lastActivity).toBeDefined();
      expect(response.body.lastActivity.lastMeasurementAt).toBeDefined();

      // Meta
      expect(response.body.meta.generatedAt).toBeDefined();
    });

    it("should include profile and care plan when set", async () => {
      // Create profile
      await prisma.patientProfile.create({
        data: {
          patientId,
          sex: "MALE",
          heightCm: 178,
          ckdStageClinician: "STAGE_4",
          ckdStageSetById: clinicianId,
          ckdStageSetAt: new Date(),
          hasHeartFailure: true,
          diabetesType: "TYPE_2",
        },
      });

      // Create care plan
      const enrollment = await prisma.enrollment.findFirst({
        where: { patientId, clinicianId },
      });
      await prisma.carePlan.create({
        data: {
          enrollmentId: enrollment!.id,
          dryWeightKg: 82.5,
          targetBpSystolic: { min: 110, max: 130 },
          targetBpDiastolic: { min: 60, max: 80 },
        },
      });

      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/summary`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);

      // Profile should be populated
      expect(response.body.profile).toBeDefined();
      expect(response.body.profile.ckdStageClinician).toBe("STAGE_4");
      expect(response.body.profile.hasHeartFailure).toBe(true);

      // Care plan should be populated
      expect(response.body.carePlan).toBeDefined();
      expect(response.body.carePlan.dryWeightKg).toBe(82.5);
      expect(response.body.carePlan.targetBpSystolic).toEqual({ min: 110, max: 130 });

      // Completeness should improve
      expect(response.body.completeness.profileScore).toBeGreaterThan(0);
      expect(response.body.completeness.carePlanScore).toBe(100);

      // Banners should update
      expect(response.body.banners.showTargetsBanner).toBe(false);
      expect(response.body.banners.showProfileBanner).toBe(false);
    });

    it("should return 404 for non-enrolled patient", async () => {
      const otherPatient = await createTestPatient({
        email: `other-summary-${Date.now()}@test.com`,
        name: "Other Patient",
      });

      const response = await request(testApp)
        .get(`/clinician/patients/${otherPatient.id}/summary`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(404);
    });
  });
});

describe("Alert Context Tests - CarePlan Independence", () => {
  let patientWithCarePlan: string;
  let patientWithoutCarePlan: string;
  let clinicianId: string;
  let clinicId: string;

  beforeAll(async () => {
    // Create clinician and clinic
    const clinician = await createTestClinician({
      email: `alert-context-clinician-${Date.now()}@test.com`,
      name: "Dr. Alert Context",
    });
    clinicianId = clinician.id;

    const clinic = await createTestClinic({
      name: "Alert Context Test Clinic",
      slug: `alert-context-clinic-${Date.now()}`,
    });
    clinicId = clinic.id;

    await createClinicMembership(clinicId, clinicianId, "CLINICIAN");

    // Create patient WITH care plan
    const patient1 = await createTestPatient({
      email: `alert-with-careplan-${Date.now()}@test.com`,
      name: "Patient With CarePlan",
    });
    patientWithCarePlan = patient1.id;

    const enrollment1 = await prisma.enrollment.create({
      data: {
        patientId: patientWithCarePlan,
        clinicianId,
        clinicId,
        enrolledVia: "ADMIN",
      },
    });

    await prisma.carePlan.create({
      data: {
        enrollmentId: enrollment1.id,
        dryWeightKg: 80.0,
        targetBpSystolic: { min: 100, max: 120 },
        targetBpDiastolic: { min: 60, max: 80 },
      },
    });

    // Create patient WITHOUT care plan
    const patient2 = await createTestPatient({
      email: `alert-no-careplan-${Date.now()}@test.com`,
      name: "Patient Without CarePlan",
    });
    patientWithoutCarePlan = patient2.id;

    await prisma.enrollment.create({
      data: {
        patientId: patientWithoutCarePlan,
        clinicianId,
        clinicId,
        enrolledVia: "ADMIN",
      },
    });
  });

  afterAll(async () => {
    await cleanupTestData();
    await disconnectPrisma();
  });

  it("should create IDENTICAL alerts regardless of CarePlan presence", async () => {
    // Add weight gain measurements to BOTH patients (exactly the same pattern)
    const now = new Date();
    // Use -47 hours to ensure first measurement is within the 48h window
    const measurementData = [
      { value: 80.0, timestamp: new Date(now.getTime() - 47 * 60 * 60 * 1000) },
      { value: 82.0, timestamp: now }, // +2kg in <48h = should trigger alert (threshold is 1.36kg)
    ];

    for (const patient of [patientWithCarePlan, patientWithoutCarePlan]) {
      for (const m of measurementData) {
        await prisma.measurement.create({
          data: {
            patientId: patient,
            type: "WEIGHT",
            value: m.value,
            unit: "kg",
            timestamp: m.timestamp,
          },
        });
      }

      // Trigger alert evaluation
      await evaluateRulesAtomic(patient, "WEIGHT");
    }

    // Get alerts for both patients
    const alertWithCarePlan = await prisma.alert.findFirst({
      where: { patientId: patientWithCarePlan, ruleId: "weight_gain_48h" },
    });
    const alertWithoutCarePlan = await prisma.alert.findFirst({
      where: { patientId: patientWithoutCarePlan, ruleId: "weight_gain_48h" },
    });

    // CRITICAL ASSERTION: Both patients should have alerts
    expect(alertWithCarePlan).toBeDefined();
    expect(alertWithoutCarePlan).toBeDefined();

    // CRITICAL ASSERTION: Alert properties should be IDENTICAL
    expect(alertWithCarePlan!.ruleId).toBe(alertWithoutCarePlan!.ruleId);
    expect(alertWithCarePlan!.ruleName).toBe(alertWithoutCarePlan!.ruleName);
    expect(alertWithCarePlan!.severity).toBe(alertWithoutCarePlan!.severity);
    expect(alertWithCarePlan!.status).toBe(alertWithoutCarePlan!.status);

    // Verify the alert inputs structure is identical
    const inputsWithCarePlan = alertWithCarePlan!.inputs as Record<string, unknown>;
    const inputsWithoutCarePlan = alertWithoutCarePlan!.inputs as Record<string, unknown>;

    expect(inputsWithCarePlan.delta).toBe(inputsWithoutCarePlan.delta);
    expect(inputsWithCarePlan.thresholdKg).toBe(inputsWithoutCarePlan.thresholdKg);
    expect(inputsWithCarePlan.windowHours).toBe(inputsWithoutCarePlan.windowHours);
  });

  it("should NOT modify alert severity based on CarePlan targets", async () => {
    // Add BP measurement that exceeds population threshold
    // Population threshold: 180 mmHg (WARNING), 200 mmHg (CRITICAL)
    // Patient1 CarePlan target: 100-120 mmHg (patient would be "out of range" at any value)
    // Patient2 has no CarePlan

    const now = new Date();
    const bpValue = 185; // Above population threshold (180 mmHg)

    for (const patient of [patientWithCarePlan, patientWithoutCarePlan]) {
      await prisma.measurement.create({
        data: {
          patientId: patient,
          type: "BP_SYSTOLIC",
          value: bpValue,
          unit: "mmHg",
          timestamp: now,
        },
      });

      await evaluateRulesAtomic(patient, "BP_SYSTOLIC");
    }

    const alertWithCarePlan = await prisma.alert.findFirst({
      where: { patientId: patientWithCarePlan, ruleId: "bp_systolic_high" },
    });
    const alertWithoutCarePlan = await prisma.alert.findFirst({
      where: { patientId: patientWithoutCarePlan, ruleId: "bp_systolic_high" },
    });

    // Both should have alerts with IDENTICAL severity
    expect(alertWithCarePlan).toBeDefined();
    expect(alertWithoutCarePlan).toBeDefined();
    expect(alertWithCarePlan!.severity).toBe(alertWithoutCarePlan!.severity);
    expect(alertWithCarePlan!.severity).toBe("WARNING"); // Population threshold, not CarePlan
  });

  it("getContextForAlert should be used ONLY for display enrichment", async () => {
    // Import and test getContextForAlert
    const { getContextForAlert } = await import("../services/careplan.service.js");

    const contextWithCarePlan = await getContextForAlert(patientWithCarePlan, clinicianId);
    const contextWithoutCarePlan = await getContextForAlert(patientWithoutCarePlan, clinicianId);

    // Context WITH care plan has targets
    expect(contextWithCarePlan.dryWeightKg).toBe(80.0);
    expect(contextWithCarePlan.targetBpSystolic).toEqual({ min: 100, max: 120 });

    // Context WITHOUT care plan has no targets (null or undefined)
    expect(contextWithoutCarePlan.dryWeightKg).toBeNull();
    // Note: targetBpSystolic may be null or undefined when carePlan doesn't exist
    expect(contextWithoutCarePlan.targetBpSystolic).toBeFalsy();

    // CRITICAL: contextComplete is false when no carePlan (no dry weight set)
    // Used for UI display, not alert firing
    expect(contextWithCarePlan.contextComplete).toBe(false); // No clinician CKD stage
    expect(contextWithoutCarePlan.contextComplete).toBe(false);

    // Verify this context structure exists but is NOT used by alert evaluation
    // Alert rules in alert.service.ts use ALERT_THRESHOLDS from units.ts, not these values
  });
});

describe("Multi-Clinic Access Control Tests", () => {
  let patient1: string;
  let patient2: string;
  let clinician1: string;
  let clinician2: string;
  let clinic1: string;
  let clinic2: string;
  let clinician1Token: string;
  let clinician2Token: string;
  let enrollment1Id: string;
  let enrollment2Id: string;

  beforeAll(async () => {
    // Create two separate clinics
    const c1 = await createTestClinic({
      name: "Clinic One",
      slug: `clinic-one-${Date.now()}`,
    });
    clinic1 = c1.id;

    const c2 = await createTestClinic({
      name: "Clinic Two",
      slug: `clinic-two-${Date.now()}`,
    });
    clinic2 = c2.id;

    // Create two clinicians, each in their own clinic
    const clin1 = await createTestClinician({
      email: `clinician-c1-${Date.now()}@test.com`,
      name: "Dr. Clinic One",
    });
    clinician1 = clin1.id;
    clinician1Token = getClinicianToken(clinician1, clin1.email);

    const clin2 = await createTestClinician({
      email: `clinician-c2-${Date.now()}@test.com`,
      name: "Dr. Clinic Two",
    });
    clinician2 = clin2.id;
    clinician2Token = getClinicianToken(clinician2, clin2.email);

    await createClinicMembership(clinic1, clinician1, "CLINICIAN");
    await createClinicMembership(clinic2, clinician2, "CLINICIAN");

    // Create patients enrolled in different clinics
    const p1 = await createTestPatient({
      email: `patient-c1-${Date.now()}@test.com`,
      name: "Patient Clinic One",
    });
    patient1 = p1.id;

    const p2 = await createTestPatient({
      email: `patient-c2-${Date.now()}@test.com`,
      name: "Patient Clinic Two",
    });
    patient2 = p2.id;

    // Patient1 enrolled with Clinician1 in Clinic1
    const e1 = await prisma.enrollment.create({
      data: {
        patientId: patient1,
        clinicianId: clinician1,
        clinicId: clinic1,
        enrolledVia: "ADMIN",
      },
    });
    enrollment1Id = e1.id;

    // Patient2 enrolled with Clinician2 in Clinic2
    const e2 = await prisma.enrollment.create({
      data: {
        patientId: patient2,
        clinicianId: clinician2,
        clinicId: clinic2,
        enrolledVia: "ADMIN",
      },
    });
    enrollment2Id = e2.id;

    // Create care plans for each enrollment
    await prisma.carePlan.create({
      data: {
        enrollmentId: enrollment1Id,
        dryWeightKg: 75.0,
        targetBpSystolic: { min: 100, max: 130 },
        notes: "Clinic One care plan",
      },
    });

    await prisma.carePlan.create({
      data: {
        enrollmentId: enrollment2Id,
        dryWeightKg: 85.0,
        targetBpSystolic: { min: 110, max: 140 },
        notes: "Clinic Two care plan",
      },
    });

    // Create profiles
    await prisma.patientProfile.create({
      data: {
        patientId: patient1,
        ckdStageClinician: "STAGE_3B",
        ckdStageSetById: clinician1,
        ckdStageSetAt: new Date(),
      },
    });

    await prisma.patientProfile.create({
      data: {
        patientId: patient2,
        ckdStageClinician: "STAGE_4",
        ckdStageSetById: clinician2,
        ckdStageSetAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await cleanupTestData();
    await disconnectPrisma();
  });

  describe("Care Plan Enrollment Scoping", () => {
    it("clinician1 can access patient1 care plan", async () => {
      const response = await request(testApp)
        .get(`/clinician/patients/${patient1}/care-plan`)
        .set("Authorization", `Bearer ${clinician1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.carePlan.dryWeightKg).toBe(75.0);
      expect(response.body.carePlan.notes).toBe("Clinic One care plan");
    });

    it("clinician1 CANNOT access patient2 care plan (different clinic)", async () => {
      const response = await request(testApp)
        .get(`/clinician/patients/${patient2}/care-plan`)
        .set("Authorization", `Bearer ${clinician1Token}`);

      expect(response.status).toBe(404);
    });

    it("clinician2 can access patient2 care plan", async () => {
      const response = await request(testApp)
        .get(`/clinician/patients/${patient2}/care-plan`)
        .set("Authorization", `Bearer ${clinician2Token}`);

      expect(response.status).toBe(200);
      expect(response.body.carePlan.dryWeightKg).toBe(85.0);
      expect(response.body.carePlan.notes).toBe("Clinic Two care plan");
    });

    it("clinician2 CANNOT access patient1 care plan (different clinic)", async () => {
      const response = await request(testApp)
        .get(`/clinician/patients/${patient1}/care-plan`)
        .set("Authorization", `Bearer ${clinician2Token}`);

      expect(response.status).toBe(404);
    });

    it("clinician1 can update patient1 care plan", async () => {
      const response = await request(testApp)
        .put(`/clinician/patients/${patient1}/care-plan`)
        .set("Authorization", `Bearer ${clinician1Token}`)
        .send({
          dryWeightKg: 76.0,
        });

      expect(response.status).toBe(200);
      expect(response.body.carePlan.dryWeightKg).toBe(76.0);
    });

    it("clinician1 CANNOT update patient2 care plan (different clinic)", async () => {
      const response = await request(testApp)
        .put(`/clinician/patients/${patient2}/care-plan`)
        .set("Authorization", `Bearer ${clinician1Token}`)
        .send({
          dryWeightKg: 99.0,
        });

      expect(response.status).toBe(404);

      // Verify care plan wasn't changed
      const carePlan = await prisma.carePlan.findUnique({
        where: { enrollmentId: enrollment2Id },
      });
      expect(Number(carePlan!.dryWeightKg)).toBe(85.0);
    });
  });

  describe("Profile Access Scoping", () => {
    it("clinician1 can access patient1 profile", async () => {
      const response = await request(testApp)
        .get(`/clinician/patients/${patient1}/profile`)
        .set("Authorization", `Bearer ${clinician1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.profile.ckdStageClinician).toBe("STAGE_3B");
    });

    it("clinician1 CANNOT access patient2 profile (different clinic)", async () => {
      const response = await request(testApp)
        .get(`/clinician/patients/${patient2}/profile`)
        .set("Authorization", `Bearer ${clinician1Token}`);

      expect(response.status).toBe(404);
    });

    it("clinician1 can update patient1 profile", async () => {
      const response = await request(testApp)
        .put(`/clinician/patients/${patient1}/profile`)
        .set("Authorization", `Bearer ${clinician1Token}`)
        .send({
          heartFailureClass: "CLASS_1",
        });

      expect(response.status).toBe(200);
      expect(response.body.profile.heartFailureClass).toBe("CLASS_1");
    });

    it("clinician1 CANNOT update patient2 profile (different clinic)", async () => {
      const response = await request(testApp)
        .put(`/clinician/patients/${patient2}/profile`)
        .set("Authorization", `Bearer ${clinician1Token}`)
        .send({
          heartFailureClass: "CLASS_4",
        });

      expect(response.status).toBe(404);

      // Verify profile wasn't changed
      const profile = await prisma.patientProfile.findUnique({
        where: { patientId: patient2 },
      });
      expect(profile!.heartFailureClass).toBeNull();
    });
  });

  describe("Audit Trail Scoping", () => {
    it("clinician1 can view patient1 profile history", async () => {
      const response = await request(testApp)
        .get(`/clinician/patients/${patient1}/profile/history`)
        .set("Authorization", `Bearer ${clinician1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.changes).toBeDefined();
    });

    it("clinician1 CANNOT view patient2 profile history (different clinic)", async () => {
      const response = await request(testApp)
        .get(`/clinician/patients/${patient2}/profile/history`)
        .set("Authorization", `Bearer ${clinician1Token}`);

      expect(response.status).toBe(404);
    });

    it("audit entries reference correct clinician", async () => {
      // Make a change as clinician1
      await request(testApp)
        .put(`/clinician/patients/${patient1}/profile`)
        .set("Authorization", `Bearer ${clinician1Token}`)
        .send({
          hasHypertension: true,
        });

      const audits = await prisma.patientProfileAudit.findMany({
        where: { patientId: patient1 },
        orderBy: { timestamp: "desc" },
        take: 1,
      });

      expect(audits[0].actorId).toBe(clinician1);
      expect(audits[0].actorType).toBe("CLINICIAN");
    });
  });

  describe("Patient Summary Scoping", () => {
    it("clinician1 can access patient1 summary", async () => {
      const response = await request(testApp)
        .get(`/clinician/patients/${patient1}/summary`)
        .set("Authorization", `Bearer ${clinician1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.enrollment.clinicId).toBe(clinic1);
    });

    it("clinician1 CANNOT access patient2 summary (different clinic)", async () => {
      const response = await request(testApp)
        .get(`/clinician/patients/${patient2}/summary`)
        .set("Authorization", `Bearer ${clinician1Token}`);

      expect(response.status).toBe(404);
    });
  });
});

describe("Multi-Clinic Patient with Different Care Plans", () => {
  let sharedPatient: string;
  let clinician1: string;
  let clinician2: string;
  let clinic1: string;
  let clinic2: string;
  let clinician1Token: string;
  let clinician2Token: string;

  beforeAll(async () => {
    // Create two clinics
    const c1 = await createTestClinic({
      name: "Multi Clinic One",
      slug: `multi-clinic-one-${Date.now()}`,
    });
    clinic1 = c1.id;

    const c2 = await createTestClinic({
      name: "Multi Clinic Two",
      slug: `multi-clinic-two-${Date.now()}`,
    });
    clinic2 = c2.id;

    // Create clinicians
    const clin1 = await createTestClinician({
      email: `multi-clinician1-${Date.now()}@test.com`,
      name: "Dr. Multi One",
    });
    clinician1 = clin1.id;
    clinician1Token = getClinicianToken(clinician1, clin1.email);

    const clin2 = await createTestClinician({
      email: `multi-clinician2-${Date.now()}@test.com`,
      name: "Dr. Multi Two",
    });
    clinician2 = clin2.id;
    clinician2Token = getClinicianToken(clinician2, clin2.email);

    await createClinicMembership(clinic1, clinician1, "CLINICIAN");
    await createClinicMembership(clinic2, clinician2, "CLINICIAN");

    // Create ONE patient enrolled in BOTH clinics
    const p = await createTestPatient({
      email: `shared-patient-${Date.now()}@test.com`,
      name: "Shared Patient",
    });
    sharedPatient = p.id;

    // Enroll patient in both clinics
    const e1 = await prisma.enrollment.create({
      data: {
        patientId: sharedPatient,
        clinicianId: clinician1,
        clinicId: clinic1,
        enrolledVia: "ADMIN",
        isPrimary: true,
      },
    });

    const e2 = await prisma.enrollment.create({
      data: {
        patientId: sharedPatient,
        clinicianId: clinician2,
        clinicId: clinic2,
        enrolledVia: "ADMIN",
        isPrimary: false,
      },
    });

    // Create DIFFERENT care plans for same patient at different clinics
    await prisma.carePlan.create({
      data: {
        enrollmentId: e1.id,
        dryWeightKg: 70.0,
        targetBpSystolic: { min: 100, max: 120 },
        notes: "Conservative targets - clinic one",
      },
    });

    await prisma.carePlan.create({
      data: {
        enrollmentId: e2.id,
        dryWeightKg: 72.0,
        targetBpSystolic: { min: 110, max: 140 },
        notes: "Different protocol - clinic two",
      },
    });

    // Create shared profile (patient-level, not enrollment-specific)
    await prisma.patientProfile.create({
      data: {
        patientId: sharedPatient,
        ckdStageClinician: "STAGE_4",
        ckdStageSetById: clinician1,
        ckdStageSetAt: new Date(),
        hasHeartFailure: true,
      },
    });
  });

  afterAll(async () => {
    await cleanupTestData();
    await disconnectPrisma();
  });

  it("same patient has different care plans per clinic", async () => {
    const response1 = await request(testApp)
      .get(`/clinician/patients/${sharedPatient}/care-plan`)
      .set("Authorization", `Bearer ${clinician1Token}`);

    const response2 = await request(testApp)
      .get(`/clinician/patients/${sharedPatient}/care-plan`)
      .set("Authorization", `Bearer ${clinician2Token}`);

    expect(response1.status).toBe(200);
    expect(response2.status).toBe(200);

    // Care plans should be DIFFERENT
    expect(response1.body.carePlan.dryWeightKg).toBe(70.0);
    expect(response2.body.carePlan.dryWeightKg).toBe(72.0);

    expect(response1.body.carePlan.targetBpSystolic).toEqual({ min: 100, max: 120 });
    expect(response2.body.carePlan.targetBpSystolic).toEqual({ min: 110, max: 140 });

    expect(response1.body.carePlan.notes).toBe("Conservative targets - clinic one");
    expect(response2.body.carePlan.notes).toBe("Different protocol - clinic two");
  });

  it("same patient has SAME profile for both clinicians", async () => {
    const response1 = await request(testApp)
      .get(`/clinician/patients/${sharedPatient}/profile`)
      .set("Authorization", `Bearer ${clinician1Token}`);

    const response2 = await request(testApp)
      .get(`/clinician/patients/${sharedPatient}/profile`)
      .set("Authorization", `Bearer ${clinician2Token}`);

    expect(response1.status).toBe(200);
    expect(response2.status).toBe(200);

    // Profile should be IDENTICAL (patient-level, not enrollment-specific)
    expect(response1.body.profile.ckdStageClinician).toBe(response2.body.profile.ckdStageClinician);
    expect(response1.body.profile.hasHeartFailure).toBe(response2.body.profile.hasHeartFailure);
  });

  it("clinician2 can update shared profile (both see change)", async () => {
    await request(testApp)
      .put(`/clinician/patients/${sharedPatient}/profile`)
      .set("Authorization", `Bearer ${clinician2Token}`)
      .send({
        diabetesType: "TYPE_2",
      });

    // Both clinicians should see the updated profile
    const response1 = await request(testApp)
      .get(`/clinician/patients/${sharedPatient}/profile`)
      .set("Authorization", `Bearer ${clinician1Token}`);

    expect(response1.body.profile.diabetesType).toBe("TYPE_2");
  });

  it("updating care plan in clinic1 does NOT affect clinic2", async () => {
    await request(testApp)
      .put(`/clinician/patients/${sharedPatient}/care-plan`)
      .set("Authorization", `Bearer ${clinician1Token}`)
      .send({
        dryWeightKg: 68.0,
      });

    // Clinic2 care plan should be unchanged
    const response2 = await request(testApp)
      .get(`/clinician/patients/${sharedPatient}/care-plan`)
      .set("Authorization", `Bearer ${clinician2Token}`);

    expect(response2.body.carePlan.dryWeightKg).toBe(72.0); // Unchanged
  });
});
