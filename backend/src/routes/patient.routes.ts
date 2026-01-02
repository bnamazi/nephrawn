import { Router, Request, Response } from "express";
import { MeasurementType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";
import { symptomCheckinSchema, measurementSchema, bloodPressureSchema } from "../lib/validation.js";
import { createCheckin, getCheckinsByPatient } from "../services/checkin.service.js";
import { createMeasurement, getMeasurementsByPatient } from "../services/measurement.service.js";
import { getAlertsByPatient } from "../services/alert.service.js";
import {
  getTimeSeriesData,
  getDailyAggregates,
  getBloodPressureTimeSeries,
  getMeasurementSummary,
  getPatientDashboard,
} from "../services/timeseries.service.js";

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

    const result = await createMeasurement({
      patientId: req.user!.sub,
      type: parsed.data.type as MeasurementType,
      value: parsed.data.value,
      unit: parsed.data.unit,
      timestamp: parsed.data.timestamp ? new Date(parsed.data.timestamp) : undefined,
    });

    if (result.isDuplicate) {
      res.status(200).json({
        measurement: result.measurement,
        isDuplicate: true,
        message: "Duplicate measurement detected, returning existing record",
      });
      return;
    }

    res.status(201).json({
      measurement: result.measurement,
      convertedFrom: result.convertedFrom,
    });
  } catch (error) {
    console.error("Measurement error:", error);
    const message = error instanceof Error ? error.message : "Failed to create measurement";
    res.status(400).json({ error: message });
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

    // Create both measurements (sequentially to ensure same timestamp handling)
    const systolicResult = await createMeasurement({
      patientId: req.user!.sub,
      type: "BP_SYSTOLIC",
      value: parsed.data.systolic,
      unit: parsed.data.unit,
      timestamp,
    });

    const diastolicResult = await createMeasurement({
      patientId: req.user!.sub,
      type: "BP_DIASTOLIC",
      value: parsed.data.diastolic,
      unit: parsed.data.unit,
      timestamp,
    });

    const anyDuplicate = systolicResult.isDuplicate || diastolicResult.isDuplicate;

    res.status(anyDuplicate ? 200 : 201).json({
      measurements: {
        systolic: systolicResult.measurement,
        diastolic: diastolicResult.measurement,
      },
      isDuplicate: anyDuplicate,
    });
  } catch (error) {
    console.error("Blood pressure error:", error);
    const message = error instanceof Error ? error.message : "Failed to create blood pressure measurement";
    res.status(400).json({ error: message });
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

// ============================================
// Charts & Dashboard
// ============================================

// Helper to parse date range from query params
function parseDateRange(query: Record<string, unknown>) {
  const from = query.from ? new Date(query.from as string) : undefined;
  const to = query.to ? new Date(query.to as string) : undefined;
  return { from, to };
}

// GET /patient/dashboard - Get own dashboard overview
router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const patientId = req.user!.sub;
    const { from, to } = parseDateRange(req.query);

    const dashboard = await getPatientDashboard(patientId, { from, to });

    res.json({ dashboard });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch dashboard" });
  }
});

// GET /patient/charts/:type - Get own time-series data for charting
router.get("/charts/:type", async (req: Request, res: Response) => {
  try {
    const patientId = req.user!.sub;
    const { type } = req.params;

    // Special handling for blood pressure
    if (type === "blood-pressure" || type === "BP") {
      const { from, to } = parseDateRange(req.query);
      const limit = parseInt(req.query.limit as string) || undefined;
      const data = await getBloodPressureTimeSeries(patientId, { from, to, limit });

      if (!data) {
        res.json({ data: null, message: "No blood pressure data found" });
        return;
      }

      res.json({ data });
      return;
    }

    // Validate measurement type
    const validTypes: MeasurementType[] = ["WEIGHT", "BP_SYSTOLIC", "BP_DIASTOLIC", "SPO2", "HEART_RATE"];
    if (!validTypes.includes(type as MeasurementType)) {
      res.status(400).json({ error: `Invalid type. Valid types: ${validTypes.join(", ")}, blood-pressure` });
      return;
    }

    const { from, to } = parseDateRange(req.query);
    const limit = parseInt(req.query.limit as string) || undefined;
    const aggregate = req.query.aggregate === "daily";

    let data;
    if (aggregate) {
      data = await getDailyAggregates(patientId, type as MeasurementType, { from, to });
    } else {
      data = await getTimeSeriesData(patientId, type as MeasurementType, { from, to, limit });
    }

    if (!data) {
      res.json({ data: null, message: `No ${type} data found` });
      return;
    }

    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch chart data" });
  }
});

// GET /patient/summary/:type - Get own measurement summary with trend
router.get("/summary/:type", async (req: Request, res: Response) => {
  try {
    const patientId = req.user!.sub;
    const { type } = req.params;

    const validTypes: MeasurementType[] = ["WEIGHT", "BP_SYSTOLIC", "BP_DIASTOLIC", "SPO2", "HEART_RATE"];
    if (!validTypes.includes(type as MeasurementType)) {
      res.status(400).json({ error: `Invalid type. Valid types: ${validTypes.join(", ")}` });
      return;
    }

    const { from, to } = parseDateRange(req.query);
    const summary = await getMeasurementSummary(patientId, type as MeasurementType, { from, to });

    res.json({ summary });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

export default router;
