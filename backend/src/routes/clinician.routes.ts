import { Router, Request, Response } from "express";
import { AlertStatus, MeasurementType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";
import { logInteraction } from "../services/interaction.service.js";
import { getCheckinsByPatient } from "../services/checkin.service.js";
import { getMeasurementsByPatient } from "../services/measurement.service.js";
import {
  getAlertsForClinician,
  getAlertById,
  acknowledgeAlert,
  dismissAlert,
} from "../services/alert.service.js";
import {
  createNote,
  getNotesByPatient,
  getNotesByAlert,
  getNoteById,
  updateNote,
  deleteNote,
} from "../services/note.service.js";
import {
  getTimeSeriesData,
  getDailyAggregates,
  getBloodPressureTimeSeries,
  getMeasurementSummary,
  getPatientDashboard,
} from "../services/timeseries.service.js";
import { getAuditLogs } from "../services/audit.service.js";
import {
  getProfile,
  updateProfileByClinician,
  calculateProfileCompleteness,
  formatProfileResponse,
  getProfileHistory,
  ClinicianEditableFields,
} from "../services/profile.service.js";
import {
  getCarePlanByPatientAndClinician,
  updateCarePlan,
  calculateCarePlanCompleteness,
  formatCarePlanResponse,
  CarePlanInput,
} from "../services/careplan.service.js";
import { getPatientSummary } from "../services/patientsummary.service.js";
import {
  getMedicationsForClinician,
  getAdherenceSummaryForClinician,
} from "../services/medication.service.js";
import {
  getDocumentsForClinician,
  getDocumentForClinician,
  generateDownloadUrlForClinician,
} from "../services/document.service.js";
import {
  getLabReportsForClinician,
  getLabReportForClinician,
  createLabReportForPatient,
  verifyLabReport,
  addLabResultForPatient,
  updateLabResultForPatient,
  deleteLabResultForPatient,
} from "../services/lab.service.js";
import {
  labReportSchema,
  labResultSchema,
  labResultUpdateSchema,
} from "../lib/validation.js";

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

// GET /clinician/clinics - Get clinics the clinician belongs to
router.get("/clinics", async (req: Request, res: Response) => {
  try {
    const clinicianId = req.user!.sub;

    const memberships = await prisma.clinicMembership.findMany({
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
    });

    const clinics = memberships
      .filter((m) => m.clinic.status === "ACTIVE")
      .map((m) => ({
        id: m.clinic.id,
        name: m.clinic.name,
        slug: m.clinic.slug,
        role: m.role,
        joinedAt: m.joinedAt,
      }));

    res.json({ clinics });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch clinics" });
  }
});

// GET /clinician/patients - List enrolled patients (active only)
// Optional query param: clinicId - filter by clinic
router.get("/patients", async (req: Request, res: Response) => {
  try {
    const clinicianId = req.user!.sub;
    const clinicId = req.query.clinicId as string | undefined;

    // If clinicId provided, verify membership
    if (clinicId) {
      const membership = await prisma.clinicMembership.findUnique({
        where: { clinicId_clinicianId: { clinicId, clinicianId } },
      });
      if (!membership || membership.status !== "ACTIVE") {
        res.status(403).json({ error: "Not a member of this clinic" });
        return;
      }
    }

    const enrollments = await prisma.enrollment.findMany({
      where: {
        clinicianId,
        status: "ACTIVE",
        ...(clinicId && { clinicId }),
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
        clinic: {
          select: {
            id: true,
            name: true,
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
      clinic: {
        id: e.clinic.id,
        name: e.clinic.name,
      },
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
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        patientId,
        clinicianId,
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
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        patientId,
        clinicianId,
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

// GET /clinician/patients/:patientId/measurements - Get patient's measurements
router.get("/patients/:patientId/measurements", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const clinicianId = req.user!.sub;

    // Verify enrollment
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        patientId,
        clinicianId,
      },
    });

    if (!enrollment || enrollment.status !== "ACTIVE") {
      res.status(404).json({ error: "Patient not found or not enrolled" });
      return;
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const type = req.query.type as MeasurementType | undefined;

    const measurements = await getMeasurementsByPatient(patientId, { limit, offset, type });

    // Log the interaction (RPM/CCM compliance)
    await logInteraction({
      patientId,
      clinicianId,
      interactionType: "CLINICIAN_VIEW",
      metadata: { endpoint: "GET /clinician/patients/:patientId/measurements", count: measurements.length },
    });

    res.json({ measurements });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch patient measurements" });
  }
});

// ============================================
// Patient Profile & Care Plan
// ============================================

// GET /clinician/patients/:patientId/profile - Get patient's clinical profile + care plan
router.get("/patients/:patientId/profile", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const clinicianId = req.user!.sub;

    // Verify enrollment
    const enrollment = await prisma.enrollment.findFirst({
      where: { patientId, clinicianId, status: "ACTIVE" },
    });

    if (!enrollment) {
      res.status(404).json({ error: "Patient not found or not enrolled" });
      return;
    }

    const profile = await getProfile(patientId);
    const profileCompleteness = calculateProfileCompleteness(profile);

    const carePlanResult = await getCarePlanByPatientAndClinician(patientId, clinicianId);
    const carePlanCompleteness = calculateCarePlanCompleteness(carePlanResult?.carePlan ?? null);

    // Log the interaction
    await logInteraction({
      patientId,
      clinicianId,
      interactionType: "CLINICIAN_VIEW",
      metadata: { endpoint: "GET /clinician/patients/:patientId/profile" },
    });

    res.json({
      profile: formatProfileResponse(profile),
      carePlan: formatCarePlanResponse(carePlanResult?.carePlan ?? null),
      enrollment: carePlanResult?.enrollment ?? null,
      completeness: {
        profileScore: profileCompleteness.profileScore,
        carePlanScore: carePlanCompleteness.carePlanScore,
        missingCritical: [
          ...profileCompleteness.missingCritical,
          ...carePlanCompleteness.missingCritical,
        ],
      },
      showTargetsBanner: carePlanCompleteness.showTargetsBanner,
      showProfileBanner: profileCompleteness.showProfileBanner,
    });
  } catch (error) {
    logger.error({ err: error, patientId: req.params.patientId }, "Failed to fetch profile");
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// PUT /clinician/patients/:patientId/profile - Update patient's clinical profile
router.put("/patients/:patientId/profile", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const clinicianId = req.user!.sub;
    const { _changeReason, ...data } = req.body as ClinicianEditableFields & { _changeReason?: string };

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

    const profile = await updateProfileByClinician(patientId, clinicianId, data, _changeReason);

    if (!profile) {
      res.status(404).json({ error: "Patient not found or not enrolled" });
      return;
    }

    const completeness = calculateProfileCompleteness(profile);

    res.json({
      profile: formatProfileResponse(profile),
      completeness,
    });
  } catch (error) {
    logger.error({ err: error, patientId: req.params.patientId }, "Failed to update profile");
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// GET /clinician/patients/:patientId/care-plan - Get patient's care plan
router.get("/patients/:patientId/care-plan", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const clinicianId = req.user!.sub;

    const result = await getCarePlanByPatientAndClinician(patientId, clinicianId);

    if (!result) {
      res.status(404).json({ error: "Patient not found or not enrolled" });
      return;
    }

    const completeness = calculateCarePlanCompleteness(result.carePlan);

    res.json({
      carePlan: formatCarePlanResponse(result.carePlan),
      enrollment: result.enrollment,
      completeness,
    });
  } catch (error) {
    logger.error({ err: error, patientId: req.params.patientId }, "Failed to fetch care plan");
    res.status(500).json({ error: "Failed to fetch care plan" });
  }
});

// PUT /clinician/patients/:patientId/care-plan - Update patient's care plan
router.put("/patients/:patientId/care-plan", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const clinicianId = req.user!.sub;
    const { _changeReason, ...data } = req.body as CarePlanInput & { _changeReason?: string };

    const carePlan = await updateCarePlan(patientId, clinicianId, data, _changeReason);

    if (!carePlan) {
      res.status(404).json({ error: "Patient not found or not enrolled" });
      return;
    }

    const completeness = calculateCarePlanCompleteness(carePlan);

    res.json({
      carePlan: formatCarePlanResponse(carePlan),
      completeness,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update care plan";
    logger.error({ err: error, patientId: req.params.patientId }, "Failed to update care plan");
    res.status(400).json({ error: message });
  }
});

// GET /clinician/patients/:patientId/profile/history - Get profile change history
router.get("/patients/:patientId/profile/history", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const clinicianId = req.user!.sub;

    // Verify enrollment
    const enrollment = await prisma.enrollment.findFirst({
      where: { patientId, clinicianId, status: "ACTIVE" },
    });

    if (!enrollment) {
      res.status(404).json({ error: "Patient not found or not enrolled" });
      return;
    }

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
    logger.error({ err: error, patientId: req.params.patientId }, "Failed to fetch profile history");
    res.status(500).json({ error: "Failed to fetch profile history" });
  }
});

// GET /clinician/patients/:patientId/summary - Comprehensive patient summary
router.get("/patients/:patientId/summary", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const clinicianId = req.user!.sub;

    const summary = await getPatientSummary(patientId, clinicianId);

    if (!summary) {
      res.status(404).json({ error: "Patient not found or not enrolled" });
      return;
    }

    // Log the interaction (RPM/CCM compliance)
    await logInteraction({
      patientId,
      clinicianId,
      interactionType: "CLINICIAN_VIEW",
      metadata: { endpoint: "GET /clinician/patients/:patientId/summary" },
    });

    res.json(summary);
  } catch (error) {
    logger.error({ err: error, patientId: req.params.patientId }, "Failed to fetch patient summary");
    res.status(500).json({ error: "Failed to fetch patient summary" });
  }
});

// ============================================
// Patient Medications (Clinician View)
// ============================================

// GET /clinician/patients/:patientId/medications - View patient's medications
router.get("/patients/:patientId/medications", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const clinicianId = req.user!.sub;
    const includeInactive = req.query.includeInactive === "true";
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const medications = await getMedicationsForClinician(patientId, clinicianId, {
      includeInactive,
      limit,
      offset,
    });

    if (medications === null) {
      res.status(404).json({ error: "Patient not found or not enrolled" });
      return;
    }

    res.json({ medications });
  } catch (error) {
    logger.error({ err: error, patientId: req.params.patientId }, "Failed to fetch patient medications");
    res.status(500).json({ error: "Failed to fetch patient medications" });
  }
});

