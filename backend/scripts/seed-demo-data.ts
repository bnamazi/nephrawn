import "dotenv/config";
import bcrypt from "bcrypt";
import { prisma } from "../src/lib/prisma.js";

async function seedDemoData() {
  const patientEmail = "demo.patient@example.com";
  const patientPassword = "DemoPass123";
  const clinicianEmail = "demo.clinician@example.com";
  const clinicSlug = "demo-clinic";

  // Get clinic
  const clinic = await prisma.clinic.findUnique({ where: { slug: clinicSlug } });
  if (!clinic) {
    console.log("ERROR: Clinic not found. Run seed-clinician.ts first.");
    await prisma.$disconnect();
    return;
  }

  // Get or create patient
  let patient = await prisma.patient.findUnique({ where: { email: patientEmail } });
  if (!patient) {
    const passwordHash = await bcrypt.hash(patientPassword, 10);
    patient = await prisma.patient.create({
      data: {
        email: patientEmail,
        passwordHash,
        name: "Demo Patient",
        dateOfBirth: new Date("1985-03-15"),
      },
    });
    console.log("Created patient:", patientEmail);
  } else {
    console.log("Patient exists:", patientEmail);
  }

  // Get clinician
  const clinician = await prisma.clinician.findUnique({ where: { email: clinicianEmail } });
  if (!clinician) {
    console.log("ERROR: Clinician not found. Run seed-clinician.ts first.");
    await prisma.$disconnect();
    return;
  }

  // Create enrollment if not exists
  const existingEnrollment = await prisma.enrollment.findFirst({
    where: { patientId: patient.id, clinicianId: clinician.id, clinicId: clinic.id },
  });

  if (!existingEnrollment) {
    await prisma.enrollment.create({
      data: {
        patientId: patient.id,
        clinicianId: clinician.id,
        clinicId: clinic.id,
        enrolledVia: "MIGRATION",
      },
    });
    console.log("Created enrollment: patient -> clinician @ clinic");
  } else {
    console.log("Enrollment already exists");
  }

  // Add some measurements
  const now = new Date();
  const measurements = [
    { type: "WEIGHT", value: 72.5, unit: "kg", daysAgo: 0 },
    { type: "WEIGHT", value: 72.0, unit: "kg", daysAgo: 1 },
    { type: "WEIGHT", value: 71.5, unit: "kg", daysAgo: 2 },
    { type: "BP_SYSTOLIC", value: 125, unit: "mmHg", daysAgo: 0 },
    { type: "BP_DIASTOLIC", value: 82, unit: "mmHg", daysAgo: 0 },
    { type: "BP_SYSTOLIC", value: 130, unit: "mmHg", daysAgo: 1 },
    { type: "BP_DIASTOLIC", value: 85, unit: "mmHg", daysAgo: 1 },
  ];

  for (const m of measurements) {
    const timestamp = new Date(now.getTime() - m.daysAgo * 24 * 60 * 60 * 1000);
    await prisma.measurement.upsert({
      where: {
        id: `demo-${m.type}-${m.daysAgo}`,
      },
      create: {
        id: `demo-${m.type}-${m.daysAgo}`,
        patientId: patient.id,
        type: m.type as any,
        value: m.value,
        unit: m.unit,
        timestamp,
        source: "manual",
      },
      update: {},
    });
  }
  console.log("Added sample measurements");

  // Add an alert
  const existingAlert = await prisma.alert.findFirst({
    where: { patientId: patient.id, ruleId: "demo_alert" },
  });

  if (!existingAlert) {
    await prisma.alert.create({
      data: {
        patientId: patient.id,
        ruleId: "demo_alert",
        ruleName: "Demo Alert",
        severity: "WARNING",
        status: "OPEN",
        inputs: { message: "Sample alert for testing" },
      },
    });
    console.log("Created demo alert");
  }

  console.log("\n=== Demo Data Ready ===");
  console.log("Patient: demo.patient@example.com / DemoPass123");
  console.log("Clinician: demo.clinician@example.com / DemoPass123");
  console.log("Patient is enrolled with clinician");

  await prisma.$disconnect();
}

seedDemoData().catch(console.error);
