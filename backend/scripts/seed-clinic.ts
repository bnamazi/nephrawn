import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";

async function seedClinic() {
  const clinicSlug = "demo-clinic";
  const clinicName = "Demo Nephrology Clinic";

  // Check if already exists
  const existing = await prisma.clinic.findUnique({ where: { slug: clinicSlug } });
  if (existing) {
    console.log("Clinic already exists:", clinicSlug);
    await prisma.$disconnect();
    return existing;
  }

  const clinic = await prisma.clinic.create({
    data: {
      name: clinicName,
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

  console.log("Created clinic:");
  console.log("  Name:", clinicName);
  console.log("  Slug:", clinicSlug);
  console.log("  ID:", clinic.id);

  await prisma.$disconnect();
  return clinic;
}

seedClinic().catch(console.error);
