import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { ClinicMembershipRole } from "@prisma/client";

/**
 * Middleware to verify clinician has active membership in the specified clinic.
 * Expects :clinicId in route params and authenticated user in req.user
 *
 * Optionally restricts to specific roles (e.g., only OWNER or ADMIN can manage invites)
 */
export function requireClinicMembership(allowedRoles?: ClinicMembershipRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = req.params;
      const clinicianId = req.user?.sub;

      if (!clinicId) {
        res.status(400).json({ error: "Clinic ID is required" });
        return;
      }

      if (!clinicianId) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      // Check clinic exists
      const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
      });

      if (!clinic || clinic.status !== "ACTIVE") {
        res.status(404).json({ error: "Clinic not found" });
        return;
      }

      // Check membership
      const membership = await prisma.clinicMembership.findUnique({
        where: {
          clinicId_clinicianId: {
            clinicId,
            clinicianId,
          },
        },
      });

      if (!membership || membership.status !== "ACTIVE") {
        res.status(403).json({ error: "Not a member of this clinic" });
        return;
      }

      // Check role if specified
      if (allowedRoles && !allowedRoles.includes(membership.role)) {
        res.status(403).json({ error: "Insufficient permissions for this action" });
        return;
      }

      // Attach clinic and membership to request for downstream use
      (req as any).clinic = clinic;
      (req as any).clinicMembership = membership;

      next();
    } catch (error) {
      res.status(500).json({ error: "Failed to verify clinic membership" });
    }
  };
}

/**
 * Shorthand for requiring any active membership
 */
export const requireActiveMembership = requireClinicMembership();

/**
 * Shorthand for requiring admin-level access (OWNER or ADMIN)
 */
export const requireClinicAdmin = requireClinicMembership(["OWNER", "ADMIN"]);

/**
 * Shorthand for requiring owner access only
 */
export const requireClinicOwner = requireClinicMembership(["OWNER"]);
