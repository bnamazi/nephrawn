import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { logInteraction } from "./interaction.service.js";

export type SymptomData = {
  edema?: { severity: number; location?: string };
  fatigue?: { severity: number };
  shortnessOfBreath?: { severity: number; atRest?: boolean };
  nausea?: { severity: number };
  appetite?: { level: number };
  pain?: { severity: number; location?: string };
};

export type CreateCheckinInput = {
  patientId: string;
  symptoms: SymptomData;
  notes?: string;
  timestamp?: Date;
};

export async function createCheckin(input: CreateCheckinInput) {
  const checkin = await prisma.symptomCheckin.create({
    data: {
      patientId: input.patientId,
      symptoms: input.symptoms as Prisma.InputJsonValue,
      notes: input.notes,
      timestamp: input.timestamp ?? new Date(),
    },
  });

  // Log interaction for RPM/CCM
  await logInteraction({
    patientId: input.patientId,
    interactionType: "PATIENT_CHECKIN",
    metadata: { checkinId: checkin.id } as Prisma.InputJsonValue,
  });

  return checkin;
}

export async function getCheckinsByPatient(
  patientId: string,
  options?: { limit?: number; offset?: number; from?: Date; to?: Date }
) {
  return prisma.symptomCheckin.findMany({
    where: {
      patientId,
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

export async function getCheckinById(id: string) {
  return prisma.symptomCheckin.findUnique({
    where: { id },
  });
}
