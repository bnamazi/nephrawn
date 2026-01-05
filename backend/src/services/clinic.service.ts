import { prisma } from "../lib/prisma.js";
import { ClinicStatus, ClinicMembershipRole, ClinicMembershipStatus, Prisma } from "@prisma/client";

// ============================================
// Clinic CRUD
// ============================================

export type CreateClinicInput = {
  name: string;
  slug: string;
  npi?: string;
  taxId?: string;
  address?: {
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
    country?: string;
  };
  phone?: string;
  fax?: string;
  email?: string;
  website?: string;
  timezone?: string;
  ownerId: string; // Clinician who will be the owner
};

export type CreateClinicResult =
  | { success: true; clinic: Awaited<ReturnType<typeof prisma.clinic.create>> }
  | { success: false; error: string; code?: string };

/**
 * Create a new clinic with the specified owner
 */
export async function createClinic(input: CreateClinicInput): Promise<CreateClinicResult> {
  // Validate slug format (URL-safe)
  if (!/^[a-z0-9-]+$/.test(input.slug)) {
    return {
      success: false,
      error: "Slug must contain only lowercase letters, numbers, and hyphens",
      code: "INVALID_SLUG",
    };
  }

  // Check slug uniqueness
  const existingSlug = await prisma.clinic.findUnique({
    where: { slug: input.slug },
  });
  if (existingSlug) {
    return { success: false, error: "Clinic slug already exists", code: "SLUG_EXISTS" };
  }

  // Check NPI uniqueness if provided
  if (input.npi) {
    const existingNpi = await prisma.clinic.findUnique({
      where: { npi: input.npi },
    });
    if (existingNpi) {
      return { success: false, error: "NPI already registered", code: "NPI_EXISTS" };
    }
  }

  // Create clinic and owner membership in transaction
  const result = await prisma.$transaction(async (tx) => {
    const clinic = await tx.clinic.create({
      data: {
        name: input.name,
        slug: input.slug,
        npi: input.npi,
        taxId: input.taxId,
        address: input.address,
        phone: input.phone,
        fax: input.fax,
        email: input.email,
        website: input.website,
        timezone: input.timezone ?? "America/New_York",
      },
    });

    // Create owner membership
    await tx.clinicMembership.create({
      data: {
        clinicId: clinic.id,
        clinicianId: input.ownerId,
        role: "OWNER",
        status: "ACTIVE",
      },
    });

    return clinic;
  });

  return { success: true, clinic: result };
}

export type UpdateClinicInput = {
  name?: string;
  npi?: string;
  taxId?: string;
  address?: {
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
    country?: string;
  };
  phone?: string;
  fax?: string;
  email?: string;
  website?: string;
  timezone?: string;
  settings?: Prisma.InputJsonValue;
};

/**
 * Update clinic details (owner/admin only)
 */
export async function updateClinic(
  clinicId: string,
  clinicianId: string,
  input: UpdateClinicInput
): Promise<{ success: boolean; error?: string; clinic?: Awaited<ReturnType<typeof prisma.clinic.findUnique>> }> {
  // Verify admin/owner access
  const membership = await prisma.clinicMembership.findUnique({
    where: { clinicId_clinicianId: { clinicId, clinicianId } },
  });

  if (!membership || membership.status !== "ACTIVE") {
    return { success: false, error: "Not a member of this clinic" };
  }

  if (!["OWNER", "ADMIN"].includes(membership.role)) {
    return { success: false, error: "Must be owner or admin to update clinic" };
  }

  // Check NPI uniqueness if changing
  if (input.npi) {
    const existingNpi = await prisma.clinic.findFirst({
      where: { npi: input.npi, id: { not: clinicId } },
    });
    if (existingNpi) {
      return { success: false, error: "NPI already registered to another clinic" };
    }
  }

  const clinic = await prisma.clinic.update({
    where: { id: clinicId },
    data: {
      name: input.name,
      npi: input.npi,
      taxId: input.taxId,
      address: input.address,
      phone: input.phone,
      fax: input.fax,
      email: input.email,
      website: input.website,
      timezone: input.timezone,
      settings: input.settings,
    },
  });

  return { success: true, clinic };
}

/**
 * Get clinic details (any active member)
 */
export async function getClinic(clinicId: string, clinicianId: string) {
  const membership = await prisma.clinicMembership.findUnique({
    where: { clinicId_clinicianId: { clinicId, clinicianId } },
  });

  if (!membership || membership.status !== "ACTIVE") {
    return null;
  }

  return prisma.clinic.findUnique({
    where: { id: clinicId },
    include: {
      _count: {
        select: {
          memberships: { where: { status: "ACTIVE" } },
          enrollments: { where: { status: "ACTIVE" } },
        },
      },
    },
  });
}

/**
 * Suspend a clinic (admin only - system level)
 */
export async function suspendClinic(clinicId: string): Promise<{ success: boolean; error?: string }> {
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
  if (!clinic) {
    return { success: false, error: "Clinic not found" };
  }

  await prisma.clinic.update({
    where: { id: clinicId },
    data: { status: "SUSPENDED" },
  });

  return { success: true };
}

// ============================================
// Membership Management
// ============================================

export type InviteClinicianInput = {
  clinicId: string;
  inviterId: string; // Must be owner/admin
  clinicianEmail: string;
  role: ClinicMembershipRole;
};

/**
 * Add a clinician to a clinic
 */