// GET /clinician/patients/:patientId/medications/summary - Get patient's adherence summary
router.get("/patients/:patientId/medications/summary", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const clinicianId = req.user!.sub;
    const days = parseInt(req.query.days as string) || 30;

    const summary = await getAdherenceSummaryForClinician(patientId, clinicianId, days);

    if (summary === null) {
      res.status(404).json({ error: "Patient not found or not enrolled" });
      return;
    }

    res.json({ summary });
  } catch (error) {
    logger.error({ err: error, patientId: req.params.patientId }, "Failed to fetch adherence summary");
    res.status(500).json({ error: "Failed to fetch adherence summary" });
  }
});

// ============================================
// Patient Documents (Clinician View)
// ============================================

// GET /clinician/patients/:patientId/documents - List patient's documents
router.get("/patients/:patientId/documents", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const clinicianId = req.user!.sub;
    const type = req.query.type as "LAB_RESULT" | "OTHER" | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const documents = await getDocumentsForClinician(patientId, clinicianId, { type, limit, offset });

    if (documents === null) {
      res.status(404).json({ error: "Patient not found or not enrolled" });
      return;
    }

    res.json({ documents });
  } catch (error) {
    logger.error({ err: error, patientId: req.params.patientId }, "Failed to fetch patient documents");
    res.status(500).json({ error: "Failed to fetch patient documents" });
  }
});

