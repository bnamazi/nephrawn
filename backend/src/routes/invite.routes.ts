import { Router, Request, Response } from "express";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";
import { requireActiveMembership } from "../middleware/clinicMembership.middleware.js";
import {
  createInvite,
  getInviteByCode,
  listPendingInvites,
  revokeInvite,
  countTodayInvites,
  getInviteStats,
  claimInvite,
  recordClaimAttempt,
  getClaimAttempts,
  clearClaimAttempts,
} from "../services/invite.service.js";
import { signToken } from "../lib/jwt.js";

const router = Router();

// Rate limit: 50 invites per clinician per day
const DAILY_INVITE_LIMIT = 50;

// ============================================
// Clinician Routes (authenticated)
// ============================================

// POST /clinician/clinic/:clinicId/invites - Create a new invite
router.post(
  "/clinician/clinic/:clinicId/invites",
  authenticate,
  requireRole("clinician", "admin"),
  requireActiveMembership,
  async (req: Request, res: Response) => {
    try {
      const { clinicId } = req.params;
      const clinicianId = req.user!.sub;
      const { patientName, patientDob, patientEmail } = req.body;

      // Validate required fields
      if (!patientName || typeof patientName !== "string" || patientName.trim().length === 0) {
        res.status(400).json({ error: "Patient name is required" });
        return;
      }

      if (!patientDob) {
        res.status(400).json({ error: "Patient date of birth is required" });
        return;
      }

      // Parse and validate DOB
      const dob = new Date(patientDob);
      if (isNaN(dob.getTime())) {
        res.status(400).json({ error: "Invalid date of birth format" });
        return;
      }

      // DOB should be in the past
      if (dob > new Date()) {
        res.status(400).json({ error: "Date of birth must be in the past" });
        return;
      }

      // Rate limiting check
      const todayCount = await countTodayInvites(clinicianId);
      if (todayCount >= DAILY_INVITE_LIMIT) {
        res.status(429).json({
          error: "Daily invite limit reached",
          limit: DAILY_INVITE_LIMIT,
          resetAt: getEndOfDay(),
        });
        return;
      }

      // Validate email if provided
      if (patientEmail && typeof patientEmail === "string") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(patientEmail)) {
          res.status(400).json({ error: "Invalid email format" });
          return;
        }
      }

      const result = await createInvite({
        clinicId,
        clinicianId,
        patientName: patientName.trim(),
        patientDob: dob,
        patientEmail: patientEmail?.trim(),
      });

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.status(201).json({
        invite: {
          id: result.invite.id,
          code: result.invite.code,
          patientName: result.invite.patientName,
          patientEmail: result.invite.patientEmail,
          status: result.invite.status,
          expiresAt: result.invite.expiresAt,
          createdAt: result.invite.createdAt,
          clinic: result.invite.clinic,
        },
        remainingToday: DAILY_INVITE_LIMIT - todayCount - 1,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to create invite" });
    }
  }
);

