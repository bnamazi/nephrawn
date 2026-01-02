import { Router, Request, Response } from "express";
import { AlertStatus, MeasurementType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
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

// GET /clinician/patients/:patientId/measurements - Get patient's measurements
router.get("/patients/:patientId/measurements", async (req: Request, res: Response) => {
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
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        patientId_clinicianId: {
          patientId: alert.patientId,
          clinicianId,
        },
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

export default router;
