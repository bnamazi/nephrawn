import crypto from "crypto";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";
import { InviteStatus } from "@prisma/client";
import { logInteraction } from "./interaction.service.js";
import { logAudit } from "./audit.service.js";

const INVITE_CODE_LENGTH = 40;
const INVITE_EXPIRY_DAYS = 7;

/**
 * Generate a cryptographically secure invite code
 * 40 characters alphanumeric = ~10^48 combinations
 */
export function generateInviteCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.randomBytes(INVITE_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

export type CreateInviteInput = {
  clinicId: string;
  clinicianId: string;
  patientName: string;
  patientDob: Date;
  patientEmail?: string;
  expiresInDays?: number;
};

export type CreateInviteResult =
  | { success: true; invite: Awaited<ReturnType<typeof prisma.invite.create>> }
  | { success: false; error: string };

/**
 * Create a new patient invite
 */
export async function createInvite(input: CreateInviteInput): Promise<CreateInviteResult> {
  // Verify clinician has membership in this clinic
  const membership = await prisma.clinicMembership.findUnique({
    where: {
      clinicId_clinicianId: {
        clinicId: input.clinicId,
        clinicianId: input.clinicianId,
      },
    },
  });

  if (!membership || membership.status !== "ACTIVE") {
    return { success: false, error: "Not authorized to create invites for this clinic" };
  }

  // Generate unique code (retry if collision, though extremely unlikely)
  let code: string;
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    code = generateInviteCode();
    const existing = await prisma.invite.findUnique({ where: { code } });
    if (!existing) break;
    attempts++;
  }

  if (attempts >= maxAttempts) {
    return { success: false, error: "Failed to generate unique invite code" };
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (input.expiresInDays ?? INVITE_EXPIRY_DAYS));

  const invite = await prisma.invite.create({
    data: {
      code: code!,
      clinicId: input.clinicId,
      createdById: input.clinicianId,
      patientName: input.patientName,
      patientDob: input.patientDob,
      patientEmail: input.patientEmail,
      expiresAt,
    },
    include: {
      clinic: {
        select: { id: true, name: true },
      },
      createdBy: {
        select: { id: true, name: true },
      },
    },
  });

  // Audit log - fire and forget
  logAudit({
    action: "invite.created",
    actorType: "clinician",
    actorId: input.clinicianId,
    resourceType: "invite",
    resourceId: invite.id,
    metadata: {
      clinicId: input.clinicId,
      clinicName: invite.clinic.name,
      patientEmail: input.patientEmail ?? null,
      expiresAt: expiresAt.toISOString(),
    },
  });

  return { success: true, invite };
}

/**
 * Get invite by code (public endpoint - returns minimal info)
 * Does not expose patient name/DOB for privacy
 */
export async function getInviteByCode(code: string) {
  const invite = await prisma.invite.findUnique({
    where: { code },
    include: {
      clinic: {
        select: { id: true, name: true },
      },
    },
  });

  if (!invite) {
    return null;
  }

  // Check if expired
  if (invite.status === "PENDING" && invite.expiresAt < new Date()) {
    // Auto-expire
    await prisma.invite.update({
      where: { id: invite.id },
      data: { status: "EXPIRED" },
    });
    return { valid: false, reason: "expired" as const };
  }

  if (invite.status !== "PENDING") {
    return { valid: false, reason: invite.status.toLowerCase() as "claimed" | "expired" | "revoked" };
  }

  return {
    valid: true,
    clinicName: invite.clinic.name,
    clinicId: invite.clinic.id,
    expiresAt: invite.expiresAt,
  };
}

/**
 * Get full invite details (for internal use / claiming)
 */
export async function getInviteDetails(code: string) {
  const invite = await prisma.invite.findUnique({
    where: { code },
    include: {
      clinic: {
        select: { id: true, name: true },
      },
      createdBy: {
        select: { id: true, name: true },
      },
    },
  });

  if (!invite) {
    return null;
  }

  // Check if expired
  if (invite.status === "PENDING" && invite.expiresAt < new Date()) {
    await prisma.invite.update({
      where: { id: invite.id },
      data: { status: "EXPIRED" },
    });
    return { ...invite, status: "EXPIRED" as InviteStatus };
  }

  return invite;
}

/**
 * List pending invites for a clinic
 */
