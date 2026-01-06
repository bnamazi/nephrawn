import { CarePlan, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { fromCanonical } from "../lib/units.js";

// ============================================
// Types
// ============================================

export type BpRange = {
  min: number;
  max: number;
};

export type CarePlanInput = {
  dryWeightKg?: number;
  targetBpSystolic?: BpRange;
  targetBpDiastolic?: BpRange;
  priorHfHospitalizations?: number;
  fluidRetentionRisk?: boolean;
  fallsRisk?: boolean;
  notes?: string;
};

export type CarePlanCompleteness = {
  carePlanScore: number;
  missingCritical: string[];
  showTargetsBanner: boolean;
};

// Validation limits
const VALIDATION = {
  dryWeightKg: { min: 20, max: 300 },
  targetBpSystolic: { min: { min: 70, max: 200 }, max: { min: 80, max: 250 } },
  targetBpDiastolic: { min: { min: 40, max: 120 }, max: { min: 50, max: 150 } },
  priorHfHospitalizations: { min: 0, max: 50 },
};

// ============================================
// Care Plan CRUD
// ============================================

export async function getCarePlan(enrollmentId: string) {
  return prisma.carePlan.findUnique({
    where: { enrollmentId },
  });
}

export async function getCarePlanByPatientAndClinician(
  patientId: string,
  clinicianId: string
) {
  // Find the enrollment first
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      patientId,
      clinicianId,
      status: "ACTIVE",
    },
    include: {
      carePlan: true,
      clinic: { select: { id: true, name: true } },
    },
  });

  if (!enrollment) {
    return null;
  }

  return {
    carePlan: enrollment.carePlan,
    enrollment: {
      id: enrollment.id,
      clinicId: enrollment.clinicId,
      clinicName: enrollment.clinic.name,
    },
  };
}

export async function getOrCreateCarePlan(enrollmentId: string) {
  let carePlan = await prisma.carePlan.findUnique({
    where: { enrollmentId },
  });

  if (!carePlan) {
    carePlan = await prisma.carePlan.create({
      data: { enrollmentId },
    });
  }

  return carePlan;
}

export async function updateCarePlan(
  patientId: string,
  clinicianId: string,
  data: CarePlanInput,
  reason?: string
): Promise<CarePlan | null> {
  // Find the enrollment
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      patientId,
      clinicianId,
      status: "ACTIVE",
    },
  });

  if (!enrollment) {
    return null;
  }

  // Validate inputs
  const validationError = validateCarePlanInput(data);
  if (validationError) {
    throw new Error(validationError);
  }

  const carePlan = await getOrCreateCarePlan(enrollment.id);
  const oldValues = { ...carePlan };

  // Build update data
  const updateData: Prisma.CarePlanUpdateInput = {};

  if (data.dryWeightKg !== undefined) updateData.dryWeightKg = data.dryWeightKg;
  if (data.targetBpSystolic !== undefined)
    updateData.targetBpSystolic = data.targetBpSystolic;
  if (data.targetBpDiastolic !== undefined)
    updateData.targetBpDiastolic = data.targetBpDiastolic;
  if (data.priorHfHospitalizations !== undefined)
    updateData.priorHfHospitalizations = data.priorHfHospitalizations;
  if (data.fluidRetentionRisk !== undefined)
    updateData.fluidRetentionRisk = data.fluidRetentionRisk;
  if (data.fallsRisk !== undefined) updateData.fallsRisk = data.fallsRisk;
  if (data.notes !== undefined) updateData.notes = data.notes;

  // Get clinician name for audit
  const clinician = await prisma.clinician.findUnique({
    where: { id: clinicianId },
    select: { name: true },
  });

  // Update care plan and create audit log in transaction
  const [updatedCarePlan] = await prisma.$transaction([
    prisma.carePlan.update({
      where: { id: carePlan.id },
      data: updateData,
    }),
    prisma.patientProfileAudit.create({
      data: {
        patientId,
        entityType: "CARE_PLAN",
        entityId: carePlan.id,
        actorType: "CLINICIAN",
        actorId: clinicianId,
        actorName: clinician?.name || "Clinician",
        changedFields: buildChangedFields(oldValues, data),
        reason,
      },
    }),
  ]);

  return updatedCarePlan;
}

