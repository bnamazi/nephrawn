import { InteractionType, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export type LogInteractionInput = {
  patientId: string;
  clinicianId?: string;
  interactionType: InteractionType;
  durationSeconds?: number;
  metadata?: Prisma.InputJsonValue;
};

export async function logInteraction(input: LogInteractionInput): Promise<void> {
  await prisma.interactionLog.create({
    data: {
      patientId: input.patientId,
      clinicianId: input.clinicianId,
      interactionType: input.interactionType,
      durationSeconds: input.durationSeconds,
      metadata: input.metadata ?? Prisma.JsonNull,
    },
  });
}

export async function getInteractionsByPatient(
  patientId: string,
  options?: { from?: Date; to?: Date }
) {
  return prisma.interactionLog.findMany({
    where: {
      patientId,
      timestamp: {
        gte: options?.from,
        lte: options?.to,
      },
    },
    orderBy: { timestamp: "desc" },
  });
}