// GET /clinician/patients/:patientId/documents/:id - Get single document
router.get("/patients/:patientId/documents/:id", async (req: Request, res: Response) => {
  try {
    const { patientId, id } = req.params;
    const clinicianId = req.user!.sub;

    const document = await getDocumentForClinician(id, patientId, clinicianId);

    if (!document) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    res.json({ document });
  } catch (error) {
    logger.error({ err: error, patientId: req.params.patientId }, "Failed to fetch document");
    res.status(500).json({ error: "Failed to fetch document" });
  }
});

// GET /clinician/patients/:patientId/documents/:id/download-url - Get download URL
router.get("/patients/:patientId/documents/:id/download-url", async (req: Request, res: Response) => {
  try {
    const { patientId, id } = req.params;
    const clinicianId = req.user!.sub;

    const result = await generateDownloadUrlForClinician(id, patientId, clinicianId);

    if (!result) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    res.json(result);
  } catch (error) {
    logger.error({ err: error, patientId: req.params.patientId }, "Failed to generate download URL");
    res.status(500).json({ error: "Failed to generate download URL" });
  }
});

// ============================================
// Patient Labs (Clinician View & Actions)
// ============================================

// GET /clinician/patients/:patientId/labs - List patient's lab reports
router.get("/patients/:patientId/labs", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const clinicianId = req.user!.sub;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const labReports = await getLabReportsForClinician(patientId, clinicianId, { limit, offset });

    if (labReports === null) {
      res.status(404).json({ error: "Patient not found or not enrolled" });
      return;
    }

    res.json({ labReports });
  } catch (error) {
    logger.error({ err: error, patientId: req.params.patientId }, "Failed to fetch patient lab reports");
    res.status(500).json({ error: "Failed to fetch patient lab reports" });
  }
});