export async function listPendingInvites(
  clinicId: string,
  clinicianId: string,
  options?: { limit?: number; offset?: number; includeExpired?: boolean }
) {
  // Verify membership
  const membership = await prisma.clinicMembership.findUnique({
    where: {
      clinicId_clinicianId: {
        clinicId,
        clinicianId,
      },
    },
  });

  if (!membership || membership.status !== "ACTIVE") {
    return null;
  }

  const statusFilter: InviteStatus[] = options?.includeExpired
    ? ["PENDING", "EXPIRED"]
    : ["PENDING"];

  const invites = await prisma.invite.findMany({
    where: {
      clinicId,
      status: { in: statusFilter },
    },
    orderBy: { createdAt: "desc" },
    take: options?.limit ?? 50,
    skip: options?.offset ?? 0,
    include: {
      createdBy: {
        select: { id: true, name: true },
      },
    },
  });

  // Auto-expire any pending invites that are past expiration
  const now = new Date();
  const expiredIds = invites
    .filter((inv) => inv.status === "PENDING" && inv.expiresAt < now)
    .map((inv) => inv.id);

  if (expiredIds.length > 0) {
    await prisma.invite.updateMany({
      where: { id: { in: expiredIds } },
      data: { status: "EXPIRED" },
    });
  }

  // Return with corrected status
  return invites.map((inv) => ({
    ...inv,
    status: expiredIds.includes(inv.id) ? ("EXPIRED" as InviteStatus) : inv.status,
  }));
}

/**
 * Revoke a pending invite
 */
export async function revokeInvite(
  inviteId: string,
  clinicianId: string
): Promise<{ success: boolean; error?: string }> {
  const invite = await prisma.invite.findUnique({
    where: { id: inviteId },
  });

  if (!invite) {
    return { success: false, error: "Invite not found" };
  }

  // Verify membership in the clinic
  const membership = await prisma.clinicMembership.findUnique({
    where: {
      clinicId_clinicianId: {
        clinicId: invite.clinicId,
        clinicianId,
      },
    },
  });

  if (!membership || membership.status !== "ACTIVE") {
    return { success: false, error: "Not authorized to revoke invites for this clinic" };
  }

  if (invite.status !== "PENDING") {
    return { success: false, error: `Cannot revoke invite with status: ${invite.status}` };
  }

  await prisma.invite.update({
    where: { id: inviteId },
    data: { status: "REVOKED" },
  });

  // Audit log - fire and forget
  logAudit({
    action: "invite.revoked",
    actorType: "clinician",
    actorId: clinicianId,
    resourceType: "invite",
    resourceId: inviteId,
    metadata: {
      clinicId: invite.clinicId,
    },
  });

  return { success: true };
}

/**
 * Count invites created by a clinician today (for rate limiting)
 */
export async function countTodayInvites(clinicianId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  return prisma.invite.count({
    where: {
      createdById: clinicianId,
      createdAt: { gte: startOfDay },
    },
  });
}

/**
 * Get invite statistics for a clinic
 */
export async function getInviteStats(clinicId: string, clinicianId: string) {
  // Verify membership
  const membership = await prisma.clinicMembership.findUnique({
    where: {
      clinicId_clinicianId: {
        clinicId,
        clinicianId,
      },
    },
  });

  if (!membership || membership.status !== "ACTIVE") {
    return null;
  }

  const [pending, claimed, expired, revoked] = await Promise.all([
    prisma.invite.count({ where: { clinicId, status: "PENDING" } }),
    prisma.invite.count({ where: { clinicId, status: "CLAIMED" } }),
    prisma.invite.count({ where: { clinicId, status: "EXPIRED" } }),
    prisma.invite.count({ where: { clinicId, status: "REVOKED" } }),
  ]);

  return { pending, claimed, expired, revoked, total: pending + claimed + expired + revoked };
}

// ============================================
// Claim Flow
// ============================================

export type ClaimInviteInput = {
  code: string;
  dateOfBirth: Date;
  // If patient already has account, pass their ID
  existingPatientId?: string;
  // For new patient registration
  newPatient?: {
    email: string;
    password: string;
    name: string;
  };
};

export type ClaimInviteResult =
  | {
      success: true;
      patient: { id: string; email: string; name: string };
      clinic: { id: string; name: string };
      enrollment: { id: string };
      isNewPatient: boolean;
    }
  | { success: false; error: string; code?: string };

/**
 * Claim an invite - creates patient (if needed) and enrollment
 */