// ============================================
// Completeness Calculation
// ============================================

export function calculateCarePlanCompleteness(
  carePlan: CarePlan | null
): CarePlanCompleteness {
  if (!carePlan) {
    return {
      carePlanScore: 0,
      missingCritical: ["dryWeightKg"],
      showTargetsBanner: true,
    };
  }

  const missingCritical: string[] = [];

  if (!carePlan.dryWeightKg) missingCritical.push("dryWeightKg");

  // Calculate score
  const totalFields = 3; // dryWeight, targetBpSystolic, targetBpDiastolic
  let filled = 0;
  if (carePlan.dryWeightKg) filled++;
  if (carePlan.targetBpSystolic) filled++;
  if (carePlan.targetBpDiastolic) filled++;

  return {
    carePlanScore: Math.round((filled / totalFields) * 100),
    missingCritical,
    showTargetsBanner: !carePlan.dryWeightKg || !carePlan.targetBpSystolic,
  };
}

// ============================================
// Response Formatting
// ============================================

export function formatCarePlanResponse(carePlan: CarePlan | null) {
  if (!carePlan) return null;

  const dryWeightKg = carePlan.dryWeightKg
    ? Number(carePlan.dryWeightKg)
    : null;

  return {
    id: carePlan.id,
    enrollmentId: carePlan.enrollmentId,

    dryWeightKg,
    dryWeightLbs: dryWeightKg
      ? Math.round(fromCanonical("WEIGHT", dryWeightKg, "lbs") * 10) / 10
      : null,

    targetBpSystolic: carePlan.targetBpSystolic as BpRange | null,
    targetBpDiastolic: carePlan.targetBpDiastolic as BpRange | null,

    priorHfHospitalizations: carePlan.priorHfHospitalizations,
    fluidRetentionRisk: carePlan.fluidRetentionRisk,
    fallsRisk: carePlan.fallsRisk,

    notes: carePlan.notes,

    updatedAt: carePlan.updatedAt.toISOString(),
  };
}

// ============================================
// Context for Alerts
// ============================================

export async function getContextForAlert(patientId: string, clinicianId?: string) {
  // Get profile
  const profile = await prisma.patientProfile.findUnique({
    where: { patientId },
  });

  // Get care plan (use first active enrollment if clinicianId not specified)
  let carePlan: CarePlan | null = null;

  if (clinicianId) {
    const enrollment = await prisma.enrollment.findFirst({
      where: { patientId, clinicianId, status: "ACTIVE" },
      include: { carePlan: true },
    });
    carePlan = enrollment?.carePlan ?? null;
  } else {
    // Get the primary enrollment's care plan
    const enrollment = await prisma.enrollment.findFirst({
      where: { patientId, status: "ACTIVE", isPrimary: true },
      include: { carePlan: true },
    });
    carePlan = enrollment?.carePlan ?? null;
  }

  return {
    // From profile
    ckdStage: profile?.ckdStageClinician ?? profile?.ckdStageSelfReported ?? null,
    ckdStageSource: profile?.ckdStageClinician
      ? "clinician"
      : profile?.ckdStageSelfReported
        ? "self_reported"
        : null,
    dialysisStatus: profile?.dialysisStatus ?? null,
    hasHeartFailure: profile?.hasHeartFailure ?? false,
    onDiuretics: profile?.onDiuretics ?? false,

    // From care plan
    dryWeightKg: carePlan?.dryWeightKg ? Number(carePlan.dryWeightKg) : null,
    targetBpSystolic: carePlan?.targetBpSystolic as BpRange | null,
    targetBpDiastolic: carePlan?.targetBpDiastolic as BpRange | null,
    fluidRetentionRisk: carePlan?.fluidRetentionRisk ?? false,

    // Completeness indicator
    contextComplete: !!(
      profile?.ckdStageClinician &&
      carePlan?.dryWeightKg
    ),
  };
}

