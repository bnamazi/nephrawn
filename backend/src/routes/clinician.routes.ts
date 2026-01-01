import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";
import { logInteraction } from "../services/interaction.service.js";
import { getCheckinsByPatient } from "../services/checkin.service.js";

const router = Router();

// All clinician routes require authentication and clinician/admin role
router.use(authenticate);
router.use(requireRole("clinician", "admin"));

// GET /clinician/me - Get current clinician profile
router.get("/me", async (req: Request, res: Response) => {
  try {
    const clinician = await prisma.clinician.findUnique({
      where: { id: req.user!.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    if (!clinician) {
      res.status(404).json({ error: "Clinician not found" });
      return;
    }

    res.json({ clinician });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch clinician profile" });
  }
});

// GET /clinician/patients - List enrolled patients (active only)
router.get("/patients", async (req: Request, res: Response) => {
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: {
        clinicianId: req.user!.sub,
        status: "ACTIVE",
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            email: true,
            dateOfBirth: true,
          },
        },
      },
      orderBy: { enrolledAt: "desc" },
    });

    const patients = enrollments.map((e) => ({
      id: e.patient.id,
      name: e.patient.name,
      email: e.patient.email,
      dateOfBirth: e.patient.dateOfBirth,
      enrolledAt: e.enrolledAt,
      isPrimary: e.isPrimary,
    }));

    res.json({ patients });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch patients" });
  }
});

// GET /clinician/patients/:patientId - Get single patient details
router.get("/patients/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const clinicianId = req.user!.sub;

    // Check enrollment exists and is active
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        patientId_clinicianId: {
          patientId,
          clinicianId,
        },
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            email: true,
            dateOfBirth: true,
            preferences: true,
          },
        },
      },
    });

    if (!enrollment || enrollment.status !== "ACTIVE") {
      res.status(404).json({ error: "Patient not found or not enrolled" });
      return;
    }

    // Log the interaction (RPM/CCM compliance)
    await logInteraction({
      patientId,
      clinicianId,
      interactionType: "CLINICIAN_VIEW",
      metadata: { endpoint: "GET /clinician/patients/:patientId" },
    });

    res.json({
      patient: enrollment.patient,
      enrollment: {
        id: enrollment.id,
        status: enrollment.status,
        isPrimary: enrollment.isPrimary,
        enrolledAt: enrollment.enrolledAt,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch patient details" });
  }
});

// GET /clinician/patients/:patientId/checkins - Get patient's symptom check-ins
router.get("/patients/:patientId/checkins", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const clinicianId = req.user!.sub;

    // Verify enrollment
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        patientId_clinicianId: {
          patientId,
          clinicianId,
        },
      },
    });

    if (!enrollment || enrollment.status !== "ACTIVE") {
      res.status(404).json({ error: "Patient not found or not enrolled" });
      return;
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const checkins = await getCheckinsByPatient(patientId, { limit, offset });

    // Log the interaction (RPM/CCM compliance)
    await logInteraction({
      patientId,
      clinicianId,
      interactionType: "CLINICIAN_VIEW",
      metadata: { endpoint: "GET /clinician/patients/:patientId/checkins", count: checkins.length },
    });

    res.json({ checkins });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch patient check-ins" });
  }
});

export default router;