export async function claimInvite(input: ClaimInviteInput): Promise<ClaimInviteResult> {
  // Get invite details
  const invite = await getInviteDetails(input.code);

  if (!invite) {
    return { success: false, error: "Invite not found", code: "NOT_FOUND" };
  }

  if (invite.status !== "PENDING") {
    return {
      success: false,
      error: `Invite is no longer valid: ${invite.status.toLowerCase()}`,
      code: invite.status,
    };
  }

  // Verify DOB matches (compare date only, not time)
  const inviteDob = new Date(invite.patientDob);
  const inputDob = new Date(input.dateOfBirth);

  const dobMatches =
    inviteDob.getFullYear() === inputDob.getFullYear() &&
    inviteDob.getMonth() === inputDob.getMonth() &&
    inviteDob.getDate() === inputDob.getDate();

  if (!dobMatches) {
    return {
      success: false,
      error: "Date of birth does not match",
      code: "DOB_MISMATCH",
    };
  }

  // Determine patient - existing or new
  let patient: { id: string; email: string; name: string };
  let isNewPatient = false;

  if (input.existingPatientId) {
    // Use existing patient
    const existingPatient = await prisma.patient.findUnique({
      where: { id: input.existingPatientId },
      select: { id: true, email: true, name: true, dateOfBirth: true },
    });

    if (!existingPatient) {
      return { success: false, error: "Patient not found", code: "PATIENT_NOT_FOUND" };
    }

    // Verify DOB matches existing patient's DOB
    const patientDob = new Date(existingPatient.dateOfBirth);
    const patientDobMatches =
      patientDob.getFullYear() === inputDob.getFullYear() &&
      patientDob.getMonth() === inputDob.getMonth() &&
      patientDob.getDate() === inputDob.getDate();

    if (!patientDobMatches) {
      return {
        success: false,
        error: "Date of birth does not match your account",
        code: "DOB_MISMATCH",
      };
    }

    patient = existingPatient;
  } else if (input.newPatient) {
    // Create new patient
    // Check if email already exists
    const existingByEmail = await prisma.patient.findUnique({
      where: { email: input.newPatient.email },
    });

    if (existingByEmail) {
      return {
        success: false,
        error: "An account with this email already exists. Please log in first.",
        code: "EMAIL_EXISTS",
      };
    }

    // Hash password
    const passwordHash = await bcrypt.hash(input.newPatient.password, 10);

    // Create patient
    const newPatient = await prisma.patient.create({
      data: {
        email: input.newPatient.email,
        passwordHash,
        name: input.newPatient.name,
        dateOfBirth: input.dateOfBirth,
      },
      select: { id: true, email: true, name: true },
    });

    patient = newPatient;
    isNewPatient = true;
  } else {
    return {
      success: false,
      error: "Must provide either existing patient ID or new patient details",
      code: "INVALID_INPUT",
    };
  }

  // Check if already enrolled in this clinic
  const existingEnrollment = await prisma.enrollment.findFirst({
    where: {
      patientId: patient.id,
      clinicId: invite.clinicId,
      status: "ACTIVE",
    },
  });

  if (existingEnrollment) {
    return {
      success: false,
      error: "You are already enrolled in this clinic",
      code: "ALREADY_ENROLLED",
    };
  }

  // Create enrollment and update invite in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create enrollment
    const enrollment = await tx.enrollment.create({
      data: {
        patientId: patient.id,
        clinicianId: invite.createdById,
        clinicId: invite.clinicId,
        enrolledVia: "INVITE",
        inviteId: invite.id,
      },
    });

    // Mark invite as claimed
    await tx.invite.update({
      where: { id: invite.id },
      data: {
        status: "CLAIMED",
        claimedById: patient.id,
        claimedAt: new Date(),
      },
    });

    return enrollment;
  });

  // Log interaction (outside transaction for non-critical operation)
  try {
    await logInteraction({
      patientId: patient.id,
      clinicianId: invite.createdById,
      interactionType: "PATIENT_CHECKIN",
      metadata: {
        action: "invite_claimed",
        inviteId: invite.id,
        isNewPatient,
      },
    });
  } catch {
    // Non-critical, don't fail the claim
  }

  // Audit logs - fire and forget
  logAudit({
    action: "invite.claimed",
    actorType: "patient",
    actorId: patient.id,
    resourceType: "invite",
    resourceId: invite.id,
    metadata: {
      clinicId: invite.clinicId,
      clinicName: invite.clinic.name,
      isNewPatient,
    },
  });

  logAudit({
    action: "enrollment.created",
    actorType: "patient",
    actorId: patient.id,
    resourceType: "enrollment",
    resourceId: result.id,
    metadata: {
      clinicId: invite.clinicId,
      clinicName: invite.clinic.name,
      clinicianId: invite.createdById,
      inviteId: invite.id,
      enrolledVia: "INVITE",
    },
  });

  return {
    success: true,
    patient: { id: patient.id, email: patient.email, name: patient.name },
    clinic: { id: invite.clinic.id, name: invite.clinic.name },
    enrollment: { id: result.id },
    isNewPatient,
  };
}

/**
 * Track failed claim attempts for rate limiting
 * Returns the number of failed attempts in the last hour
 */
const claimAttempts = new Map<string, { count: number; resetAt: number }>();

export function recordClaimAttempt(ipAddress: string): void {
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;
  const existing = claimAttempts.get(ipAddress);

  if (existing && existing.resetAt > now) {
    existing.count++;
  } else {
    claimAttempts.set(ipAddress, { count: 1, resetAt: now + hourMs });
  }
}

export function getClaimAttempts(ipAddress: string): number {
  const now = Date.now();
  const existing = claimAttempts.get(ipAddress);

  if (!existing || existing.resetAt <= now) {
    return 0;
  }

  return existing.count;
}

export function clearClaimAttempts(ipAddress: string): void {
  claimAttempts.delete(ipAddress);
}