// GET /clinician/patients/:patientId/labs/:id - Get single lab report
router.get("/patients/:patientId/labs/:id", async (req: Request, res: Response) => {
  try {
    const { patientId, id } = req.params;
    const clinicianId = req.user!.sub;

    const labReport = await getLabReportForClinician(id, patientId, clinicianId);

    if (!labReport) {
      res.status(404).json({ error: "Lab report not found" });
      return;
    }

    res.json({ labReport });
  } catch (error) {
    logger.error({ err: error, patientId: req.params.patientId }, "Failed to fetch lab report");
    res.status(500).json({ error: "Failed to fetch lab report" });
  }
});

// POST /clinician/patients/:patientId/labs - Create lab report for patient
router.post("/patients/:patientId/labs", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const clinicianId = req.user!.sub;
    const parsed = labReportSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
      return;
    }

    const labReport = await createLabReportForPatient(patientId, clinicianId, {
      collectedAt: new Date(parsed.data.collectedAt),
      reportedAt: parsed.data.reportedAt ? new Date(parsed.data.reportedAt) : undefined,
      labName: parsed.data.labName,
      orderingProvider: parsed.data.orderingProvider,
      notes: parsed.data.notes,
      documentId: parsed.data.documentId,
      results: parsed.data.results?.map((r) => ({
        analyteName: r.analyteName,
        analyteCode: r.analyteCode,
        value: r.value,
        unit: r.unit,
        referenceRangeLow: r.referenceRangeLow,
        referenceRangeHigh: r.referenceRangeHigh,
        flag: r.flag as "H" | "L" | "C" | undefined,
      })),
    });

    if (!labReport) {
      res.status(404).json({ error: "Patient not found or not enrolled" });
      return;
    }

    res.status(201).json({ labReport });
  } catch (error) {
    logger.error({ err: error, patientId: req.params.patientId }, "Failed to create lab report");
    res.status(500).json({ error: "Failed to create lab report" });
  }
});

