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

  // Create enrollments
  // Clinician 1 -> Patient 1 (active, primary)
  await prisma.enrollment.upsert({
    where: {
      patientId_clinicianId: {
        patientId: patient1.id,
        clinicianId: clinician1.id,
      },
    },
    update: {},
    create: {
      patientId: patient1.id,
      clinicianId: clinician1.id,
      status: "ACTIVE",
      isPrimary: true,
    },
  });

  // Clinician 1 -> Patient 2 (active, primary)
  await prisma.enrollment.upsert({
    where: {
      patientId_clinicianId: {
        patientId: patient2.id,
        clinicianId: clinician1.id,
      },
    },
    update: {},
    create: {
      patientId: patient2.id,
      clinicianId: clinician1.id,
      status: "ACTIVE",
      isPrimary: true,
    },
  });

  // Clinician 1 -> Patient 3 (discharged)
  await prisma.enrollment.upsert({
    where: {
      patientId_clinicianId: {
        patientId: patient3.id,
        clinicianId: clinician1.id,
      },
    },
    update: {},
    create: {
      patientId: patient3.id,
      clinicianId: clinician1.id,
      status: "DISCHARGED",
      isPrimary: true,
      dischargedAt: new Date(),
    },
  });

  // Clinician 2 -> Patient 2 (active, non-primary - shared patient)
  await prisma.enrollment.upsert({
    where: {
      patientId_clinicianId: {
        patientId: patient2.id,
        clinicianId: clinician2.id,
      },
    },
    update: {},
    create: {
      patientId: patient2.id,
      clinicianId: clinician2.id,
      status: "ACTIVE",
      isPrimary: false,
    },
  });

  // Clinician 2 -> Patient 4 (active, primary)
  await prisma.enrollment.upsert({
    where: {
      patientId_clinicianId: {
        patientId: patient4.id,
        clinicianId: clinician2.id,
      },
    },
    update: {},
    create: {
      patientId: patient4.id,
      clinicianId: clinician2.id,
      status: "ACTIVE",
      isPrimary: true,
    },
  });

  console.log("Created enrollments");

  console.log("\n--- Test Credentials ---");
  console.log("Clinician 1: clinician1@test.com / password123");
  console.log("Clinician 2: clinician2@test.com / password123");
  console.log("Patient 1:   patient1@test.com / password123");
  console.log("Patient 2:   patient2@test.com / password123");
  console.log("Patient 3:   patient3@test.com / password123");
  console.log("Patient 4:   patient4@test.com / password123");
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
