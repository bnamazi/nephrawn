import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";

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

export default router;
