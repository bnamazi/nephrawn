/**
 * Data Migration: Fix incorrectly stored weight measurements
 *
 * Issue: Some weight measurements were stored with lbs values directly as kg
 * (without unit conversion). For example, 180 lbs was stored as 180 kg.
 *
 * Fix: Identify measurements with unreasonably high kg values (> 150 kg) where
 * inputUnit is null (indicating no conversion was applied), and convert them
 * by multiplying by 0.453592 (lbs to kg).
 *
 * Run: npx tsx prisma/migrations/fix-weight-data.ts
 */

import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "@prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const LBS_TO_KG = 0.453592;
// Threshold: 150 kg (330 lbs) - unreasonably high for typical CKD patient weight
const SUSPICIOUS_THRESHOLD_KG = 150;

async function main() {
  console.log("🔍 Finding incorrectly stored weight measurements...\n");

  // Find weight measurements with suspiciously high values and no inputUnit
  const suspiciousMeasurements = await prisma.measurement.findMany({
    where: {
      type: "WEIGHT",
      value: { gt: SUSPICIOUS_THRESHOLD_KG },
      inputUnit: null, // No conversion was applied
    },
    include: {
      patient: {
        select: { name: true },
      },
    },
    orderBy: { timestamp: "asc" },
  });

  if (suspiciousMeasurements.length === 0) {
    console.log("✅ No incorrectly stored measurements found.");
    return;
  }

  console.log(`Found ${suspiciousMeasurements.length} suspicious measurements:\n`);

  for (const m of suspiciousMeasurements) {
    const oldValueKg = m.value.toNumber();
    const newValueKg = Number((oldValueKg * LBS_TO_KG).toFixed(4));
    const displayLbs = Number((newValueKg / LBS_TO_KG).toFixed(1));

    console.log(`  Patient: ${m.patient.name}`);
    console.log(`    ID: ${m.id}`);
    console.log(`    Timestamp: ${m.timestamp.toISOString()}`);
    console.log(`    Old value: ${oldValueKg} kg (displays as ${(oldValueKg / LBS_TO_KG).toFixed(1)} lbs - WRONG)`);
    console.log(`    New value: ${newValueKg} kg (displays as ${displayLbs} lbs - FIXED)\n`);
  }

  // Ask for confirmation
  console.log("This will update the above measurements.");
  console.log("Run with --apply to apply the fix.\n");

  if (process.argv.includes("--apply")) {
    console.log("Applying fix...\n");

    for (const m of suspiciousMeasurements) {
      const oldValueKg = m.value.toNumber();
      const newValueKg = Number((oldValueKg * LBS_TO_KG).toFixed(4));

      await prisma.measurement.update({
        where: { id: m.id },
        data: {
          value: new Prisma.Decimal(newValueKg),
          inputUnit: "lbs", // Mark as converted
        },
      });

      console.log(`  ✅ Fixed measurement ${m.id}: ${oldValueKg} -> ${newValueKg} kg`);
    }

    console.log(`\n✅ Fixed ${suspiciousMeasurements.length} measurements.`);
  }
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
