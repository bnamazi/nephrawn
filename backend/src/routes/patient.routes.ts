import { Router, Request, Response } from "express";
import { MeasurementType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";
import { symptomCheckinSchema, measurementSchema, bloodPressureSchema, medicationSchema, medicationUpdateSchema, adherenceLogSchema } from "../lib/validation.js";
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
import { logAudit } from "../services/audit.service.js";
import {
  getProfile,
  updateProfileByPatient,
  calculateProfileCompleteness,
  formatProfileResponse,
  getProfileHistory,
  PatientEditableFields,
} from "../services/profile.service.js";
import {
  listMedications,
  getMedication,
  createMedication,
  updateMedication,
  deleteMedication,
  logAdherence,
  getAdherenceLogs,
  getAdherenceSummary,
} from "../services/medication.service.js";

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

// ============================================
// Clinical Profile
// ============================================

// GET /patient/profile - Get own clinical profile
router.get("/profile", async (req: Request, res: Response) => {
  try {
    const patientId = req.user!.sub;
    const profile = await getProfile(patientId);
    const completeness = calculateProfileCompleteness(profile);

    res.json({
      profile: formatProfileResponse(profile),
      completeness,
    });
  } catch (error) {
    logger.error({ err: error, patientId: req.user?.sub }, "Failed to fetch profile");
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// PUT /patient/profile - Update own clinical profile
router.put("/profile", async (req: Request, res: Response) => {
  try {
    const patientId = req.user!.sub;
    const data = req.body as PatientEditableFields;

    // Validate height if provided
    if (data.heightCm !== undefined) {
      if (data.heightCm < 50 || data.heightCm > 300) {
        res.status(400).json({ error: "heightCm must be between 50 and 300" });
        return;
      }
    }

    // Validate dates if provided
    if (data.dialysisStartDate) {
      const date = new Date(data.dialysisStartDate);
      if (isNaN(date.getTime())) {
        res.status(400).json({ error: "Invalid dialysisStartDate" });
        return;
      }
      data.dialysisStartDate = date;
    }
    if (data.transplantDate) {
      const date = new Date(data.transplantDate);
      if (isNaN(date.getTime()) || date > new Date()) {
        res.status(400).json({ error: "Invalid transplantDate or date is in the future" });
        return;
      }
      data.transplantDate = date;
    }

    // Validate otherConditions
    if (data.otherConditions) {
      if (!Array.isArray(data.otherConditions)) {
        res.status(400).json({ error: "otherConditions must be an array" });
        return;
      }
      if (data.otherConditions.length > 20) {
        res.status(400).json({ error: "otherConditions cannot have more than 20 items" });
        return;
      }
      if (data.otherConditions.some((c) => typeof c !== "string" || c.length > 100)) {
        res.status(400).json({ error: "Each condition must be a string with max 100 characters" });
        return;
      }
    }

    const profile = await updateProfileByPatient(patientId, data);
    const completeness = calculateProfileCompleteness(profile);

    res.json({
      profile: formatProfileResponse(profile),
      completeness,
    });
  } catch (error) {
    logger.error({ err: error, patientId: req.user?.sub }, "Failed to update profile");
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// GET /patient/profile/history - Get own profile change history
router.get("/profile/history", async (req: Request, res: Response) => {
  try {
    const patientId = req.user!.sub;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const changes = await getProfileHistory(patientId, { limit, offset });

    res.json({
      changes: changes.map((c) => ({
        entityType: c.entityType,
        changedFields: c.changedFields,
        actor: { type: c.actorType, name: c.actorName },
        timestamp: c.timestamp.toISOString(),
        reason: c.reason,
      })),
    });
  } catch (error) {
    logger.error({ err: error, patientId: req.user?.sub }, "Failed to fetch profile history");
    res.status(500).json({ error: "Failed to fetch profile history" });
  }
});

// ============================================
// Medications
// ============================================

// GET /patient/medications - List own medications
router.get("/medications", async (req: Request, res: Response) => {
  try {
    const patientId = req.user!.sub;
    const includeInactive = req.query.includeInactive === "true";

    const medications = await listMedications(patientId, includeInactive);

    res.json({ medications });
  } catch (error) {
    logger.error({ err: error, patientId: req.user?.sub }, "Failed to fetch medications");
    res.status(500).json({ error: "Failed to fetch medications" });
  }
});

// GET /patient/medications/summary - Get adherence summary
router.get("/medications/summary", async (req: Request, res: Response) => {
  try {
    const patientId = req.user!.sub;
    const days = parseInt(req.query.days as string) || 30;

    const summary = await getAdherenceSummary(patientId, days);

    res.json({ summary });
  } catch (error) {
    logger.error({ err: error, patientId: req.user?.sub }, "Failed to fetch adherence summary");
    res.status(500).json({ error: "Failed to fetch adherence summary" });
  }
});

// GET /patient/medications/:id - Get single medication
router.get("/medications/:id", async (req: Request, res: Response) => {
  try {
    const patientId = req.user!.sub;
    const { id } = req.params;

    const medication = await getMedication(id, patientId);

    if (!medication) {
      res.status(404).json({ error: "Medication not found" });
      return;
    }

    res.json({ medication });
  } catch (error) {
    logger.error({ err: error, patientId: req.user?.sub }, "Failed to fetch medication");
    res.status(500).json({ error: "Failed to fetch medication" });
  }
});

// POST /patient/medications - Create medication
router.post("/medications", async (req: Request, res: Response) => {
  try {
    const patientId = req.user!.sub;
    const parsed = medicationSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
      return;
    }

    const medication = await createMedication({
      patientId,
      name: parsed.data.name,
      dosage: parsed.data.dosage,
      frequency: parsed.data.frequency,
      instructions: parsed.data.instructions,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
    });

    res.status(201).json({ medication });
  } catch (error) {
    logger.error({ err: error, patientId: req.user?.sub }, "Failed to create medication");
    res.status(500).json({ error: "Failed to create medication" });
  }
});

// PUT /patient/medications/:id - Update medication
router.put("/medications/:id", async (req: Request, res: Response) => {
  try {
    const patientId = req.user!.sub;
    const { id } = req.params;
    const parsed = medicationUpdateSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
      return;
    }

    const medication = await updateMedication(id, patientId, {
      name: parsed.data.name,
      dosage: parsed.data.dosage ?? undefined,
      frequency: parsed.data.frequency ?? undefined,
      instructions: parsed.data.instructions ?? undefined,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
      isActive: parsed.data.isActive,
    });

    if (!medication) {
      res.status(404).json({ error: "Medication not found" });
      return;
    }

    res.json({ medication });
  } catch (error) {
    logger.error({ err: error, patientId: req.user?.sub }, "Failed to update medication");
    res.status(500).json({ error: "Failed to update medication" });
  }
});

// DELETE /patient/medications/:id - Soft delete medication
router.delete("/medications/:id", async (req: Request, res: Response) => {
  try {
    const patientId = req.user!.sub;
    const { id } = req.params;

    const success = await deleteMedication(id, patientId);

    if (!success) {
      res.status(404).json({ error: "Medication not found" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error, patientId: req.user?.sub }, "Failed to delete medication");
    res.status(500).json({ error: "Failed to delete medication" });
  }
});

// POST /patient/medications/:id/log - Log adherence
router.post("/medications/:id/log", async (req: Request, res: Response) => {
  try {
    const patientId = req.user!.sub;
    const { id } = req.params;
    const parsed = adherenceLogSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
      return;
    }

    const log = await logAdherence({
      medicationId: id,
      patientId,
      taken: parsed.data.taken,
      notes: parsed.data.notes,
      scheduledFor: parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor) : undefined,
    });

    if (!log) {
      res.status(404).json({ error: "Medication not found" });
      return;
    }

    res.status(201).json({ log });
  } catch (error) {
    logger.error({ err: error, patientId: req.user?.sub }, "Failed to log adherence");
    res.status(500).json({ error: "Failed to log adherence" });
  }
});

// GET /patient/medications/:id/logs - Get adherence history
router.get("/medications/:id/logs", async (req: Request, res: Response) => {
  try {
    const patientId = req.user!.sub;
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const logs = await getAdherenceLogs(id, patientId, { limit, offset });

    if (logs === null) {
      res.status(404).json({ error: "Medication not found" });
      return;
    }

    res.json({ logs });
  } catch (error) {
    logger.error({ err: error, patientId: req.user?.sub }, "Failed to fetch adherence logs");
    res.status(500).json({ error: "Failed to fetch adherence logs" });
  }
});

// GET /patient/clinics - Get clinics the patient is enrolled in
router.get("/clinics", async (req: Request, res: Response) => {
  try {
    const patientId = req.user!.sub;

    const enrollments = await prisma.enrollment.findMany({
      where: {
        patientId,
        status: "ACTIVE",
      },
      include: {
        clinic: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        clinician: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { enrolledAt: "desc" },
    });

    const clinics = enrollments.map((e) => ({
      id: e.clinic.id,
      name: e.clinic.name,
      phone: e.clinic.phone,
      email: e.clinic.email,
      enrolledAt: e.enrolledAt,
      isPrimary: e.isPrimary,
      clinician: {
        id: e.clinician.id,
        name: e.clinician.name,
      },
    }));

    res.json({ clinics });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch clinics" });
  }
});

// POST /patient/clinics/:clinicId/leave - Leave a clinic (self-discharge)
router.post("/clinics/:clinicId/leave", async (req: Request, res: Response) => {
  try {
    const patientId = req.user!.sub;
    const { clinicId } = req.params;

    // Find active enrollment
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        patientId,
        clinicId,
        status: "ACTIVE",
      },
    });

    if (!enrollment) {
      res.status(404).json({ error: "No active enrollment found at this clinic" });
      return;
    }

    // Update enrollment to discharged
    await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: {
        status: "DISCHARGED",
        dischargedAt: new Date(),
      },
    });

    // Audit log - fire and forget
    logAudit({
      action: "enrollment.self_discharged",
      actorType: "patient",
      actorId: patientId,
      resourceType: "enrollment",
      resourceId: enrollment.id,
      metadata: {
        clinicId,
        clinicianId: enrollment.clinicianId,
      },
    });

    res.json({ success: true, message: "Successfully left the clinic" });
  } catch (error) {
    res.status(500).json({ error: "Failed to leave clinic" });
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
    logger.error({ err: error, patientId: req.user?.sub }, "Failed to create checkin");
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
    logger.error({ err: error, patientId: req.user?.sub }, "Failed to create measurement");
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
    logger.error({ err: error, patientId: req.user?.sub }, "Failed to create blood pressure measurement");
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
