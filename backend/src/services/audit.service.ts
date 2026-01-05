import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";

export type AuditAction =
  | "invite.created"
  | "invite.revoked"
  | "invite.claimed"
  | "invite.expired"
  | "enrollment.created"
  | "enrollment.discharged"
  | "enrollment.self_discharged"
  | "clinic.created"
  | "clinic.updated"
  | "clinic.membership.added"
  | "clinic.membership.removed";

export type ActorType = "clinician" | "patient" | "system";

export type AuditLogInput = {
  action: AuditAction;
  actorType: ActorType;
  actorId?: string;
  resourceType: string;
  resourceId: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
};

/**
 * Log an auditable action
 * This is a fire-and-forget operation - failures are logged but don't propagate
 */
export async function logAudit(input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        actorType: input.actorType,
        actorId: input.actorId,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        metadata: input.metadata ?? {},
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  } catch (error) {
    // Log the error but don't fail the operation
    logger.error(
      { err: error, auditInput: input },
      "Failed to write audit log"
    );
  }
}

/**
 * Query audit logs for a specific resource
 */
export async function getAuditLogs(options: {
  resourceType?: string;
  resourceId?: string;
  actorType?: ActorType;
  actorId?: string;
  action?: AuditAction;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const where: Record<string, unknown> = {};

  if (options.resourceType) where.resourceType = options.resourceType;
  if (options.resourceId) where.resourceId = options.resourceId;
  if (options.actorType) where.actorType = options.actorType;
  if (options.actorId) where.actorId = options.actorId;
  if (options.action) where.action = options.action;

  if (options.startDate || options.endDate) {
    where.createdAt = {};
    if (options.startDate) {
      (where.createdAt as Record<string, Date>).gte = options.startDate;
    }
    if (options.endDate) {
      (where.createdAt as Record<string, Date>).lte = options.endDate;
    }
  }

  return prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: options.limit ?? 50,
    skip: options.offset ?? 0,
  });
}

/**
 * Get audit history for an invite
 */
export async function getInviteAuditHistory(inviteId: string) {
  return getAuditLogs({
    resourceType: "invite",
    resourceId: inviteId,
    limit: 100,
  });
}

/**
 * Get audit history for an enrollment
 */
export async function getEnrollmentAuditHistory(enrollmentId: string) {
  return getAuditLogs({
    resourceType: "enrollment",
    resourceId: enrollmentId,
    limit: 100,
  });
}
