import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { logInteraction } from "./interaction.service.js";

// ============================================
// Input Types
// ============================================

export type CreateMedicationInput = {
  patientId: string;
  name: string;
  dosage?: string;
  frequency?: string;
  instructions?: string;
  startDate?: Date;
  endDate?: Date;
};

export type UpdateMedicationInput = {
  name?: string;
  dosage?: string;
  frequency?: string;
  instructions?: string;
  startDate?: Date;
  endDate?: Date;
  isActive?: boolean;
};

export type LogAdherenceInput = {
  medicationId: string;
  patientId: string;
  taken: boolean;
  notes?: string;
  scheduledFor?: Date;
};

// ============================================
// Patient Medication CRUD
// ============================================

/**
 * List medications for a patient
 * @param patientId - The patient's ID
 * @param includeInactive - Whether to include inactive medications (default: false)
 */
export async function listMedications(
  patientId: string,
  includeInactive = false
) {
  return prisma.medication.findMany({
    where: {
      patientId,
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: { createdAt: "desc" },
    include: {
      logs: {
        take: 1,
        orderBy: { loggedAt: "desc" },
      },
    },
  });
}

/**
 * Get a single medication by ID with ownership check
 */
export async function getMedication(medicationId: string, patientId: string) {
  const medication = await prisma.medication.findUnique({
    where: { id: medicationId },
    include: {
      logs: {
        take: 10,
        orderBy: { loggedAt: "desc" },
      },
    },
  });

  if (!medication || medication.patientId !== patientId) {
    return null;
  }

  return medication;
}

/**
 * Create a new medication for a patient
 */
export async function createMedication(input: CreateMedicationInput) {
  const medication = await prisma.medication.create({
    data: {
      patientId: input.patientId,
      name: input.name,
      dosage: input.dosage,
      frequency: input.frequency,
      instructions: input.instructions,
      startDate: input.startDate,
      endDate: input.endDate,
    },
  });

  // Log interaction for RPM/CCM
  await logInteraction({
    patientId: input.patientId,
    interactionType: "PATIENT_MEDICATION",
    metadata: {
      medicationId: medication.id,
      action: "create",
      medicationName: input.name,
    } as Prisma.InputJsonValue,
  });

  return medication;
}

/**
 * Update a medication with ownership check
 */
export async function updateMedication(
  medicationId: string,
  patientId: string,
  input: UpdateMedicationInput
) {
  // Verify ownership
  const existing = await prisma.medication.findUnique({
    where: { id: medicationId },
  });

  if (!existing || existing.patientId !== patientId) {
    return null;
  }

  const medication = await prisma.medication.update({
    where: { id: medicationId },
    data: {
      name: input.name,
      dosage: input.dosage,
      frequency: input.frequency,
      instructions: input.instructions,
      startDate: input.startDate,
      endDate: input.endDate,
      isActive: input.isActive,
    },
  });

  // Log interaction for RPM/CCM
  await logInteraction({
    patientId,
    interactionType: "PATIENT_MEDICATION",
    metadata: {
      medicationId: medication.id,
      action: "update",
      medicationName: medication.name,
    } as Prisma.InputJsonValue,
  });

  return medication;
}

/**
 * Soft delete a medication (set isActive = false)
 */
export async function deleteMedication(medicationId: string, patientId: string) {
  // Verify ownership
  const existing = await prisma.medication.findUnique({
    where: { id: medicationId },
  });

  if (!existing || existing.patientId !== patientId) {
    return false;
  }

  await prisma.medication.update({
    where: { id: medicationId },
    data: { isActive: false },
  });

  // Log interaction for RPM/CCM
  await logInteraction({
    patientId,
    interactionType: "PATIENT_MEDICATION",
    metadata: {
      medicationId,
      action: "delete",
      medicationName: existing.name,
    } as Prisma.InputJsonValue,
  });

  return true;
}

// ============================================
// Adherence Logging
// ============================================

/**
 * Log adherence for a medication
 */
export async function logAdherence(input: LogAdherenceInput) {
  // Verify medication ownership
  const medication = await prisma.medication.findUnique({
    where: { id: input.medicationId },
  });

  if (!medication || medication.patientId !== input.patientId) {
    return null;
  }

  const log = await prisma.medicationLog.create({
    data: {
      medicationId: input.medicationId,
      taken: input.taken,
      notes: input.notes,
      scheduledFor: input.scheduledFor,
    },
  });

  // Log interaction for RPM/CCM
  await logInteraction({
    patientId: input.patientId,
    interactionType: "PATIENT_ADHERENCE_LOG",
    metadata: {
      medicationLogId: log.id,
      medicationId: input.medicationId,
      medicationName: medication.name,
      taken: input.taken,
    } as Prisma.InputJsonValue,
  });

  return log;
}

/**
 * Get adherence logs for a medication
 */
export async function getAdherenceLogs(
  medicationId: string,
  patientId: string,
  options?: {
    limit?: number;
    offset?: number;
  }
) {
  // Verify medication ownership
  const medication = await prisma.medication.findUnique({
    where: { id: medicationId },
  });

  if (!medication || medication.patientId !== patientId) {
    return null;
  }

  return prisma.medicationLog.findMany({
    where: { medicationId },
    orderBy: { loggedAt: "desc" },
    take: options?.limit ?? 50,
    skip: options?.offset ?? 0,
  });
}

// ============================================
// Adherence Summary
// ============================================

/**
 * Get adherence summary for a patient's medications
 * @param patientId - The patient's ID
 * @param days - Number of days to look back (default: 30)
 */
export async function getAdherenceSummary(patientId: string, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  // Get all active medications for the patient
  const medications = await prisma.medication.findMany({
    where: {
      patientId,
      isActive: true,
    },
    include: {
      logs: {
        where: {
          loggedAt: { gte: since },
        },
        orderBy: { loggedAt: "desc" },
      },
    },
  });

  // Calculate overall adherence
  let totalLogs = 0;
  let takenCount = 0;
  let skippedCount = 0;

  for (const medication of medications) {
    for (const log of medication.logs) {
      totalLogs++;
      if (log.taken) {
        takenCount++;
      } else {
        skippedCount++;
      }
    }
  }

  const adherenceRate = totalLogs > 0 ? takenCount / totalLogs : 0;

  return {
    totalMedications: medications.length,
    totalLogs,
    takenCount,
    skippedCount,
    adherenceRate,
    days,
    medications: medications.map((med) => ({
      id: med.id,
      name: med.name,
      dosage: med.dosage,
      frequency: med.frequency,
      logsCount: med.logs.length,
      takenCount: med.logs.filter((l) => l.taken).length,
      skippedCount: med.logs.filter((l) => !l.taken).length,
      lastLog: med.logs[0] ?? null,
    })),
  };
}

// ============================================
// Clinician View
// ============================================

/**
 * Get medications for a patient (clinician access)
 * Verifies enrollment before returning data
 */
export async function getMedicationsForClinician(
  patientId: string,
  clinicianId: string,
  options?: {
    includeInactive?: boolean;
    limit?: number;
    offset?: number;
  }
) {
  // Verify enrollment
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      patientId,
      clinicianId,
    },
  });

  if (!enrollment || enrollment.status !== "ACTIVE") {
    return null;
  }

  // Log interaction for RPM/CCM
  await logInteraction({
    patientId,
    clinicianId,
    interactionType: "CLINICIAN_MEDICATION_VIEW",
    metadata: {
      endpoint: "GET /clinician/patients/:patientId/medications",
    } as Prisma.InputJsonValue,
  });

  return prisma.medication.findMany({
    where: {
      patientId,
      ...(options?.includeInactive ? {} : { isActive: true }),
    },
    orderBy: { createdAt: "desc" },
    take: options?.limit ?? 50,
    skip: options?.offset ?? 0,
    include: {
      logs: {
        take: 5,
        orderBy: { loggedAt: "desc" },
      },
    },
  });
}

/**
 * Get adherence summary for a patient (clinician access)
 */
export async function getAdherenceSummaryForClinician(
  patientId: string,
  clinicianId: string,
  days = 30
) {
  // Verify enrollment
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      patientId,
      clinicianId,
    },
  });

  if (!enrollment || enrollment.status !== "ACTIVE") {
    return null;
  }

  // Reuse patient summary logic
  return getAdherenceSummary(patientId, days);
}
