import "dotenv/config";
import bcrypt from "bcrypt";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SALT_ROUNDS = 10;

async function main() {
  console.log("Seeding database...");

  // Create password hash (same for all test users)
  const passwordHash = await bcrypt.hash("password123", SALT_ROUNDS);

  // Create clinic
  const clinic = await prisma.clinic.upsert({
    where: { slug: "demo-clinic" },
    update: {},
    create: {
      name: "Demo Kidney Care Center",
      slug: "demo-clinic",
      phone: "(555) 123-4567",
      email: "info@demokidneycare.com",
      timezone: "America/New_York",
    },
  });

  console.log(`Created clinic: ${clinic.name}`);

  // Create clinicians
  const clinician1 = await prisma.clinician.upsert({
    where: { email: "clinician1@test.com" },
    update: {},
    create: {
      email: "clinician1@test.com",
      passwordHash,
      name: "Dr. Sarah Chen",
      role: "CLINICIAN",
    },
  });

  const clinician2 = await prisma.clinician.upsert({
    where: { email: "clinician2@test.com" },
    update: {},
    create: {
      email: "clinician2@test.com",
      passwordHash,
      name: "Dr. Michael Rivera",
      role: "CLINICIAN",
    },
  });

  console.log(`Created clinicians: ${clinician1.name}, ${clinician2.name}`);

  // Create clinic memberships
  await prisma.clinicMembership.upsert({
    where: {
      clinicId_clinicianId: {
        clinicId: clinic.id,
        clinicianId: clinician1.id,
      },
    },
    update: {},
    create: {
      clinicId: clinic.id,
      clinicianId: clinician1.id,
      role: "OWNER",
      status: "ACTIVE",
    },
  });

  await prisma.clinicMembership.upsert({
    where: {
      clinicId_clinicianId: {
        clinicId: clinic.id,
        clinicianId: clinician2.id,
      },
    },
    update: {},
    create: {
      clinicId: clinic.id,
      clinicianId: clinician2.id,
      role: "CLINICIAN",
      status: "ACTIVE",
    },
  });

  console.log("Created clinic memberships");

  // Create patients
  const patient1 = await prisma.patient.upsert({
    where: { email: "patient1@test.com" },
    update: {},
    create: {
      email: "patient1@test.com",
      passwordHash,
      name: "John Smith",
      dateOfBirth: new Date("1965-03-15"),
    },
  });

  const patient2 = await prisma.patient.upsert({
    where: { email: "patient2@test.com" },
    update: {},
    create: {
      email: "patient2@test.com",
      passwordHash,
      name: "Mary Johnson",
      dateOfBirth: new Date("1958-07-22"),
    },
  });

  const patient3 = await prisma.patient.upsert({
    where: { email: "patient3@test.com" },
    update: {},
    create: {
      email: "patient3@test.com",
      passwordHash,
      name: "Robert Williams",
      dateOfBirth: new Date("1972-11-08"),
    },
  });

  const patient4 = await prisma.patient.upsert({
    where: { email: "patient4@test.com" },
    update: {},
    create: {
      email: "patient4@test.com",
      passwordHash,
      name: "Patricia Brown",
      dateOfBirth: new Date("1968-04-30"),
    },
  });

  console.log(`Created patients: ${patient1.name}, ${patient2.name}, ${patient3.name}, ${patient4.name}`);

  // Create enrollments (now requires clinicId)
  // Clinician 1 -> Patient 1 (active, primary)
  await prisma.enrollment.upsert({
    where: {
      patientId_clinicianId_clinicId: {
        patientId: patient1.id,
        clinicianId: clinician1.id,
        clinicId: clinic.id,
      },
    },
    update: {},
    create: {
      patientId: patient1.id,
      clinicianId: clinician1.id,
      clinicId: clinic.id,
      status: "ACTIVE",
      isPrimary: true,
      enrolledVia: "MIGRATION",
    },
  });

  // Clinician 1 -> Patient 2 (active, primary)
  await prisma.enrollment.upsert({
    where: {
      patientId_clinicianId_clinicId: {
        patientId: patient2.id,
        clinicianId: clinician1.id,
        clinicId: clinic.id,
      },
    },
    update: {},
    create: {
      patientId: patient2.id,
      clinicianId: clinician1.id,
      clinicId: clinic.id,
      status: "ACTIVE",
      isPrimary: true,
      enrolledVia: "MIGRATION",
    },
  });

  // Clinician 1 -> Patient 3 (discharged)
  await prisma.enrollment.upsert({
    where: {
      patientId_clinicianId_clinicId: {
        patientId: patient3.id,
        clinicianId: clinician1.id,
        clinicId: clinic.id,
      },
    },
    update: {},
    create: {
      patientId: patient3.id,
      clinicianId: clinician1.id,
      clinicId: clinic.id,
      status: "DISCHARGED",
      isPrimary: true,
      enrolledVia: "MIGRATION",
      dischargedAt: new Date(),
    },
  });

  // Clinician 2 -> Patient 2 (active, non-primary - shared patient)
  await prisma.enrollment.upsert({
    where: {
      patientId_clinicianId_clinicId: {
        patientId: patient2.id,
        clinicianId: clinician2.id,
        clinicId: clinic.id,
      },
    },
    update: {},
    create: {
      patientId: patient2.id,
      clinicianId: clinician2.id,
      clinicId: clinic.id,
      status: "ACTIVE",
      isPrimary: false,
      enrolledVia: "MIGRATION",
    },
  });

  // Clinician 2 -> Patient 4 (active, primary)
  await prisma.enrollment.upsert({
    where: {
      patientId_clinicianId_clinicId: {
        patientId: patient4.id,
        clinicianId: clinician2.id,
        clinicId: clinic.id,
      },
    },
    update: {},
    create: {
      patientId: patient4.id,
      clinicianId: clinician2.id,
      clinicId: clinic.id,
      status: "ACTIVE",
      isPrimary: true,
      enrolledVia: "MIGRATION",
    },
  });

  console.log("Created enrollments");

  // Get enrollment IDs for care plan creation
  const enrollment1 = await prisma.enrollment.findFirst({
    where: { patientId: patient1.id, clinicianId: clinician1.id, clinicId: clinic.id },
  });
  const enrollment2 = await prisma.enrollment.findFirst({
    where: { patientId: patient2.id, clinicianId: clinician1.id, clinicId: clinic.id },
  });
  const enrollment4 = await prisma.enrollment.findFirst({
    where: { patientId: patient4.id, clinicianId: clinician2.id, clinicId: clinic.id },
  });

  // Create patient profiles
  await prisma.patientProfile.upsert({
    where: { patientId: patient1.id },
    update: {},
    create: {
      patientId: patient1.id,
      sex: "MALE",
      heightCm: 178,
      ckdStageSelfReported: "STAGE_4",
      ckdStageClinician: "STAGE_4",
      ckdStageSetById: clinician1.id,
      ckdStageSetAt: new Date(),
      primaryEtiology: "DIABETES",
      dialysisStatus: "NONE",
      hasHeartFailure: true,
      heartFailureClass: "CLASS_2",
      diabetesType: "TYPE_2",
      hasHypertension: true,
      onDiuretics: true,
      onAceArbInhibitor: true,
      onSglt2Inhibitor: true,
      onInsulin: true,
    },
  });

  await prisma.patientProfile.upsert({
    where: { patientId: patient2.id },
    update: {},
    create: {
      patientId: patient2.id,
      sex: "FEMALE",
      heightCm: 165,
      ckdStageSelfReported: "STAGE_3B",
      ckdStageClinician: "STAGE_3B",
      ckdStageSetById: clinician1.id,
      ckdStageSetAt: new Date(),
      primaryEtiology: "HYPERTENSION",
      dialysisStatus: "NONE",
      hasHeartFailure: false,
      diabetesType: "NONE",
      hasHypertension: true,
      onDiuretics: false,
      onAceArbInhibitor: true,
    },
  });

  await prisma.patientProfile.upsert({
    where: { patientId: patient4.id },
    update: {},
    create: {
      patientId: patient4.id,
      sex: "FEMALE",
      heightCm: 160,
      ckdStageSelfReported: "STAGE_5D",
      ckdStageClinician: "STAGE_5D",
      ckdStageSetById: clinician2.id,
      ckdStageSetAt: new Date(),
      primaryEtiology: "POLYCYSTIC",
      dialysisStatus: "HEMODIALYSIS",
      dialysisStartDate: new Date("2023-06-01"),
      hasHeartFailure: true,
      heartFailureClass: "CLASS_3",
      diabetesType: "NONE",
      hasHypertension: true,
      onDiuretics: true,
      onMra: true,
    },
  });

  console.log("Created patient profiles");

  // Create care plans for active enrollments
  if (enrollment1) {
    await prisma.carePlan.upsert({
      where: { enrollmentId: enrollment1.id },
      update: {},
      create: {
        enrollmentId: enrollment1.id,
        dryWeightKg: 85.0,
        targetBpSystolic: { min: 110, max: 130 },
        targetBpDiastolic: { min: 60, max: 80 },
        priorHfHospitalizations: 1,
        fluidRetentionRisk: true,
        fallsRisk: false,
        notes: "Monitor for fluid overload. Patient has history of peripheral edema.",
      },
    });
  }

  if (enrollment2) {
    await prisma.carePlan.upsert({
      where: { enrollmentId: enrollment2.id },
      update: {},
      create: {
        enrollmentId: enrollment2.id,
        dryWeightKg: 68.0,
        targetBpSystolic: { min: 100, max: 130 },
        targetBpDiastolic: { min: 60, max: 85 },
        fluidRetentionRisk: false,
        fallsRisk: false,
        notes: "Well-controlled BP. Continue current regimen.",
      },
    });
  }

  if (enrollment4) {
    await prisma.carePlan.upsert({
      where: { enrollmentId: enrollment4.id },
      update: {},
      create: {
        enrollmentId: enrollment4.id,
        dryWeightKg: 58.5,
        targetBpSystolic: { min: 100, max: 140 },
        targetBpDiastolic: { min: 60, max: 90 },
        priorHfHospitalizations: 2,
        fluidRetentionRisk: true,
        fallsRisk: true,
        notes: "HD patient. Strict fluid management. History of falls - mobility assessment recommended.",
      },
    });
  }

  console.log("Created care plans");

  // Create lab reports with realistic CKD data
  // Patient 1 (John Smith - CKD Stage 4) - Recent labs showing progression
  const labReport1 = await prisma.labReport.create({
    data: {
      patientId: patient1.id,
      collectedAt: new Date("2026-01-03"),
      reportedAt: new Date("2026-01-04"),
      labName: "Quest Diagnostics",
      orderingProvider: "Dr. Sarah Chen",
      source: "MANUAL_CLINICIAN",
      verifiedAt: new Date(),
      verifiedById: clinician1.id,
      results: {
        create: [
          {
            analyteName: "Creatinine",
            analyteCode: "2160-0",
            value: 3.2,
            unit: "mg/dL",
            referenceRangeLow: 0.7,
            referenceRangeHigh: 1.3,
            flag: "H",
          },
          {
            analyteName: "eGFR",
            analyteCode: "33914-3",
            value: 18,
            unit: "mL/min/1.73m2",
            referenceRangeLow: 60,
            referenceRangeHigh: 120,
            flag: "L",
          },
          {
            analyteName: "BUN",
            analyteCode: "3094-0",
            value: 42,
            unit: "mg/dL",
            referenceRangeLow: 7,
            referenceRangeHigh: 20,
            flag: "H",
          },
          {
            analyteName: "Potassium",
            analyteCode: "2823-3",
            value: 5.3,
            unit: "mEq/L",
            referenceRangeLow: 3.5,
            referenceRangeHigh: 5.0,
            flag: "H",
          },
          {
            analyteName: "Sodium",
            analyteCode: "2951-2",
            value: 138,
            unit: "mEq/L",
            referenceRangeLow: 136,
            referenceRangeHigh: 145,
            flag: null,
          },
          {
            analyteName: "CO2/Bicarbonate",
            analyteCode: "1963-8",
            value: 19,
            unit: "mEq/L",
            referenceRangeLow: 22,
            referenceRangeHigh: 29,
            flag: "L",
          },
          {
            analyteName: "Hemoglobin",
            analyteCode: "718-7",
            value: 10.2,
            unit: "g/dL",
            referenceRangeLow: 13.5,
            referenceRangeHigh: 17.5,
            flag: "L",
          },
          {
            analyteName: "Phosphorus",
            analyteCode: "2777-1",
            value: 5.8,
            unit: "mg/dL",
            referenceRangeLow: 2.5,
            referenceRangeHigh: 4.5,
            flag: "H",
          },
          {
            analyteName: "Calcium",
            analyteCode: "17861-6",
            value: 8.9,
            unit: "mg/dL",
            referenceRangeLow: 8.5,
            referenceRangeHigh: 10.5,
            flag: null,
          },
          {
            analyteName: "Albumin",
            analyteCode: "1751-7",
            value: 3.6,
            unit: "g/dL",
            referenceRangeLow: 3.5,
            referenceRangeHigh: 5.0,
            flag: null,
          },
        ],
      },
    },
  });

  // Patient 1 - Historical labs (3 months ago)
  const labReport2 = await prisma.labReport.create({
    data: {
      patientId: patient1.id,
      collectedAt: new Date("2025-10-01"),
      reportedAt: new Date("2025-10-02"),
      labName: "Quest Diagnostics",
      orderingProvider: "Dr. Sarah Chen",
      source: "MANUAL_CLINICIAN",
      verifiedAt: new Date("2025-10-03"),
      verifiedById: clinician1.id,
      results: {
        create: [
          {
            analyteName: "Creatinine",
            analyteCode: "2160-0",
            value: 2.9,
            unit: "mg/dL",
            referenceRangeLow: 0.7,
            referenceRangeHigh: 1.3,
            flag: "H",
          },
          {
            analyteName: "eGFR",
            analyteCode: "33914-3",
            value: 22,
            unit: "mL/min/1.73m2",
            referenceRangeLow: 60,
            referenceRangeHigh: 120,
            flag: "L",
          },
          {
            analyteName: "BUN",
            analyteCode: "3094-0",
            value: 38,
            unit: "mg/dL",
            referenceRangeLow: 7,
            referenceRangeHigh: 20,
            flag: "H",
          },
          {
            analyteName: "Potassium",
            analyteCode: "2823-3",
            value: 5.0,
            unit: "mEq/L",
            referenceRangeLow: 3.5,
            referenceRangeHigh: 5.0,
            flag: null,
          },
          {
            analyteName: "Hemoglobin",
            analyteCode: "718-7",
            value: 10.8,
            unit: "g/dL",
            referenceRangeLow: 13.5,
            referenceRangeHigh: 17.5,
            flag: "L",
          },
        ],
      },
    },
  });

  // Patient 2 (Mary Johnson - CKD Stage 3B) - Labs showing stable CKD
  const labReport3 = await prisma.labReport.create({
    data: {
      patientId: patient2.id,
      collectedAt: new Date("2025-12-15"),
      reportedAt: new Date("2025-12-16"),
      labName: "LabCorp",
      orderingProvider: "Dr. Sarah Chen",
      source: "MANUAL_CLINICIAN",
      verifiedAt: new Date("2025-12-17"),
      verifiedById: clinician1.id,
      results: {
        create: [
          {
            analyteName: "Creatinine",
            analyteCode: "2160-0",
            value: 1.8,
            unit: "mg/dL",
            referenceRangeLow: 0.6,
            referenceRangeHigh: 1.2,
            flag: "H",
          },
          {
            analyteName: "eGFR",
            analyteCode: "33914-3",
            value: 38,
            unit: "mL/min/1.73m2",
            referenceRangeLow: 60,
            referenceRangeHigh: 120,
            flag: "L",
          },
          {
            analyteName: "BUN",
            analyteCode: "3094-0",
            value: 28,
            unit: "mg/dL",
            referenceRangeLow: 7,
            referenceRangeHigh: 20,
            flag: "H",
          },
          {
            analyteName: "Potassium",
            analyteCode: "2823-3",
            value: 4.2,
            unit: "mEq/L",
            referenceRangeLow: 3.5,
            referenceRangeHigh: 5.0,
            flag: null,
          },
          {
            analyteName: "Hemoglobin",
            analyteCode: "718-7",
            value: 12.1,
            unit: "g/dL",
            referenceRangeLow: 12.0,
            referenceRangeHigh: 16.0,
            flag: null,
          },
          {
            analyteName: "ACR",
            analyteCode: "13705-9",
            value: 85,
            unit: "mg/g",
            referenceRangeLow: 0,
            referenceRangeHigh: 30,
            flag: "H",
          },
        ],
      },
    },
  });

  // Patient 4 (Patricia Brown - CKD Stage 5D on HD) - Pre-dialysis labs with critical values
  const labReport4 = await prisma.labReport.create({
    data: {
      patientId: patient4.id,
      collectedAt: new Date("2026-01-06"),
      reportedAt: new Date("2026-01-06"),
      labName: "Dialysis Center Lab",
      orderingProvider: "Dr. Michael Rivera",
      source: "MANUAL_CLINICIAN",
      verifiedAt: new Date(),
      verifiedById: clinician2.id,
      notes: "Pre-dialysis labs. Patient reported feeling fatigued.",
      results: {
        create: [
          {
            analyteName: "Creatinine",
            analyteCode: "2160-0",
            value: 8.5,
            unit: "mg/dL",
            referenceRangeLow: 0.6,
            referenceRangeHigh: 1.2,
            flag: "H",
          },
          {
            analyteName: "BUN",
            analyteCode: "3094-0",
            value: 72,
            unit: "mg/dL",
            referenceRangeLow: 7,
            referenceRangeHigh: 20,
            flag: "H",
          },
          {
            analyteName: "Potassium",
            analyteCode: "2823-3",
            value: 5.9,
            unit: "mEq/L",
            referenceRangeLow: 3.5,
            referenceRangeHigh: 5.0,
            flag: "C",
          },
          {
            analyteName: "Phosphorus",
            analyteCode: "2777-1",
            value: 7.2,
            unit: "mg/dL",
            referenceRangeLow: 2.5,
            referenceRangeHigh: 4.5,
            flag: "C",
          },
          {
            analyteName: "Hemoglobin",
            analyteCode: "718-7",
            value: 9.1,
            unit: "g/dL",
            referenceRangeLow: 12.0,
            referenceRangeHigh: 16.0,
            flag: "L",
          },
          {
            analyteName: "PTH",
            analyteCode: "2731-8",
            value: 485,
            unit: "pg/mL",
            referenceRangeLow: 10,
            referenceRangeHigh: 65,
            flag: "H",
          },
          {
            analyteName: "Calcium",
            analyteCode: "17861-6",
            value: 8.2,
            unit: "mg/dL",
            referenceRangeLow: 8.5,
            referenceRangeHigh: 10.5,
            flag: "L",
          },
        ],
      },
    },
  });

  // Patient 1 - Unverified lab (patient-entered)
  const labReport5 = await prisma.labReport.create({
    data: {
      patientId: patient1.id,
      collectedAt: new Date("2026-01-07"),
      labName: "Home Test Kit",
      source: "MANUAL_PATIENT",
      notes: "At-home ACR test",
      results: {
        create: [
          {
            analyteName: "ACR",
            analyteCode: "13705-9",
            value: 320,
            unit: "mg/g",
            referenceRangeLow: 0,
            referenceRangeHigh: 30,
            flag: "H",
          },
        ],
      },
    },
  });

  console.log("Created lab reports:", labReport1.id, labReport2.id, labReport3.id, labReport4.id, labReport5.id);

  // ============================================
  // Measurements (past 30 days)
  // ============================================
  const now = new Date();

  // Helper to create date X days ago
  const daysAgo = (days: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() - days);
    return date;
  };

  // Patient 1 (John Smith) - CKD Stage 4, showing weight gain trend (concerning)
  const patient1Measurements = [];
  for (let day = 30; day >= 0; day -= 2) {
    const baseWeight = 85 + (30 - day) * 0.15; // Gradual weight gain
    patient1Measurements.push(
      { type: "WEIGHT", value: baseWeight + Math.random() * 0.5, unit: "kg", timestamp: daysAgo(day), source: "withings" },
      { type: "BP_SYSTOLIC", value: 135 + Math.floor(Math.random() * 15), unit: "mmHg", timestamp: daysAgo(day), source: "withings" },
      { type: "BP_DIASTOLIC", value: 82 + Math.floor(Math.random() * 10), unit: "mmHg", timestamp: daysAgo(day), source: "withings" },
      { type: "HEART_RATE", value: 72 + Math.floor(Math.random() * 12), unit: "bpm", timestamp: daysAgo(day), source: "withings" },
      { type: "SPO2", value: 95 + Math.floor(Math.random() * 3), unit: "%", timestamp: daysAgo(day), source: "manual" }
    );
  }

  for (const m of patient1Measurements) {
    await prisma.measurement.create({
      data: { patientId: patient1.id, ...m },
    });
  }

  // Patient 2 (Mary Johnson) - CKD Stage 3B, stable
  const patient2Measurements = [];
  for (let day = 28; day >= 0; day -= 3) {
    patient2Measurements.push(
      { type: "WEIGHT", value: 68 + Math.random() * 0.8 - 0.4, unit: "kg", timestamp: daysAgo(day), source: "withings" },
      { type: "BP_SYSTOLIC", value: 125 + Math.floor(Math.random() * 10), unit: "mmHg", timestamp: daysAgo(day), source: "withings" },
      { type: "BP_DIASTOLIC", value: 78 + Math.floor(Math.random() * 8), unit: "mmHg", timestamp: daysAgo(day), source: "withings" },
      { type: "HEART_RATE", value: 68 + Math.floor(Math.random() * 10), unit: "bpm", timestamp: daysAgo(day), source: "withings" }
    );
  }

  for (const m of patient2Measurements) {
    await prisma.measurement.create({
      data: { patientId: patient2.id, ...m },
    });
  }

  // Patient 4 (Patricia Brown) - HD patient, more variable readings
  const patient4Measurements = [];
  for (let day = 21; day >= 0; day -= 1) {
    // HD patients have more weight variation (pre/post dialysis)
    const isDialysisDay = day % 2 === 0;
    const weightVariation = isDialysisDay ? -2 : 1.5;
    patient4Measurements.push(
      { type: "WEIGHT", value: 58.5 + weightVariation + Math.random(), unit: "kg", timestamp: daysAgo(day), source: "withings" },
      { type: "BP_SYSTOLIC", value: 145 + Math.floor(Math.random() * 20) - 10, unit: "mmHg", timestamp: daysAgo(day), source: "withings" },
      { type: "BP_DIASTOLIC", value: 88 + Math.floor(Math.random() * 12) - 6, unit: "mmHg", timestamp: daysAgo(day), source: "withings" },
      { type: "HEART_RATE", value: 78 + Math.floor(Math.random() * 15), unit: "bpm", timestamp: daysAgo(day), source: "withings" }
    );
  }

  for (const m of patient4Measurements) {
    await prisma.measurement.create({
      data: { patientId: patient4.id, ...m },
    });
  }

  console.log("Created measurements for patients 1, 2, and 4");

  // ============================================
  // Symptom Check-ins
  // ============================================

  // Patient 1 - Worsening symptoms (edema, fatigue)
  await prisma.symptomCheckin.createMany({
    data: [
      {
        patientId: patient1.id,
        timestamp: daysAgo(14),
        symptoms: { edema: { severity: 1, location: "ankles" }, fatigue: { severity: 1 }, appetite: { level: 2 } },
        notes: "Slight swelling noticed in the evening",
      },
      {
        patientId: patient1.id,
        timestamp: daysAgo(7),
        symptoms: { edema: { severity: 2, location: "ankles and feet" }, fatigue: { severity: 2 }, shortnessOfBreath: { severity: 1, atRest: false }, appetite: { level: 2 } },
        notes: "Swelling worse, feeling more tired than usual",
      },
      {
        patientId: patient1.id,
        timestamp: daysAgo(2),
        symptoms: { edema: { severity: 2, location: "lower legs" }, fatigue: { severity: 2 }, shortnessOfBreath: { severity: 1, atRest: false }, appetite: { level: 1 } },
        notes: "Swelling moving up legs, reduced appetite",
      },
    ],
  });

  // Patient 2 - Stable, minimal symptoms
  await prisma.symptomCheckin.createMany({
    data: [
      {
        patientId: patient2.id,
        timestamp: daysAgo(10),
        symptoms: { fatigue: { severity: 1 }, appetite: { level: 3 } },
      },
      {
        patientId: patient2.id,
        timestamp: daysAgo(3),
        symptoms: { fatigue: { severity: 0 }, appetite: { level: 3 } },
        notes: "Feeling good this week",
      },
    ],
  });

  // Patient 4 - HD patient with variable symptoms
  await prisma.symptomCheckin.createMany({
    data: [
      {
        patientId: patient4.id,
        timestamp: daysAgo(12),
        symptoms: { fatigue: { severity: 2 }, nausea: { severity: 1 }, appetite: { level: 1 } },
        notes: "Tired after dialysis",
      },
      {
        patientId: patient4.id,
        timestamp: daysAgo(5),
        symptoms: { fatigue: { severity: 3 }, shortnessOfBreath: { severity: 2, atRest: true }, edema: { severity: 1, location: "hands" } },
        notes: "Very fatigued, some trouble breathing when lying down",
      },
      {
        patientId: patient4.id,
        timestamp: daysAgo(1),
        symptoms: { fatigue: { severity: 2 }, appetite: { level: 2 } },
        notes: "Feeling better after adjusting dialysis schedule",
      },
    ],
  });

  console.log("Created symptom check-ins");

  // ============================================
  // Alerts
  // ============================================

  // Patient 1 - Weight gain alert (CRITICAL) - notified
  await prisma.alert.create({
    data: {
      patientId: patient1.id,
      triggeredAt: daysAgo(3),
      ruleId: "weight_gain_48h",
      ruleName: "Rapid Weight Gain",
      severity: "CRITICAL",
      status: "OPEN",
      inputs: {
        currentWeight: 87.5,
        previousWeight: 85.2,
        changeKg: 2.3,
        windowHours: 48,
        threshold: 2.0
      },
      summaryText: "Patient gained 2.3 kg in 48 hours, exceeding the 2.0 kg threshold. This may indicate fluid retention.",
      lastNotifiedAt: daysAgo(3), // Email notification sent when alert was created
    },
  });

  // Patient 1 - BP alert (WARNING) - acknowledged
  await prisma.alert.create({
    data: {
      patientId: patient1.id,
      triggeredAt: daysAgo(7),
      ruleId: "bp_elevated",
      ruleName: "Elevated Blood Pressure",
      severity: "WARNING",
      status: "ACKNOWLEDGED",
      acknowledgedBy: clinician1.id,
      acknowledgedAt: daysAgo(6),
      inputs: { systolic: 148, diastolic: 92, targetSystolicMax: 130, targetDiastolicMax: 80 },
      summaryText: "Blood pressure 148/92 exceeds target range.",
    },
  });

  // Patient 4 - Critical potassium (from labs) - notified
  await prisma.alert.create({
    data: {
      patientId: patient4.id,
      triggeredAt: daysAgo(1),
      ruleId: "lab_critical",
      ruleName: "Critical Lab Value",
      severity: "CRITICAL",
      status: "OPEN",
      inputs: { analyte: "Potassium", value: 5.9, unit: "mEq/L", referenceMax: 5.0 },
      summaryText: "Critical potassium level of 5.9 mEq/L detected. Immediate review recommended.",
      lastNotifiedAt: daysAgo(1), // Email notification sent when alert was created
    },
  });

  // Patient 4 - Symptom alert (WARNING)
  await prisma.alert.create({
    data: {
      patientId: patient4.id,
      triggeredAt: daysAgo(5),
      ruleId: "symptom_worsening",
      ruleName: "Worsening Symptoms",
      severity: "WARNING",
      status: "DISMISSED",
      acknowledgedBy: clinician2.id,
      acknowledgedAt: daysAgo(4),
      inputs: { symptoms: ["fatigue", "shortnessOfBreath"], severityIncrease: true },
      summaryText: "Patient reported worsening fatigue (severe) and shortness of breath at rest.",
    },
  });

  console.log("Created alerts");

  // ============================================
  // Notification Logs (email history)
  // ============================================

  // Get alert IDs for notification log entries
  const weightAlert2 = await prisma.alert.findFirst({
    where: { patientId: patient1.id, ruleId: "weight_gain_48h" },
  });
  const potassiumAlert = await prisma.alert.findFirst({
    where: { patientId: patient4.id, ruleId: "lab_critical" },
  });

  if (weightAlert2) {
    await prisma.notificationLog.create({
      data: {
        clinicianId: clinician1.id,
        patientId: patient1.id,
        alertId: weightAlert2.id,
        channel: "EMAIL",
        status: "SENT",
        recipient: clinician1.email,
        subject: "[CRITICAL] Rapid Weight Gain - John Smith",
        sentAt: daysAgo(3),
      },
    });
  }

  if (potassiumAlert) {
    await prisma.notificationLog.create({
      data: {
        clinicianId: clinician2.id,
        patientId: patient4.id,
        alertId: potassiumAlert.id,
        channel: "EMAIL",
        status: "SENT",
        recipient: clinician2.email,
        subject: "[CRITICAL] Critical Lab Value - Patricia Brown",
        sentAt: daysAgo(1),
      },
    });
  }

  console.log("Created notification logs");

  // ============================================
  // Time Entries (RPM/CCM billing)
  // ============================================

  // Clinician 1 - Time entries for Patient 1
  await prisma.timeEntry.createMany({
    data: [
      {
        patientId: patient1.id,
        clinicianId: clinician1.id,
        clinicId: clinic.id,
        entryDate: daysAgo(10),
        durationMinutes: 15,
        activity: "PATIENT_REVIEW",
        notes: "Reviewed weight trend and BP readings",
      },
      {
        patientId: patient1.id,
        clinicianId: clinician1.id,
        clinicId: clinic.id,
        entryDate: daysAgo(7),
        durationMinutes: 20,
        activity: "PHONE_CALL",
        notes: "Called patient about elevated BP, discussed medication adherence",
      },
      {
        patientId: patient1.id,
        clinicianId: clinician1.id,
        clinicId: clinic.id,
        entryDate: daysAgo(3),
        durationMinutes: 10,
        activity: "PATIENT_REVIEW",
        notes: "Reviewed critical weight gain alert",
      },
      {
        patientId: patient1.id,
        clinicianId: clinician1.id,
        clinicId: clinic.id,
        entryDate: daysAgo(2),
        durationMinutes: 25,
        activity: "CARE_PLAN_UPDATE",
        notes: "Updated fluid restriction guidance, adjusted diuretic timing",
      },
      {
        patientId: patient1.id,
        clinicianId: clinician1.id,
        clinicId: clinic.id,
        entryDate: daysAgo(1),
        durationMinutes: 15,
        activity: "COORDINATION",
        notes: "Coordinated with nephrology for urgent follow-up",
      },
    ],
  });

  // Clinician 1 - Time entries for Patient 2
  await prisma.timeEntry.createMany({
    data: [
      {
        patientId: patient2.id,
        clinicianId: clinician1.id,
        clinicId: clinic.id,
        entryDate: daysAgo(14),
        durationMinutes: 10,
        activity: "PATIENT_REVIEW",
        notes: "Routine review - all metrics stable",
      },
      {
        patientId: patient2.id,
        clinicianId: clinician1.id,
        clinicId: clinic.id,
        entryDate: daysAgo(5),
        durationMinutes: 15,
        activity: "DOCUMENTATION",
        notes: "Updated care documentation for quarterly review",
      },
    ],
  });

  // Clinician 2 - Time entries for Patient 4
  await prisma.timeEntry.createMany({
    data: [
      {
        patientId: patient4.id,
        clinicianId: clinician2.id,
        clinicId: clinic.id,
        entryDate: daysAgo(12),
        durationMinutes: 20,
        activity: "PATIENT_REVIEW",
        notes: "Post-dialysis review, patient reporting fatigue",
      },
      {
        patientId: patient4.id,
        clinicianId: clinician2.id,
        clinicId: clinic.id,
        entryDate: daysAgo(6),
        durationMinutes: 30,
        activity: "PHONE_CALL",
        notes: "Called patient about worsening symptoms, recommended dialysis schedule adjustment",
      },
      {
        patientId: patient4.id,
        clinicianId: clinician2.id,
        clinicId: clinic.id,
        entryDate: daysAgo(5),
        durationMinutes: 15,
        activity: "COORDINATION",
        notes: "Coordinated with dialysis center about schedule change",
      },
      {
        patientId: patient4.id,
        clinicianId: clinician2.id,
        clinicId: clinic.id,
        entryDate: daysAgo(1),
        durationMinutes: 10,
        activity: "PATIENT_REVIEW",
        notes: "Reviewed critical potassium alert from recent labs",
      },
    ],
  });

  console.log("Created time entries");

  // ============================================
  // Clinician Notes
  // ============================================

  // Get the weight gain alert for linking
  const weightAlert = await prisma.alert.findFirst({
    where: { patientId: patient1.id, ruleId: "weight_gain_48h" },
  });

  await prisma.clinicianNote.createMany({
    data: [
      {
        patientId: patient1.id,
        clinicianId: clinician1.id,
        alertId: weightAlert?.id,
        content: "Patient shows concerning weight gain pattern. Will increase monitoring frequency and consider diuretic adjustment if trend continues.",
      },
      {
        patientId: patient1.id,
        clinicianId: clinician1.id,
        content: "Discussed dietary sodium intake with patient. Provided educational materials on fluid management.",
      },
      {
        patientId: patient4.id,
        clinicianId: clinician2.id,
        content: "Adjusted dialysis schedule from MWF to TThS to better accommodate patient work schedule. Will monitor for improved symptom control.",
      },
    ],
  });

  console.log("Created clinician notes");

  console.log("\n--- Test Credentials ---");
  console.log("Clinician 1: clinician1@test.com / password123");
  console.log("Clinician 2: clinician2@test.com / password123");
  console.log("Patient 1:   patient1@test.com / password123 (DOB: 1965-03-15)");
  console.log("Patient 2:   patient2@test.com / password123 (DOB: 1958-07-22)");
  console.log("Patient 3:   patient3@test.com / password123 (DOB: 1972-11-08)");
  console.log("Patient 4:   patient4@test.com / password123 (DOB: 1968-04-30)");
  console.log("\n--- Expected Behavior ---");
  console.log("Clinician 1 sees: Patient 1, Patient 2 (active)");
  console.log("Clinician 1 does NOT see: Patient 3 (discharged), Patient 4 (not enrolled)");
  console.log("Clinician 2 sees: Patient 2 (shared), Patient 4");
  console.log("Clinician 2 does NOT see: Patient 1, Patient 3");

  console.log("\nSeeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