// POST /clinician/patients/:patientId/labs/:id/verify - Verify lab report
router.post("/patients/:patientId/labs/:id/verify", async (req: Request, res: Response) => {
  try {
    const { patientId, id } = req.params;
    const clinicianId = req.user!.sub;

    const labReport = await verifyLabReport(id, patientId, clinicianId);

    if (!labReport) {
      res.status(404).json({ error: "Lab report not found or not enrolled" });
      return;
    }

    res.json({ labReport });
  } catch (error) {
    logger.error({ err: error, patientId: req.params.patientId }, "Failed to verify lab report");
    res.status(500).json({ error: "Failed to verify lab report" });
  }
});

// POST /clinician/patients/:patientId/labs/:id/results - Add result to lab report
router.post("/patients/:patientId/labs/:id/results", async (req: Request, res: Response) => {
  try {
    const { patientId, id } = req.params;
    const clinicianId = req.user!.sub;
    const parsed = labResultSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
      return;
    }

    const result = await addLabResultForPatient(id, patientId, clinicianId, {
      analyteName: parsed.data.analyteName,
      analyteCode: parsed.data.analyteCode,
      value: parsed.data.value,
      unit: parsed.data.unit,
      referenceRangeLow: parsed.data.referenceRangeLow,
      referenceRangeHigh: parsed.data.referenceRangeHigh,
      flag: parsed.data.flag as "H" | "L" | "C" | undefined,
    });

    if (!result) {
      res.status(404).json({ error: "Lab report not found or not enrolled" });
      return;
    }

    res.status(201).json({ result });
  } catch (error) {
    logger.error({ err: error, patientId: req.params.patientId }, "Failed to add lab result");
    res.status(500).json({ error: "Failed to add lab result" });
  }
});

// PUT /clinician/patients/:patientId/labs/:id/results/:resultId - Update result
router.put("/patients/:patientId/labs/:id/results/:resultId", async (req: Request, res: Response) => {
  try {
    const { patientId, resultId } = req.params;
    const clinicianId = req.user!.sub;
    const parsed = labResultUpdateSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
      return;
    }

    const result = await updateLabResultForPatient(resultId, patientId, clinicianId, {
      analyteName: parsed.data.analyteName,
      analyteCode: parsed.data.analyteCode,
      value: parsed.data.value,
      unit: parsed.data.unit,
      referenceRangeLow: parsed.data.referenceRangeLow,
      referenceRangeHigh: parsed.data.referenceRangeHigh,
      flag: parsed.data.flag as "H" | "L" | "C" | null | undefined,
    });

    if (!result) {
      res.status(404).json({ error: "Lab result not found or not enrolled" });
      return;
    }

    res.json({ result });
  } catch (error) {
    logger.error({ err: error, patientId: req.params.patientId }, "Failed to update lab result");
    res.status(500).json({ error: "Failed to update lab result" });
  }
});

// DELETE /clinician/patients/:patientId/labs/:id/results/:resultId - Delete result
router.delete("/patients/:patientId/labs/:id/results/:resultId", async (req: Request, res: Response) => {
  try {
    const { patientId, resultId } = req.params;
    const clinicianId = req.user!.sub;

    const success = await deleteLabResultForPatient(resultId, patientId, clinicianId);

    if (!success) {
      res.status(404).json({ error: "Lab result not found or not enrolled" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error, patientId: req.params.patientId }, "Failed to delete lab result");
    res.status(500).json({ error: "Failed to delete lab result" });
  }
});

// ============================================
// Alerts
// ============================================

// GET /clinician/alerts - Get all alerts for enrolled patients
router.get("/alerts", async (req: Request, res: Response) => {
  try {
    const clinicianId = req.user!.sub;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as AlertStatus | undefined;

    const alerts = await getAlertsForClinician(clinicianId, { status, limit, offset });

    res.json({ alerts });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

// GET /clinician/alerts/:alertId - Get single alert details
router.get("/alerts/:alertId", async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const clinicianId = req.user!.sub;

    const alert = await getAlertById(alertId);

    if (!alert) {
      res.status(404).json({ error: "Alert not found" });
      return;
    }

    // Verify clinician is enrolled with this patient
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        patientId: alert.patientId,
        clinicianId,
      },
    });

    if (!enrollment || enrollment.status !== "ACTIVE") {
      res.status(404).json({ error: "Alert not found" });
      return;
    }

    res.json({ alert });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch alert" });
  }
});

