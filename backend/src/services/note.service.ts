import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { logInteraction } from "./interaction.service.js";

export type CreateNoteInput = {
  patientId: string;
  clinicianId: string;
  alertId?: string;
  content: string;
};

export async function createNote(input: CreateNoteInput) {
  // Verify clinician is enrolled with this patient
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      patientId: input.patientId,
      clinicianId: input.clinicianId,
    },
  });

  if (!enrollment || enrollment.status !== "ACTIVE") {
    return null;
  }

  // If alertId provided, verify it belongs to this patient
  if (input.alertId) {
    const alert = await prisma.alert.findUnique({
      where: { id: input.alertId },
    });

    if (!alert || alert.patientId !== input.patientId) {
      return null;
    }
  }

  const note = await prisma.clinicianNote.create({
    data: {
      patientId: input.patientId,
      clinicianId: input.clinicianId,
      alertId: input.alertId,
      content: input.content,
    },
    include: {
      clinician: {
        select: { id: true, name: true },
      },
      alert: {
        select: { id: true, ruleId: true, ruleName: true },
      },
    },
  });

  // Log interaction for RPM/CCM
  await logInteraction({
    patientId: input.patientId,
    clinicianId: input.clinicianId,
    interactionType: "CLINICIAN_NOTE",
    metadata: {
      noteId: note.id,
      alertId: input.alertId,
    } as Prisma.InputJsonValue,
  });

  return note;
}

export async function getNotesByPatient(
  patientId: string,
  clinicianId: string,
  options?: {
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

  return prisma.clinicianNote.findMany({
    where: { patientId },
    orderBy: { createdAt: "desc" },
    take: options?.limit ?? 50,
    skip: options?.offset ?? 0,
    include: {
      clinician: {
        select: { id: true, name: true },
      },
      alert: {
        select: { id: true, ruleId: true, ruleName: true },
      },
    },
  });
}

export async function getNotesByAlert(
  alertId: string,
  clinicianId: string
) {
  // Get the alert and verify enrollment
  const alert = await prisma.alert.findUnique({
    where: { id: alertId },
  });

  if (!alert) {
    return null;
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      patientId: alert.patientId,
      clinicianId,
    },
  });

  if (!enrollment || enrollment.status !== "ACTIVE") {
    return null;
  }

  return prisma.clinicianNote.findMany({
    where: { alertId },
    orderBy: { createdAt: "desc" },
    include: {
      clinician: {
        select: { id: true, name: true },
      },
    },
  });
}

export async function getNoteById(noteId: string, clinicianId: string) {
  const note = await prisma.clinicianNote.findUnique({
    where: { id: noteId },
    include: {
      clinician: {
        select: { id: true, name: true },
      },
      alert: {
        select: { id: true, ruleId: true, ruleName: true, severity: true },
      },
    },
  });

  if (!note) {
    return null;
  }

  // Verify enrollment
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      patientId: note.patientId,
      clinicianId,
    },
  });

  if (!enrollment || enrollment.status !== "ACTIVE") {
    return null;
  }

  return note;
}

export async function updateNote(
  noteId: string,
  clinicianId: string,
  content: string
) {
  // Only the author can update their note
  const note = await prisma.clinicianNote.findUnique({
    where: { id: noteId },
  });

  if (!note || note.clinicianId !== clinicianId) {
    return null;
  }

  return prisma.clinicianNote.update({
    where: { id: noteId },
    data: { content },
    include: {
      clinician: {
        select: { id: true, name: true },
      },
      alert: {
        select: { id: true, ruleId: true, ruleName: true },
      },
    },
  });
}

export async function deleteNote(noteId: string, clinicianId: string) {
  // Only the author can delete their note
  const note = await prisma.clinicianNote.findUnique({
    where: { id: noteId },
  });

  if (!note || note.clinicianId !== clinicianId) {
    return false;
  }

  await prisma.clinicianNote.delete({
    where: { id: noteId },
  });

  return true;
}
