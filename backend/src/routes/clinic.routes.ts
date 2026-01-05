import { Router, Request, Response } from "express";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";
import {
  createClinic,
  updateClinic,
  getClinic,
  addClinicianToClinic,
  removeClinicianFromClinic,
  updateMemberRole,
  listClinicMembers,
} from "../services/clinic.service.js";

const router = Router();

// ============================================
// Clinic CRUD
// ============================================

// POST /admin/clinics - Create a new clinic (admin only)
router.post(
  "/admin/clinics",
  authenticate,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const clinicianId = req.user!.sub;
      const { name, slug, npi, taxId, address, phone, fax, email, website, timezone } = req.body;

      // Validate required fields
      if (!name || typeof name !== "string" || name.trim().length < 2) {
        res.status(400).json({ error: "Clinic name must be at least 2 characters" });
        return;
      }

      if (!slug || typeof slug !== "string" || slug.length < 2) {
        res.status(400).json({ error: "Clinic slug must be at least 2 characters" });
        return;
      }

      const result = await createClinic({
        name: name.trim(),
        slug: slug.toLowerCase().trim(),
        npi: npi?.trim(),
        taxId: taxId?.trim(),
        address,
        phone: phone?.trim(),
        fax: fax?.trim(),
        email: email?.trim(),
        website: website?.trim(),
        timezone: timezone?.trim(),
        ownerId: clinicianId,
      });

      if (!result.success) {
        const statusCode = result.code === "SLUG_EXISTS" || result.code === "NPI_EXISTS" ? 409 : 400;
        res.status(statusCode).json({ error: result.error, code: result.code });
        return;
      }

      res.status(201).json({ clinic: result.clinic });
    } catch (error) {
      res.status(500).json({ error: "Failed to create clinic" });
    }
  }
);

// GET /clinician/clinic/:clinicId - Get clinic details
router.get(
  "/clinician/clinic/:clinicId",
  authenticate,
  requireRole("clinician", "admin"),
  async (req: Request, res: Response) => {
    try {
      const { clinicId } = req.params;
      const clinicianId = req.user!.sub;

      const clinic = await getClinic(clinicId, clinicianId);

      if (!clinic) {
        res.status(404).json({ error: "Clinic not found or not authorized" });
        return;
      }

      res.json({ clinic });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch clinic" });
    }
  }
);

// PUT /clinician/clinic/:clinicId - Update clinic details
router.put(
  "/clinician/clinic/:clinicId",
  authenticate,
  requireRole("clinician", "admin"),
  async (req: Request, res: Response) => {
    try {
      const { clinicId } = req.params;
      const clinicianId = req.user!.sub;
      const { name, npi, taxId, address, phone, fax, email, website, timezone, settings } = req.body;

      const result = await updateClinic(clinicId, clinicianId, {
        name: name?.trim(),
        npi: npi?.trim(),
        taxId: taxId?.trim(),
        address,
        phone: phone?.trim(),
        fax: fax?.trim(),
        email: email?.trim(),
        website: website?.trim(),
        timezone: timezone?.trim(),
        settings,
      });

      if (!result.success) {
        res.status(403).json({ error: result.error });
        return;
      }

      res.json({ clinic: result.clinic });
    } catch (error) {
      res.status(500).json({ error: "Failed to update clinic" });
    }
  }
);

// ============================================
// Membership Management
// ============================================

// GET /clinician/clinic/:clinicId/members - List clinic members
router.get(
  "/clinician/clinic/:clinicId/members",
  authenticate,
  requireRole("clinician", "admin"),
  async (req: Request, res: Response) => {
    try {
      const { clinicId } = req.params;
      const clinicianId = req.user!.sub;

      const members = await listClinicMembers(clinicId, clinicianId);

      if (members === null) {
        res.status(403).json({ error: "Not authorized to view members" });
        return;
      }

      res.json({
        members: members.map((m) => ({
          id: m.id,
          clinicianId: m.clinician.id,
          name: m.clinician.name,
          email: m.clinician.email,
          role: m.role,
          joinedAt: m.joinedAt,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch members" });
    }
  }
);

// POST /clinician/clinic/:clinicId/members - Add a clinician to the clinic
router.post(
  "/clinician/clinic/:clinicId/members",
  authenticate,
  requireRole("clinician", "admin"),
  async (req: Request, res: Response) => {
    try {
      const { clinicId } = req.params;
      const clinicianId = req.user!.sub;
      const { email, role } = req.body;

      // Validate
      if (!email || typeof email !== "string") {
        res.status(400).json({ error: "Email is required" });
        return;
      }

      const validRoles = ["OWNER", "ADMIN", "CLINICIAN", "STAFF"];
      if (!role || !validRoles.includes(role)) {
        res.status(400).json({ error: `Role must be one of: ${validRoles.join(", ")}` });
        return;
      }

      const result = await addClinicianToClinic({
        clinicId,
        inviterId: clinicianId,
        clinicianEmail: email.trim().toLowerCase(),
        role,
      });

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.status(201).json({
        member: {
          id: result.membership!.id,
          clinicianId: result.membership!.clinicianId,
          role: result.membership!.role,
          joinedAt: result.membership!.joinedAt,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to add member" });
    }
  }
);

// DELETE /clinician/clinic/:clinicId/members/:memberId - Remove a clinician from the clinic
router.delete(
  "/clinician/clinic/:clinicId/members/:clinicianId",
  authenticate,
  requireRole("clinician", "admin"),
  async (req: Request, res: Response) => {
    try {
      const { clinicId, clinicianId: targetClinicianId } = req.params;
      const removerId = req.user!.sub;

      const result = await removeClinicianFromClinic(clinicId, removerId, targetClinicianId);

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({ success: true, message: "Member removed" });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove member" });
    }
  }
);

// PUT /clinician/clinic/:clinicId/members/:clinicianId/role - Update member role
router.put(
  "/clinician/clinic/:clinicId/members/:clinicianId/role",
  authenticate,
  requireRole("clinician", "admin"),
  async (req: Request, res: Response) => {
    try {
      const { clinicId, clinicianId: targetClinicianId } = req.params;
      const updaterId = req.user!.sub;
      const { role } = req.body;

      const validRoles = ["OWNER", "ADMIN", "CLINICIAN", "STAFF"];
      if (!role || !validRoles.includes(role)) {
        res.status(400).json({ error: `Role must be one of: ${validRoles.join(", ")}` });
        return;
      }

      const result = await updateMemberRole(clinicId, updaterId, targetClinicianId, role);

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({ success: true, message: "Role updated" });
    } catch (error) {
      res.status(500).json({ error: "Failed to update role" });
    }
  }
);

export default router;