// POST /clinician/alerts/:alertId/acknowledge - Acknowledge an alert
router.post("/alerts/:alertId/acknowledge", async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const clinicianId = req.user!.sub;

    const success = await acknowledgeAlert(alertId, clinicianId);

    if (!success) {
      res.status(404).json({ error: "Alert not found or already processed" });
      return;
    }

    // Log the interaction (RPM/CCM compliance)
    const alert = await getAlertById(alertId);
    if (alert) {
      await logInteraction({
        patientId: alert.patientId,
        clinicianId,
        interactionType: "CLINICIAN_ALERT_ACK",
        metadata: { alertId, ruleId: alert.ruleId },
      });
    }

    res.json({ success: true, message: "Alert acknowledged" });
  } catch (error) {
    res.status(500).json({ error: "Failed to acknowledge alert" });
  }
});

// POST /clinician/alerts/:alertId/dismiss - Dismiss an alert
router.post("/alerts/:alertId/dismiss", async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const clinicianId = req.user!.sub;

    const success = await dismissAlert(alertId, clinicianId);

    if (!success) {
      res.status(404).json({ error: "Alert not found or already dismissed" });
      return;
    }

    // Log the interaction (RPM/CCM compliance)
    const alert = await getAlertById(alertId);
    if (alert) {
      await logInteraction({
        patientId: alert.patientId,
        clinicianId,
        interactionType: "CLINICIAN_ALERT_ACK",
        metadata: { alertId, ruleId: alert.ruleId, action: "dismiss" },
      });
    }

    res.json({ success: true, message: "Alert dismissed" });
  } catch (error) {
    res.status(500).json({ error: "Failed to dismiss alert" });
  }
});

// ============================================
// Clinician Notes
// ============================================

// POST /clinician/patients/:patientId/notes - Create a note for a patient
router.post("/patients/:patientId/notes", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const clinicianId = req.user!.sub;
    const { content, alertId } = req.body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      res.status(400).json({ error: "Content is required" });
      return;
    }

    const note = await createNote({
      patientId,
      clinicianId,
      alertId,
      content: content.trim(),
    });

    if (!note) {
      res.status(404).json({ error: "Patient not found or not enrolled" });
      return;
    }

    res.status(201).json({ note });
  } catch (error) {
    res.status(500).json({ error: "Failed to create note" });
  }
});

// GET /clinician/patients/:patientId/notes - Get notes for a patient
router.get("/patients/:patientId/notes", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const clinicianId = req.user!.sub;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const notes = await getNotesByPatient(patientId, clinicianId, { limit, offset });

    if (notes === null) {
      res.status(404).json({ error: "Patient not found or not enrolled" });
      return;
    }

    // Log the interaction (RPM/CCM compliance)
    await logInteraction({
      patientId,
      clinicianId,
      interactionType: "CLINICIAN_VIEW",
      metadata: { endpoint: "GET /clinician/patients/:patientId/notes", count: notes.length },
    });

    res.json({ notes });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch notes" });
  }
});

// GET /clinician/alerts/:alertId/notes - Get notes attached to an alert
router.get("/alerts/:alertId/notes", async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const clinicianId = req.user!.sub;

    const notes = await getNotesByAlert(alertId, clinicianId);

    if (notes === null) {
      res.status(404).json({ error: "Alert not found or not authorized" });
      return;
    }

    res.json({ notes });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch notes" });
  }
});

// GET /clinician/notes/:noteId - Get a single note
router.get("/notes/:noteId", async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;
    const clinicianId = req.user!.sub;

    const note = await getNoteById(noteId, clinicianId);

    if (!note) {
      res.status(404).json({ error: "Note not found" });
      return;
    }

    res.json({ note });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch note" });
  }
});

