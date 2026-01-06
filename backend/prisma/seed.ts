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
