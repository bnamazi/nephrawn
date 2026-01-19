import { TimeEntryActivity } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export interface CreateTimeEntryInput {
  patientId: string;
  clinicianId: string;
  clinicId: string;
  entryDate: Date;
  durationMinutes: number;
  activity: TimeEntryActivity;
  notes?: string;
}

export interface UpdateTimeEntryInput {
  entryDate?: Date;
  durationMinutes?: number;
  activity?: TimeEntryActivity;
  notes?: string | null;
}

export interface TimeEntryFilters {
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Create a new time entry for a patient.
 * Returns null if clinician is not enrolled with the patient.
 */
export async function createTimeEntry(input: CreateTimeEntryInput) {
  // Verify enrollment exists
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      patientId: input.patientId,
      clinicianId: input.clinicianId,
      clinicId: input.clinicId,
      status: "ACTIVE",
    },
  });

  if (!enrollment) {
    return null;
  }

  // Validate duration
  if (input.durationMinutes < 1 || input.durationMinutes > 120) {
    throw new Error("Duration must be between 1 and 120 minutes");
  }

  // Validate entry date (not future, max 7 days old)
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const entryDate = new Date(input.entryDate);

  if (entryDate > now) {
    throw new Error("Entry date cannot be in the future");
  }

  if (entryDate < sevenDaysAgo) {
    throw new Error("Entry date cannot be more than 7 days in the past");
  }

  const timeEntry = await prisma.timeEntry.create({
    data: {
      patientId: input.patientId,
      clinicianId: input.clinicianId,
      clinicId: input.clinicId,
      entryDate: input.entryDate,
      durationMinutes: input.durationMinutes,
      activity: input.activity,
      notes: input.notes,
    },
    include: {
      patient: {
        select: { id: true, name: true },
      },
      clinician: {
        select: { id: true, name: true },
      },
    },
  });

  return timeEntry;
}

/**
 * Get time entries for a patient.
 * Returns null if clinician is not enrolled with the patient.
 */
export async function getTimeEntriesForPatient(
  patientId: string,
  clinicianId: string,
  filters: TimeEntryFilters = {}
) {
  // Verify enrollment exists
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      patientId,
      clinicianId,
      status: "ACTIVE",
    },
  });

  if (!enrollment) {
    return null;
  }

  const { from, to, limit = 50, offset = 0 } = filters;

  const where: Record<string, unknown> = { patientId };

  if (from || to) {
    where.entryDate = {};
    if (from) (where.entryDate as Record<string, Date>).gte = from;
    if (to) (where.entryDate as Record<string, Date>).lte = to;
  }

  const timeEntries = await prisma.timeEntry.findMany({
    where,
    include: {
      clinician: {
        select: { id: true, name: true },
      },
    },
    orderBy: { entryDate: "desc" },
    take: limit,
    skip: offset,
  });

  return timeEntries;
}

/**
 * Get a single time entry by ID.
 * Returns null if not found or clinician doesn't have access.
 */
export async function getTimeEntryById(
  timeEntryId: string,
  clinicianId: string
) {
  const timeEntry = await prisma.timeEntry.findUnique({
    where: { id: timeEntryId },
    include: {
      patient: {
        select: { id: true, name: true },
      },
      clinician: {
        select: { id: true, name: true },
      },
    },
  });

  if (!timeEntry) {
    return null;
  }

  // Check if requesting clinician is enrolled with this patient
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      patientId: timeEntry.patientId,
      clinicianId,
      status: "ACTIVE",
    },
  });

  if (!enrollment) {
    return null;
  }

  return timeEntry;
}

/**
 * Update a time entry.
 * Only the clinician who created it can update it.
 */
export async function updateTimeEntry(
  timeEntryId: string,
  clinicianId: string,
  input: UpdateTimeEntryInput
) {
  // Find the time entry and verify ownership
  const existing = await prisma.timeEntry.findUnique({
    where: { id: timeEntryId },
  });

  if (!existing || existing.clinicianId !== clinicianId) {
    return null;
  }

  // Validate duration if provided
  if (input.durationMinutes !== undefined) {
    if (input.durationMinutes < 1 || input.durationMinutes > 120) {
      throw new Error("Duration must be between 1 and 120 minutes");
    }
  }

  // Validate entry date if provided
  if (input.entryDate !== undefined) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const entryDate = new Date(input.entryDate);

    if (entryDate > now) {
      throw new Error("Entry date cannot be in the future");
    }

    if (entryDate < sevenDaysAgo) {
      throw new Error("Entry date cannot be more than 7 days in the past");
    }
  }

  const timeEntry = await prisma.timeEntry.update({
    where: { id: timeEntryId },
    data: {
      ...(input.entryDate !== undefined && { entryDate: input.entryDate }),
      ...(input.durationMinutes !== undefined && { durationMinutes: input.durationMinutes }),
      ...(input.activity !== undefined && { activity: input.activity }),
      ...(input.notes !== undefined && { notes: input.notes }),
    },
    include: {
      patient: {
        select: { id: true, name: true },
      },
      clinician: {
        select: { id: true, name: true },
      },
    },
  });

  return timeEntry;
}

/**
 * Delete a time entry.
 * Only the clinician who created it can delete it.
 */
export async function deleteTimeEntry(
  timeEntryId: string,
  clinicianId: string
) {
  // Find the time entry and verify ownership
  const existing = await prisma.timeEntry.findUnique({
    where: { id: timeEntryId },
  });

  if (!existing || existing.clinicianId !== clinicianId) {
    return false;
  }

  await prisma.timeEntry.delete({
    where: { id: timeEntryId },
  });

  return true;
}

/**
 * Get time entry summary for a patient in a date range.
 * Useful for billing summaries.
 */
export async function getTimeEntrySummary(
  patientId: string,
  clinicianId: string,
  from: Date,
  to: Date
) {
  // Verify enrollment exists
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      patientId,
      clinicianId,
      status: "ACTIVE",
    },
  });

  if (!enrollment) {
    return null;
  }

  const entries = await prisma.timeEntry.findMany({
    where: {
      patientId,
      entryDate: {
        gte: from,
        lte: to,
      },
    },
    select: {
      durationMinutes: true,
      activity: true,
      clinicianId: true,
    },
  });

  const totalMinutes = entries.reduce((sum, e) => sum + e.durationMinutes, 0);

  const byActivity = entries.reduce((acc, e) => {
    acc[e.activity] = (acc[e.activity] || 0) + e.durationMinutes;
    return acc;
  }, {} as Record<string, number>);

  const byClinician = entries.reduce((acc, e) => {
    acc[e.clinicianId] = (acc[e.clinicianId] || 0) + e.durationMinutes;
    return acc;
  }, {} as Record<string, number>);

  return {
    totalMinutes,
    entryCount: entries.length,
    byActivity,
    byClinician,
    period: { from, to },
  };
}