// PUT /clinician/notes/:noteId - Update a note (author only)
router.put("/notes/:noteId", async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;
    const clinicianId = req.user!.sub;
    const { content } = req.body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      res.status(400).json({ error: "Content is required" });
      return;
    }

    const note = await updateNote(noteId, clinicianId, content.trim());

    if (!note) {
      res.status(404).json({ error: "Note not found or not authorized" });
      return;
    }

    res.json({ note });
  } catch (error) {
    res.status(500).json({ error: "Failed to update note" });
  }
});

// DELETE /clinician/notes/:noteId - Delete a note (author only)
router.delete("/notes/:noteId", async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;
    const clinicianId = req.user!.sub;

    const success = await deleteNote(noteId, clinicianId);

    if (!success) {
      res.status(404).json({ error: "Note not found or not authorized" });
      return;
    }

    res.json({ success: true, message: "Note deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete note" });
  }
});

// ============================================
// Time-Series Charts
// ============================================

// Helper to verify enrollment
async function verifyEnrollment(patientId: string, clinicianId: string) {
  const enrollment = await prisma.enrollment.findFirst({
    where: { patientId, clinicianId },
  });
  return enrollment?.status === "ACTIVE";
}

// Helper to parse date range from query params
function parseDateRange(query: Record<string, unknown>) {
  const from = query.from ? new Date(query.from as string) : undefined;
  const to = query.to ? new Date(query.to as string) : undefined;
  return { from, to };
}

// GET /clinician/patients/:patientId/dashboard - Get patient dashboard overview
router.get("/patients/:patientId/dashboard", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const clinicianId = req.user!.sub;

    if (!(await verifyEnrollment(patientId, clinicianId))) {
      res.status(404).json({ error: "Patient not found or not enrolled" });
      return;
    }

    const { from, to } = parseDateRange(req.query);
    const dashboard = await getPatientDashboard(patientId, { from, to });

    await logInteraction({
      patientId,
      clinicianId,
      interactionType: "CLINICIAN_VIEW",
      metadata: { endpoint: "GET /clinician/patients/:patientId/dashboard" },
    });

    res.json({ dashboard });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch dashboard" });
  }
});

