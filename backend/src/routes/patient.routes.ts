import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";
import { symptomCheckinSchema } from "../lib/validation.js";
import { createCheckin, getCheckinsByPatient } from "../services/checkin.service.js";

const router = Router();

// All patient routes require authentication and patient role
router.use(authenticate);
router.use(requireRole("patient"));

// GET /patient/me - Get current patient profile
router.get("/me", async (req: Request, res: Response) => {
  try {
    const patient = await prisma.patient.findUnique({
      where: { id: req.user!.sub },
      select: {
        id: true,
        email: true,
        name: true,
        dateOfBirth: true,
        preferences: true,
        createdAt: true,
      },
    });

    if (!patient) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    res.json({ patient });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch patient profile" });
  }
});

// POST /patient/checkins - Submit a symptom check-in
router.post("/checkins", async (req: Request, res: Response) => {
  try {
    const parsed = symptomCheckinSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
      return;
    }

    const checkin = await createCheckin({
      patientId: req.user!.sub,
      symptoms: parsed.data.symptoms,
      notes: parsed.data.notes,
      timestamp: parsed.data.timestamp ? new Date(parsed.data.timestamp) : undefined,
    });

    res.status(201).json({ checkin });
  } catch (error) {
    console.error("Checkin error:", error);
    res.status(500).json({ error: "Failed to create check-in" });
  }
});

// GET /patient/checkins - Get own check-in history
router.get("/checkins", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const checkins = await getCheckinsByPatient(req.user!.sub, { limit, offset });

    res.json({ checkins });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch check-ins" });
  }
});

export default router;
