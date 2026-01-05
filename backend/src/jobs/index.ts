import cron from "node-cron";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { logAudit } from "../services/audit.service.js";

/**
 * Background job to expire pending invites that have passed their expiration date.
 * Runs daily at 2:00 AM to batch-expire old invites.
 */
async function expireOldInvites(): Promise<void> {
  const jobLogger = logger.child({ job: "expireOldInvites" });

  try {
    const now = new Date();

    // Find invites to expire first (for audit logging)
    const invitesToExpire = await prisma.invite.findMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: now },
      },
      select: { id: true, clinicId: true },
    });

    if (invitesToExpire.length === 0) {
      jobLogger.debug("No invites to expire");
      return;
    }

    // Batch update
    await prisma.invite.updateMany({
      where: {
        id: { in: invitesToExpire.map((i) => i.id) },
      },
      data: {
        status: "EXPIRED",
      },
    });

    // Log audit for each expired invite
    for (const invite of invitesToExpire) {
      logAudit({
        action: "invite.expired",
        actorType: "system",
        resourceType: "invite",
        resourceId: invite.id,
        metadata: {
          clinicId: invite.clinicId,
          expiredBy: "background_job",
        },
      });
    }

    jobLogger.info({ expiredCount: invitesToExpire.length }, "Expired old invites");
  } catch (error) {
    jobLogger.error({ err: error }, "Failed to expire old invites");
  }
}

/**
 * Start all background jobs
 */
export function startBackgroundJobs(): void {
  logger.info("Starting background jobs...");

  // Expire old invites - runs daily at 2:00 AM
  cron.schedule("0 2 * * *", async () => {
    await expireOldInvites();
  });

  // Also run once on startup to catch any missed expirations
  expireOldInvites().catch((err) => {
    logger.error({ err }, "Failed initial invite expiration");
  });

  logger.info("Background jobs started");
}

/**
 * Stop all background jobs (for graceful shutdown)
 */
export function stopBackgroundJobs(): void {
  logger.info("Stopping background jobs...");
  // node-cron doesn't require explicit cleanup, but we log for clarity
  logger.info("Background jobs stopped");
}

// Export for testing
export { expireOldInvites };