// GET /clinician/patients/:patientId/charts/:type - Get time-series data for charting
router.get("/patients/:patientId/charts/:type", async (req: Request, res: Response) => {
  try {
    const { patientId, type } = req.params;
    const clinicianId = req.user!.sub;

    if (!(await verifyEnrollment(patientId, clinicianId))) {
      res.status(404).json({ error: "Patient not found or not enrolled" });
      return;
    }

    // Special handling for blood pressure
    if (type === "blood-pressure" || type === "BP") {
      const { from, to } = parseDateRange(req.query);
      const limit = parseInt(req.query.limit as string) || undefined;
      const data = await getBloodPressureTimeSeries(patientId, { from, to, limit });

      if (!data) {
        res.json({ data: null, message: "No blood pressure data found" });
        return;
      }

      await logInteraction({
        patientId,
        clinicianId,
        interactionType: "CLINICIAN_VIEW",
        metadata: { endpoint: "GET /clinician/patients/:patientId/charts/blood-pressure" },
      });

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

    await logInteraction({
      patientId,
      clinicianId,
      interactionType: "CLINICIAN_VIEW",
      metadata: { endpoint: `GET /clinician/patients/:patientId/charts/${type}`, aggregate },
    });

    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch chart data" });
  }
});

// GET /clinician/patients/:patientId/summary/:type - Get measurement summary with trend
router.get("/patients/:patientId/summary/:type", async (req: Request, res: Response) => {
  try {
    const { patientId, type } = req.params;
    const clinicianId = req.user!.sub;

    if (!(await verifyEnrollment(patientId, clinicianId))) {
      res.status(404).json({ error: "Patient not found or not enrolled" });
      return;
    }

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

// ============================================
// Enrollment History & Audit Logs
// ============================================

// GET /clinician/enrollments - Get enrollment history for a clinic
// Query params: clinicId (required), status (optional), limit, offset
router.get("/enrollments", async (req: Request, res: Response) => {
  try {
    const clinicianId = req.user!.sub;
    const clinicId = req.query.clinicId as string;
    const status = req.query.status as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!clinicId) {
      res.status(400).json({ error: "clinicId is required" });
      return;
    }

    // Verify clinician has admin/owner role in the clinic
    const membership = await prisma.clinicMembership.findUnique({
      where: { clinicId_clinicianId: { clinicId, clinicianId } },
    });

    if (!membership || membership.status !== "ACTIVE") {
      res.status(403).json({ error: "Not a member of this clinic" });
      return;
    }

    // Only OWNER and ADMIN can view enrollment history
    if (!["OWNER", "ADMIN"].includes(membership.role)) {
      res.status(403).json({ error: "Insufficient permissions - requires OWNER or ADMIN role" });
      return;
    }

    const where: Record<string, unknown> = { clinicId };
    if (status) {
      where.status = status;
    }

    const enrollments = await prisma.enrollment.findMany({
      where,
      include: {
        patient: {
          select: { id: true, name: true, email: true },
        },
        clinician: {
          select: { id: true, name: true },
        },
        invite: {
          select: { id: true, code: true, createdAt: true },
        },
      },
      orderBy: { enrolledAt: "desc" },
      take: limit,
      skip: offset,
    });

    const total = await prisma.enrollment.count({ where });

    res.json({
      enrollments: enrollments.map((e) => ({
        id: e.id,
        status: e.status,
        enrolledVia: e.enrolledVia,
        enrolledAt: e.enrolledAt,
        dischargedAt: e.dischargedAt,
        isPrimary: e.isPrimary,
        patient: e.patient,
        clinician: e.clinician,
        invite: e.invite
          ? { id: e.invite.id, createdAt: e.invite.createdAt }
          : null,
      })),
      total,
      limit,
      offset,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch enrollments" });
  }
});

// GET /clinician/audit-logs - Get audit logs for a clinic
// Query params: clinicId (required), resourceType, action, limit, offset
router.get("/audit-logs", async (req: Request, res: Response) => {
  try {
    const clinicianId = req.user!.sub;
    const clinicId = req.query.clinicId as string;
    const resourceType = req.query.resourceType as string | undefined;
    const action = req.query.action as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!clinicId) {
      res.status(400).json({ error: "clinicId is required" });
      return;
    }

    // Verify clinician has admin/owner role in the clinic
    const membership = await prisma.clinicMembership.findUnique({
      where: { clinicId_clinicianId: { clinicId, clinicianId } },
    });

    if (!membership || membership.status !== "ACTIVE") {
      res.status(403).json({ error: "Not a member of this clinic" });
      return;
    }

    // Only OWNER and ADMIN can view audit logs
    if (!["OWNER", "ADMIN"].includes(membership.role)) {
      res.status(403).json({ error: "Insufficient permissions - requires OWNER or ADMIN role" });
      return;
    }

    // Get all resources (invites, enrollments) for this clinic to filter audit logs
    const clinicInvites = await prisma.invite.findMany({
      where: { clinicId },
      select: { id: true },
    });
    const clinicEnrollments = await prisma.enrollment.findMany({
      where: { clinicId },
      select: { id: true },
    });

    const inviteIds = clinicInvites.map((i) => i.id);
    const enrollmentIds = clinicEnrollments.map((e) => e.id);

    // Query audit logs for clinic resources
    const logs = await getAuditLogs({
      resourceType,
      action: action as Parameters<typeof getAuditLogs>[0]["action"],
      limit,
      offset,
    });

    // Filter to only include logs for this clinic's resources
    const filteredLogs = logs.filter((log) => {
      if (log.resourceType === "invite") {
        return inviteIds.includes(log.resourceId);
      }
      if (log.resourceType === "enrollment") {
        return enrollmentIds.includes(log.resourceId);
      }
      if (log.resourceType === "clinic") {
        return log.resourceId === clinicId;
      }
      return false;
    });

    res.json({ auditLogs: filteredLogs });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

export default router;