// GET /clinician/clinic/:clinicId/invites - List invites for a clinic
router.get(
  "/clinician/clinic/:clinicId/invites",
  authenticate,
  requireRole("clinician", "admin"),
  requireActiveMembership,
  async (req: Request, res: Response) => {
    try {
      const { clinicId } = req.params;
      const clinicianId = req.user!.sub;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const includeExpired = req.query.includeExpired === "true";

      const invites = await listPendingInvites(clinicId, clinicianId, {
        limit,
        offset,
        includeExpired,
      });

      if (invites === null) {
        res.status(403).json({ error: "Not authorized to view invites for this clinic" });
        return;
      }

      res.json({
        invites: invites.map((inv) => ({
          id: inv.id,
          code: inv.code,
          patientName: inv.patientName,
          patientEmail: inv.patientEmail,
          status: inv.status,
          expiresAt: inv.expiresAt,
          createdAt: inv.createdAt,
          createdBy: inv.createdBy,
        })),
        pagination: {
          limit,
          offset,
          hasMore: invites.length === limit,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invites" });
    }
  }
);

// GET /clinician/clinic/:clinicId/invites/stats - Get invite statistics
router.get(
  "/clinician/clinic/:clinicId/invites/stats",
  authenticate,
  requireRole("clinician", "admin"),
  requireActiveMembership,
  async (req: Request, res: Response) => {
    try {
      const { clinicId } = req.params;
      const clinicianId = req.user!.sub;

      const stats = await getInviteStats(clinicId, clinicianId);

      if (stats === null) {
        res.status(403).json({ error: "Not authorized to view stats for this clinic" });
        return;
      }

      res.json({ stats });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invite statistics" });
    }
  }
);

// DELETE /clinician/clinic/:clinicId/invites/:inviteId - Revoke an invite
router.delete(
  "/clinician/clinic/:clinicId/invites/:inviteId",
  authenticate,
  requireRole("clinician", "admin"),
  requireActiveMembership,
  async (req: Request, res: Response) => {
    try {
      const { inviteId } = req.params;
      const clinicianId = req.user!.sub;

      const result = await revokeInvite(inviteId, clinicianId);

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({ success: true, message: "Invite revoked" });
    } catch (error) {
      res.status(500).json({ error: "Failed to revoke invite" });
    }
  }
);

// ============================================
// Public Routes (no auth required)
// ============================================

// GET /auth/invite/:code - Validate an invite code (public)
router.get("/auth/invite/:code", async (req: Request, res: Response) => {
  try {
    const { code } = req.params;

    if (!code || code.length !== 40) {
      res.status(400).json({ error: "Invalid invite code format" });
      return;
    }

    const result = await getInviteByCode(code);

    if (result === null) {
      res.status(404).json({ error: "Invite not found" });
      return;
    }

    if (!result.valid) {
      res.status(410).json({
        error: "Invite is no longer valid",
        reason: result.reason,
      });
      return;
    }

    res.json({
      valid: true,
      clinicName: result.clinicName,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to validate invite" });
  }
});

// Rate limit: 5 claim attempts per IP per hour
const HOURLY_CLAIM_LIMIT = 5;

// POST /auth/invite/:code/claim - Claim an invite (public or authenticated)
router.post("/auth/invite/:code/claim", async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const { dateOfBirth, email, password, name } = req.body;

    // Get client IP for rate limiting
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";

    // Check rate limit
    const attempts = getClaimAttempts(clientIp);
    if (attempts >= HOURLY_CLAIM_LIMIT) {
      res.status(429).json({
        error: "Too many claim attempts. Please try again later.",
        retryAfter: "1 hour",
      });
      return;
    }

    // Validate code format
    if (!code || code.length !== 40) {
      recordClaimAttempt(clientIp);
      res.status(400).json({ error: "Invalid invite code format" });
      return;
    }

    // Validate DOB
    if (!dateOfBirth) {
      res.status(400).json({ error: "Date of birth is required" });
      return;
    }

    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) {
      res.status(400).json({ error: "Invalid date of birth format" });
      return;
    }

    // Check if this is a new patient registration or existing patient claim
    // For now, we only support new patient registration via this endpoint
    // Existing patients should log in first, then claim via authenticated endpoint

    if (!email || !password || !name) {
      res.status(400).json({
        error: "Email, password, and name are required for new patient registration",
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: "Invalid email format" });
      return;
    }

    // Validate password strength
    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }

    // Validate name
    if (typeof name !== "string" || name.trim().length < 2) {
      res.status(400).json({ error: "Name must be at least 2 characters" });
      return;
    }

    // Attempt to claim
    const result = await claimInvite({
      code,
      dateOfBirth: dob,
      newPatient: {
        email: email.toLowerCase().trim(),
        password,
        name: name.trim(),
      },
    });

    if (!result.success) {
      // Record failed attempt for rate limiting (except for email exists)
      if (result.code !== "EMAIL_EXISTS") {
        recordClaimAttempt(clientIp);
      }

      const statusCode =
        result.code === "NOT_FOUND"
          ? 404
          : result.code === "DOB_MISMATCH"
            ? 403
            : result.code === "EMAIL_EXISTS"
              ? 409
              : result.code === "ALREADY_ENROLLED"
                ? 409
                : 400;

      res.status(statusCode).json({ error: result.error, code: result.code });
      return;
    }

    // Clear rate limit on success
    clearClaimAttempts(clientIp);

    // Generate auth token for the new patient
    const token = signToken({
      sub: result.patient.id,
      email: result.patient.email,
      role: "patient",
    });

    res.status(201).json({
      success: true,
      message: "Invite claimed successfully",
      patient: result.patient,
      clinic: result.clinic,
      enrollment: result.enrollment,
      isNewPatient: result.isNewPatient,
      token,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to claim invite" });
  }
});

// POST /auth/invite/:code/claim-existing - Claim invite for existing patient (authenticated)
router.post(
  "/auth/invite/:code/claim-existing",
  authenticate,
  requireRole("patient"),
  async (req: Request, res: Response) => {
    try {
      const { code } = req.params;
      const { dateOfBirth } = req.body;
      const patientId = req.user!.sub;

      // Validate code format
      if (!code || code.length !== 40) {
        res.status(400).json({ error: "Invalid invite code format" });
        return;
      }

      // Validate DOB
      if (!dateOfBirth) {
        res.status(400).json({ error: "Date of birth is required for verification" });
        return;
      }

      const dob = new Date(dateOfBirth);
      if (isNaN(dob.getTime())) {
        res.status(400).json({ error: "Invalid date of birth format" });
        return;
      }

      // Attempt to claim
      const result = await claimInvite({
        code,
        dateOfBirth: dob,
        existingPatientId: patientId,
      });

      if (!result.success) {
        const statusCode =
          result.code === "NOT_FOUND"
            ? 404
            : result.code === "DOB_MISMATCH"
              ? 403
              : result.code === "ALREADY_ENROLLED"
                ? 409
                : 400;

        res.status(statusCode).json({ error: result.error, code: result.code });
        return;
      }

      res.status(201).json({
        success: true,
        message: "Invite claimed successfully",
        clinic: result.clinic,
        enrollment: result.enrollment,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to claim invite" });
    }
  }
);

// ============================================
// Clinician Clinic List
// ============================================

// GET /clinician/clinics - List clinician's clinic memberships
router.get(
  "/clinician/clinics",
  authenticate,
  requireRole("clinician", "admin"),
  async (req: Request, res: Response) => {
    try {
      const clinicianId = req.user!.sub;

      const memberships = await import("../lib/prisma.js").then(({ prisma }) =>
        prisma.clinicMembership.findMany({
          where: {
            clinicianId,
            status: "ACTIVE",
          },
          include: {
            clinic: {
              select: {
                id: true,
                name: true,
                slug: true,
                status: true,
              },
            },
          },
          orderBy: { joinedAt: "asc" },
        })
      );

      res.json({
        clinics: memberships.map((m) => ({
          id: m.clinic.id,
          name: m.clinic.name,
          slug: m.clinic.slug,
          role: m.role,
          joinedAt: m.joinedAt,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch clinics" });
    }
  }
);

// Helper function
function getEndOfDay(): Date {
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay;
}

export default router;
