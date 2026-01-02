import { MeasurementType, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { logInteraction } from "./interaction.service.js";
import { evaluateRules } from "./alert.service.js";

export type CreateMeasurementInput = {
  patientId: string;
  type: MeasurementType;
  value: number;
  unit: string;
  source?: string;
  externalId?: string;
  timestamp?: Date;
};

export async function createMeasurement(input: CreateMeasurementInput) {
  const measurement = await prisma.measurement.create({
    data: {
      patientId: input.patientId,
      type: input.type,
      value: new Prisma.Decimal(input.value),
      unit: input.unit,
      source: input.source ?? "manual",
      externalId: input.externalId,
      timestamp: input.timestamp ?? new Date(),
    },
  });

  // Log interaction for RPM/CCM
  await logInteraction({
    patientId: input.patientId,
    interactionType: "PATIENT_MEASUREMENT",
    metadata: {
      measurementId: measurement.id,
      type: input.type,
    } as Prisma.InputJsonValue,
  });

  // Evaluate alert rules after measurement is recorded
  await evaluateRules(input.patientId, input.type);

  return measurement;
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
