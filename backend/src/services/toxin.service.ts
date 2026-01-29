import { ToxinRiskLevel } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export type UpdateToxinRecordInput = {
  isEducated?: boolean;
  lastExposureDate?: Date | null;
  exposureNotes?: string | null;
  riskOverride?: ToxinRiskLevel | null;
  notes?: string | null;
};

/**
 * Get all active toxin categories
 */
export async function getToxinCategories() {
  return prisma.kidneyToxinCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

/**
 * Get patient's toxin records with category info
 */
export async function getPatientToxinRecords(
  patientId: string,
  clinicianId: string
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

  return prisma.patientToxinRecord.findMany({
    where: { patientId },
    include: {
      toxinCategory: true,
      educatedBy: {
        select: { id: true, name: true },
      },
    },
    orderBy: {
      toxinCategory: { sortOrder: "asc" },
    },
  });
}

/**
 * Create or update a patient toxin record
 */
export async function upsertPatientToxinRecord(
  patientId: string,
  categoryId: string,
  clinicianId: string,
  data: UpdateToxinRecordInput
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

  // Verify category exists and is active
  const category = await prisma.kidneyToxinCategory.findUnique({
    where: { id: categoryId },
  });

  if (!category || !category.isActive) {
    return null;
  }

  // Check if record exists
  const existingRecord = await prisma.patientToxinRecord.findUnique({
    where: {
      patientId_toxinCategoryId: {
        patientId,
        toxinCategoryId: categoryId,
      },
    },
  });

  // Prepare update data
  const updateData: Record<string, unknown> = {};

  if (data.isEducated !== undefined) {
    updateData.isEducated = data.isEducated;
    // If marking as educated, set the educated metadata
    if (data.isEducated && !existingRecord?.isEducated) {
      updateData.educatedAt = new Date();
      updateData.educatedById = clinicianId;
    }
    // If unmarking as educated, clear the metadata
    if (!data.isEducated) {
      updateData.educatedAt = null;
      updateData.educatedById = null;
    }
  }

  if (data.lastExposureDate !== undefined) {
    updateData.lastExposureDate = data.lastExposureDate;
  }

  if (data.exposureNotes !== undefined) {
    updateData.exposureNotes = data.exposureNotes;
  }

  if (data.riskOverride !== undefined) {
    updateData.riskOverride = data.riskOverride;
  }

  if (data.notes !== undefined) {
    updateData.notes = data.notes;
  }

  const record = await prisma.patientToxinRecord.upsert({
    where: {
      patientId_toxinCategoryId: {
        patientId,
        toxinCategoryId: categoryId,
      },
    },
    create: {
      patientId,
      toxinCategoryId: categoryId,
      isEducated: data.isEducated ?? false,
      educatedAt: data.isEducated ? new Date() : null,
      educatedById: data.isEducated ? clinicianId : null,
      lastExposureDate: data.lastExposureDate ?? null,
      exposureNotes: data.exposureNotes ?? null,
      riskOverride: data.riskOverride ?? null,
      notes: data.notes ?? null,
    },
    update: updateData,
    include: {
      toxinCategory: true,
      educatedBy: {
        select: { id: true, name: true },
      },
    },
  });

  return record;
}

/**
 * Mark patient as educated on a specific toxin category
 */
export async function markPatientEducated(
  patientId: string,
  categoryId: string,
  clinicianId: string
) {
  return upsertPatientToxinRecord(patientId, categoryId, clinicianId, {
    isEducated: true,
  });
}

/**
 * Get patient toxin records for patient-facing view (read-only)
 */
export async function getPatientToxinRecordsForPatient(patientId: string) {
  return prisma.patientToxinRecord.findMany({
    where: { patientId },
    include: {
      toxinCategory: {
        select: {
          id: true,
          name: true,
          description: true,
          examples: true,
          riskLevel: true,
        },
      },
    },
    orderBy: {
      toxinCategory: { sortOrder: "asc" },
    },
  });
}