export async function addClinicianToClinic(
  input: InviteClinicianInput
): Promise<{ success: boolean; error?: string; membership?: Awaited<ReturnType<typeof prisma.clinicMembership.create>> }> {
  // Verify inviter is owner/admin
  const inviterMembership = await prisma.clinicMembership.findUnique({
    where: { clinicId_clinicianId: { clinicId: input.clinicId, clinicianId: input.inviterId } },
  });

  if (!inviterMembership || inviterMembership.status !== "ACTIVE") {
    return { success: false, error: "Not a member of this clinic" };
  }

  if (!["OWNER", "ADMIN"].includes(inviterMembership.role)) {
    return { success: false, error: "Must be owner or admin to add members" };
  }

  // Only owner can add other owners/admins
  if (["OWNER", "ADMIN"].includes(input.role) && inviterMembership.role !== "OWNER") {
    return { success: false, error: "Only owner can add owners or admins" };
  }

  // Find clinician by email
  const clinician = await prisma.clinician.findUnique({
    where: { email: input.clinicianEmail },
  });

  if (!clinician) {
    return { success: false, error: "Clinician not found with that email" };
  }

  // Check if already a member
  const existingMembership = await prisma.clinicMembership.findUnique({
    where: { clinicId_clinicianId: { clinicId: input.clinicId, clinicianId: clinician.id } },
  });

  if (existingMembership) {
    if (existingMembership.status === "ACTIVE") {
      return { success: false, error: "Clinician is already a member of this clinic" };
    }
    // Reactivate membership
    const updated = await prisma.clinicMembership.update({
      where: { id: existingMembership.id },
      data: { status: "ACTIVE", role: input.role },
    });
    return { success: true, membership: updated };
  }

  const membership = await prisma.clinicMembership.create({
    data: {
      clinicId: input.clinicId,
      clinicianId: clinician.id,
      role: input.role,
      status: "ACTIVE",
    },
  });

  return { success: true, membership };
}

/**
 * Remove a clinician from a clinic
 */
export async function removeClinicianFromClinic(
  clinicId: string,
  removerId: string,
  targetClinicianId: string
): Promise<{ success: boolean; error?: string }> {
  // Verify remover is owner/admin
  const removerMembership = await prisma.clinicMembership.findUnique({
    where: { clinicId_clinicianId: { clinicId, clinicianId: removerId } },
  });

  if (!removerMembership || removerMembership.status !== "ACTIVE") {
    return { success: false, error: "Not a member of this clinic" };
  }

  if (!["OWNER", "ADMIN"].includes(removerMembership.role)) {
    return { success: false, error: "Must be owner or admin to remove members" };
  }

  // Get target membership
  const targetMembership = await prisma.clinicMembership.findUnique({
    where: { clinicId_clinicianId: { clinicId, clinicianId: targetClinicianId } },
  });

  if (!targetMembership || targetMembership.status !== "ACTIVE") {
    return { success: false, error: "Target clinician is not an active member" };
  }

  // Owners can only be removed by themselves
  if (targetMembership.role === "OWNER" && removerId !== targetClinicianId) {
    return { success: false, error: "Owners can only remove themselves" };
  }

  // Cannot remove the last owner
  if (targetMembership.role === "OWNER") {
    const ownerCount = await prisma.clinicMembership.count({
      where: { clinicId, role: "OWNER", status: "ACTIVE" },
    });
    if (ownerCount <= 1) {
      return { success: false, error: "Cannot remove the last owner. Transfer ownership first." };
    }
  }

  // Admins can only remove clinicians/staff, not other admins
  if (removerMembership.role === "ADMIN" && ["OWNER", "ADMIN"].includes(targetMembership.role)) {
    return { success: false, error: "Admins cannot remove owners or other admins" };
  }

  await prisma.clinicMembership.update({
    where: { id: targetMembership.id },
    data: { status: "INACTIVE" },
  });

  return { success: true };
}

/**
 * Update a clinician's role in a clinic
 */
export async function updateMemberRole(
  clinicId: string,
  updaterId: string,
  targetClinicianId: string,
  newRole: ClinicMembershipRole
): Promise<{ success: boolean; error?: string }> {
  // Verify updater is owner
  const updaterMembership = await prisma.clinicMembership.findUnique({
    where: { clinicId_clinicianId: { clinicId, clinicianId: updaterId } },
  });

  if (!updaterMembership || updaterMembership.status !== "ACTIVE") {
    return { success: false, error: "Not a member of this clinic" };
  }

  if (updaterMembership.role !== "OWNER") {
    return { success: false, error: "Only owners can change member roles" };
  }

  // Get target membership
  const targetMembership = await prisma.clinicMembership.findUnique({
    where: { clinicId_clinicianId: { clinicId, clinicianId: targetClinicianId } },
  });

  if (!targetMembership || targetMembership.status !== "ACTIVE") {
    return { success: false, error: "Target clinician is not an active member" };
  }

  // Cannot demote the last owner
  if (targetMembership.role === "OWNER" && newRole !== "OWNER") {
    const ownerCount = await prisma.clinicMembership.count({
      where: { clinicId, role: "OWNER", status: "ACTIVE" },
    });
    if (ownerCount <= 1) {
      return { success: false, error: "Cannot demote the last owner. Add another owner first." };
    }
  }

  await prisma.clinicMembership.update({
    where: { id: targetMembership.id },
    data: { role: newRole },
  });

  return { success: true };
}

/**
 * List members of a clinic
 */
export async function listClinicMembers(clinicId: string, clinicianId: string) {
  // Verify access
  const membership = await prisma.clinicMembership.findUnique({
    where: { clinicId_clinicianId: { clinicId, clinicianId } },
  });

  if (!membership || membership.status !== "ACTIVE") {
    return null;
  }

  return prisma.clinicMembership.findMany({
    where: { clinicId, status: "ACTIVE" },
    include: {
      clinician: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
  });
}
