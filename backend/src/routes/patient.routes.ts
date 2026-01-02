import { Router, Request, Response } from "express";
import { MeasurementType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";
import { symptomCheckinSchema, measurementSchema, bloodPressureSchema } from "../lib/validation.js";
import { createCheckin, getCheckinsByPatient } from "../services/checkin.service.js";
import { createMeasurement, getMeasurementsByPatient } from "../services/measurement.service.js";
import { getAlertsByPatient } from "../services/alert.service.js";

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

// ============================================
// Measurements
// ============================================

// POST /patient/measurements - Submit a single measurement
router.post("/measurements", async (req: Request, res: Response) => {
  try {
    const parsed = measurementSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
      return;
    }

    const measurement = await createMeasurement({
      patientId: req.user!.sub,
      type: parsed.data.type as MeasurementType,
      value: parsed.data.value,
      unit: parsed.data.unit,
      timestamp: parsed.data.timestamp ? new Date(parsed.data.timestamp) : undefined,
    });

    res.status(201).json({ measurement });
  } catch (error) {
    console.error("Measurement error:", error);
    res.status(500).json({ error: "Failed to create measurement" });
  }
});

// POST /patient/measurements/blood-pressure - Submit BP as systolic/diastolic pair
router.post("/measurements/blood-pressure", async (req: Request, res: Response) => {
  try {
    const parsed = bloodPressureSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
      return;
    }

    const timestamp = parsed.data.timestamp ? new Date(parsed.data.timestamp) : new Date();

    // Create both measurements
    const [systolic, diastolic] = await Promise.all([
      createMeasurement({
        patientId: req.user!.sub,
        type: "BP_SYSTOLIC",
        value: parsed.data.systolic,
        unit: parsed.data.unit,
        timestamp,
      }),
      createMeasurement({
        patientId: req.user!.sub,
        type: "BP_DIASTOLIC",
        value: parsed.data.diastolic,
        unit: parsed.data.unit,
        timestamp,
      }),
    ]);

    res.status(201).json({
      measurements: { systolic, diastolic },
    });
  } catch (error) {
    console.error("Blood pressure error:", error);
    res.status(500).json({ error: "Failed to create blood pressure measurement" });
  }
});

// GET /patient/measurements - Get own measurement history
router.get("/measurements", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const type = req.query.type as MeasurementType | undefined;

    const measurements = await getMeasurementsByPatient(req.user!.sub, { limit, offset, type });

    res.json({ measurements });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch measurements" });
  }
});

// GET /patient/alerts - Get own alerts
router.get("/alerts", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const alerts = await getAlertsByPatient(req.user!.sub, { limit, offset });

    res.json({ alerts });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

export default router;
