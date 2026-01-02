import { MeasurementType, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { logInteraction } from "./interaction.service.js";
import { evaluateRulesAtomic } from "./alert.service.js";
import { toCanonical, isValidUnit, CANONICAL_UNITS } from "../lib/units.js";

// Deduplication window for manual measurements (5 minutes)
const MANUAL_DEDUP_WINDOW_MS = 5 * 60 * 1000;

// Value tolerance for considering measurements as duplicates (0.1% or 0.1 absolute)
const VALUE_TOLERANCE_PERCENT = 0.001;
const VALUE_TOLERANCE_ABSOLUTE = 0.1;

export type CreateMeasurementInput = {
  patientId: string;
  type: MeasurementType;
  value: number;
  unit: string;
  source?: string;
  externalId?: string;
  timestamp?: Date;
};

export type CreateMeasurementResult = {
  measurement: Awaited<ReturnType<typeof prisma.measurement.create>>;
  isDuplicate: false;
  convertedFrom?: string;
} | {
  measurement: Awaited<ReturnType<typeof prisma.measurement.findFirst>>;
  isDuplicate: true;
};

/**
 * Create a measurement with:
 * - Unit normalization to canonical units
 * - Deduplication (device and manual)
 * - Atomic alert evaluation
 */
export async function createMeasurement(input: CreateMeasurementInput): Promise<CreateMeasurementResult> {
  const source = input.source ?? "manual";
  const timestamp = input.timestamp ?? new Date();

  // 1. Validate and convert unit
  if (!isValidUnit(input.type, input.unit)) {
    throw new Error(
      `Invalid unit "${input.unit}" for ${input.type}. ` +
      `Expected one of: kg, lbs for WEIGHT; mmHg for BP; % for SPO2; bpm for HEART_RATE`
    );
  }

  const converted = toCanonical(input.type, input.value, input.unit);
  if (!converted) {
    throw new Error(`Failed to convert ${input.value} ${input.unit} to canonical units`);
  }

  const canonicalValue = converted.value;
  const canonicalUnit = converted.canonicalUnit;
  const inputUnit = input.unit !== canonicalUnit ? input.unit : null;

  // 2. Check for duplicates
  // 2a. Device duplicates (source + externalId)
  if (source !== "manual" && input.externalId) {
    const existingDevice = await prisma.measurement.findFirst({
      where: {
        source,
        externalId: input.externalId,
      },
    });

    if (existingDevice) {
      return { measurement: existingDevice, isDuplicate: true };
    }
  }

  // 2b. Manual duplicates (same patient, type, similar value within time window)
  if (source === "manual") {
    const windowStart = new Date(timestamp.getTime() - MANUAL_DEDUP_WINDOW_MS);
    const windowEnd = new Date(timestamp.getTime() + MANUAL_DEDUP_WINDOW_MS);

    const recentMeasurements = await prisma.measurement.findMany({
      where: {
        patientId: input.patientId,
        type: input.type,
        source: "manual",
        timestamp: {
          gte: windowStart,
          lte: windowEnd,
        },
      },
    });

    for (const existing of recentMeasurements) {
      const existingValue = existing.value.toNumber();
      const tolerance = Math.max(
        existingValue * VALUE_TOLERANCE_PERCENT,
        VALUE_TOLERANCE_ABSOLUTE
      );

      if (Math.abs(existingValue - canonicalValue) <= tolerance) {
        return { measurement: existing, isDuplicate: true };
      }
    }
  }

  // 3. Create measurement and evaluate rules atomically using transaction
  const result = await prisma.$transaction(async (tx) => {
    const measurement = await tx.measurement.create({
      data: {
        patientId: input.patientId,
        type: input.type,
        value: new Prisma.Decimal(canonicalValue),
        unit: canonicalUnit,
        inputUnit,
        source,
        externalId: input.externalId,
        timestamp,
      },
    });

    // Log interaction within transaction
    await tx.interactionLog.create({
      data: {
        patientId: input.patientId,
        interactionType: "PATIENT_MEASUREMENT",
        metadata: {
          measurementId: measurement.id,
          type: input.type,
          canonicalValue,
          canonicalUnit,
          inputUnit: inputUnit ?? canonicalUnit,
        },
      },
    });

    return measurement;
  });

  // 4. Evaluate alert rules (outside transaction for isolation)
  // This uses its own transaction internally
  await evaluateRulesAtomic(input.patientId, input.type);

  return {
    measurement: result,
    isDuplicate: false,
    convertedFrom: inputUnit ?? undefined,
  };
}

/**
 * Legacy wrapper for backward compatibility
 * Returns just the measurement, throws on duplicate
 */
export async function createMeasurementLegacy(input: CreateMeasurementInput) {
  const result = await createMeasurement(input);
  return result.measurement;
}

export async function getMeasurementsByPatient(
  patientId: string,
  options?: {
    type?: MeasurementType;
    limit?: number;
    offset?: number;
    from?: Date;
    to?: Date;
  }
) {
  return prisma.measurement.findMany({
    where: {
      patientId,
      type: options?.type,
      timestamp: {
        gte: options?.from,
        lte: options?.to,
      },
    },
    orderBy: { timestamp: "desc" },
    take: options?.limit ?? 50,
    skip: options?.offset ?? 0,
  });
}

export async function getRecentMeasurements(
  patientId: string,
  type: MeasurementType,
  hoursBack: number
): Promise<Array<{ id: string; value: number; timestamp: Date }>> {
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

  const measurements = await prisma.measurement.findMany({
    where: {
      patientId,
      type,
      timestamp: { gte: since },
    },
    orderBy: { timestamp: "desc" },
    select: {
      id: true,
      value: true,
      timestamp: true,
    },
  });

  return measurements.map(m => ({
    id: m.id,
    value: m.value.toNumber(),
    timestamp: m.timestamp,
  }));
}
