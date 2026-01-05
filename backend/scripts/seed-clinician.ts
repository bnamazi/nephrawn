import "dotenv/config";
import bcrypt from "bcrypt";
import { prisma } from "../src/lib/prisma.js";

async function seedClinician() {
  const email = "demo.clinician@example.com";
  const password = "DemoPass123";
  const name = "Dr. Demo Clinician";
  const clinicSlug = "demo-clinic";

  // Ensure clinic exists
  let clinic = await prisma.clinic.findUnique({ where: { slug: clinicSlug } });
  if (!clinic) {
    clinic = await prisma.clinic.create({
      data: {
        name: "Demo Nephrology Clinic",
        slug: clinicSlug,
        phone: "(555) 123-4567",
        address: {
          street: "123 Medical Center Drive",
          city: "San Francisco",
          state: "CA",
          zip: "94102",
        },
      },
    });
    console.log("Created clinic:", clinicSlug);
  }

  // Check if clinician already exists
  let clinician = await prisma.clinician.findUnique({ where: { email } });
  if (clinician) {
    console.log("Clinician already exists:", email);
  } else {
    const passwordHash = await bcrypt.hash(password, 10);
    clinician = await prisma.clinician.create({
      data: {
        email,
        passwordHash,
        name,
        role: "CLINICIAN",
      },
    });
    console.log("Created clinician:", email);
  }

  // Create clinic membership if not exists
  const existingMembership = await prisma.clinicMembership.findUnique({
    where: {
      clinicId_clinicianId: {
        clinicId: clinic.id,
        clinicianId: clinician.id,
      },
    },
  });

  if (!existingMembership) {
    await prisma.clinicMembership.create({
      data: {
        clinicId: clinic.id,
        clinicianId: clinician.id,
        role: "OWNER",
      },
    });
    console.log("Created clinic membership: clinician -> clinic (OWNER)");
  } else {
    console.log("Clinic membership already exists");
  }

  console.log("\n=== Clinician Ready ===");
  console.log("Email:", email);
  console.log("Password:", password);
  console.log("Clinic:", clinic.name);

  await prisma.$disconnect();
}

seedClinician().catch(console.error);