// ============================================
// Validation
// ============================================

function validateCarePlanInput(data: CarePlanInput): string | null {
  if (data.dryWeightKg !== undefined) {
    if (
      data.dryWeightKg < VALIDATION.dryWeightKg.min ||
      data.dryWeightKg > VALIDATION.dryWeightKg.max
    ) {
      return `dryWeightKg must be between ${VALIDATION.dryWeightKg.min} and ${VALIDATION.dryWeightKg.max}`;
    }
  }

  if (data.targetBpSystolic !== undefined) {
    const { min, max } = data.targetBpSystolic;
    if (min < VALIDATION.targetBpSystolic.min.min || min > VALIDATION.targetBpSystolic.min.max) {
      return `targetBpSystolic.min must be between ${VALIDATION.targetBpSystolic.min.min} and ${VALIDATION.targetBpSystolic.min.max}`;
    }
    if (max < VALIDATION.targetBpSystolic.max.min || max > VALIDATION.targetBpSystolic.max.max) {
      return `targetBpSystolic.max must be between ${VALIDATION.targetBpSystolic.max.min} and ${VALIDATION.targetBpSystolic.max.max}`;
    }
    if (max < min) {
      return "targetBpSystolic.max must be >= targetBpSystolic.min";
    }
  }

  if (data.targetBpDiastolic !== undefined) {
    const { min, max } = data.targetBpDiastolic;
    if (min < VALIDATION.targetBpDiastolic.min.min || min > VALIDATION.targetBpDiastolic.min.max) {
      return `targetBpDiastolic.min must be between ${VALIDATION.targetBpDiastolic.min.min} and ${VALIDATION.targetBpDiastolic.min.max}`;
    }
    if (max < VALIDATION.targetBpDiastolic.max.min || max > VALIDATION.targetBpDiastolic.max.max) {
      return `targetBpDiastolic.max must be between ${VALIDATION.targetBpDiastolic.max.min} and ${VALIDATION.targetBpDiastolic.max.max}`;
    }
    if (max < min) {
      return "targetBpDiastolic.max must be >= targetBpDiastolic.min";
    }
  }

  if (data.priorHfHospitalizations !== undefined) {
    if (
      data.priorHfHospitalizations < VALIDATION.priorHfHospitalizations.min ||
      data.priorHfHospitalizations > VALIDATION.priorHfHospitalizations.max
    ) {
      return `priorHfHospitalizations must be between ${VALIDATION.priorHfHospitalizations.min} and ${VALIDATION.priorHfHospitalizations.max}`;
    }
  }

  return null;
}

// ============================================
// Helpers
// ============================================

function buildChangedFields(
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>
): Prisma.InputJsonValue {
  const changes: Record<string, { old: unknown; new: unknown }> = {};

  for (const [key, newVal] of Object.entries(newValues)) {
    if (newVal === undefined) continue;

    const oldVal = oldValues[key];
    // Convert Decimal to number for comparison
    const oldCompare =
      oldVal instanceof Object && "toNumber" in oldVal
        ? (oldVal as { toNumber: () => number }).toNumber()
        : oldVal;

    // Deep compare for objects (BP ranges)
    const isDifferent =
      typeof newVal === "object"
        ? JSON.stringify(oldCompare) !== JSON.stringify(newVal)
        : oldCompare !== newVal;

    if (isDifferent) {
      changes[key] = { old: oldCompare ?? null, new: newVal };
    }
  }

  return changes as Prisma.InputJsonValue;
}
