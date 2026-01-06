import {
  PatientProfile,
  CkdStage,
  Sex,
  KidneyDiseaseEtiology,
  DialysisStatus,
  TransplantStatus,
  DiabetesType,
  NyhaClass,
  Prisma,
} from "@prisma/client";
import { prisma } from "../lib/prisma.js";

// ============================================
// Types
// ============================================

// Fields patients can edit
export type PatientEditableFields = {
  sex?: Sex;
  heightCm?: number;
  ckdStageSelfReported?: CkdStage;
  primaryEtiology?: KidneyDiseaseEtiology;
  dialysisStatus?: DialysisStatus;
  dialysisStartDate?: Date;
  transplantStatus?: TransplantStatus;
  transplantDate?: Date;
  hasHeartFailure?: boolean;
  diabetesType?: DiabetesType;
  hasHypertension?: boolean;
  otherConditions?: string[];
  onDiuretics?: boolean;
  onAceArbInhibitor?: boolean;
  onSglt2Inhibitor?: boolean;
  onNsaids?: boolean;
  onMra?: boolean;
  onInsulin?: boolean;
};

// Additional fields clinicians can edit
export type ClinicianEditableFields = PatientEditableFields & {
  ckdStageClinician?: CkdStage;
  heartFailureClass?: NyhaClass;
  medicationNotes?: string;
};

export type ProfileCompleteness = {
  profileScore: number;
  missingCritical: string[];
  missingRecommended: string[];
  showProfileBanner: boolean;
};

// Display labels for enums
export const CKD_STAGE_LABELS: Record<CkdStage, string> = {
  STAGE_1: "Stage 1 (GFR ≥90)",
  STAGE_2: "Stage 2 (GFR 60-89)",
  STAGE_3A: "Stage 3a (GFR 45-59)",
  STAGE_3B: "Stage 3b (GFR 30-44)",
  STAGE_4: "Stage 4 (GFR 15-29)",
  STAGE_5: "Stage 5 (GFR <15)",
  STAGE_5D: "Stage 5D (on dialysis)",
  TRANSPLANT: "Kidney Transplant",
  UNKNOWN: "Unknown",
};

export const DIALYSIS_STATUS_LABELS: Record<DialysisStatus, string> = {
  NONE: "Not on dialysis",
  HEMODIALYSIS: "Hemodialysis",
  PERITONEAL_DIALYSIS: "Peritoneal Dialysis",
};

export const DIABETES_LABELS: Record<DiabetesType, string> = {
  NONE: "None",
  TYPE_1: "Type 1 Diabetes",
  TYPE_2: "Type 2 Diabetes",
};

export const NYHA_LABELS: Record<NyhaClass, string> = {
  CLASS_1: "Class I - No limitation",
  CLASS_2: "Class II - Slight limitation",
  CLASS_3: "Class III - Marked limitation",
  CLASS_4: "Class IV - Severe limitation",
};

export const ETIOLOGY_LABELS: Record<KidneyDiseaseEtiology, string> = {
  DIABETES: "Diabetic Nephropathy",
  HYPERTENSION: "Hypertensive Nephrosclerosis",
  GLOMERULONEPHRITIS: "Glomerulonephritis",
  POLYCYSTIC: "Polycystic Kidney Disease",
  OBSTRUCTIVE: "Obstructive Uropathy",
  OTHER: "Other",
  UNKNOWN: "Unknown",
};

// Critical fields for profile completeness
const CRITICAL_FIELDS = ["ckdStageClinician", "dialysisStatus"];
const RECOMMENDED_FIELDS = [
  "hasHeartFailure",
  "diabetesType",
  "hasHypertension",
  "heightCm",
];

// ============================================
// Profile CRUD
// ============================================

export async function getProfile(patientId: string) {
  return prisma.patientProfile.findUnique({
    where: { patientId },
  });
}

export async function getOrCreateProfile(patientId: string) {
  let profile = await prisma.patientProfile.findUnique({
    where: { patientId },
  });

  if (!profile) {
    profile = await prisma.patientProfile.create({
      data: { patientId },
    });
  }

  return profile;
}

export async function updateProfileByPatient(
  patientId: string,
  data: PatientEditableFields,
  reason?: string
) {
  const profile = await getOrCreateProfile(patientId);
  const oldValues = { ...profile };

  // Build update data
  const updateData: Prisma.PatientProfileUpdateInput = {};

  if (data.sex !== undefined) updateData.sex = data.sex;
  if (data.heightCm !== undefined) updateData.heightCm = data.heightCm;
  if (data.ckdStageSelfReported !== undefined)
    updateData.ckdStageSelfReported = data.ckdStageSelfReported;
  if (data.primaryEtiology !== undefined)
    updateData.primaryEtiology = data.primaryEtiology;
  if (data.dialysisStatus !== undefined)
    updateData.dialysisStatus = data.dialysisStatus;
  if (data.dialysisStartDate !== undefined)
    updateData.dialysisStartDate = data.dialysisStartDate;
  if (data.transplantStatus !== undefined)
    updateData.transplantStatus = data.transplantStatus;
  if (data.transplantDate !== undefined)
    updateData.transplantDate = data.transplantDate;
  if (data.hasHeartFailure !== undefined)
    updateData.hasHeartFailure = data.hasHeartFailure;
  if (data.diabetesType !== undefined) updateData.diabetesType = data.diabetesType;
  if (data.hasHypertension !== undefined)
    updateData.hasHypertension = data.hasHypertension;
  if (data.otherConditions !== undefined)
    updateData.otherConditions = data.otherConditions;
  if (data.onDiuretics !== undefined) updateData.onDiuretics = data.onDiuretics;
  if (data.onAceArbInhibitor !== undefined)
    updateData.onAceArbInhibitor = data.onAceArbInhibitor;
  if (data.onSglt2Inhibitor !== undefined)
    updateData.onSglt2Inhibitor = data.onSglt2Inhibitor;
  if (data.onNsaids !== undefined) updateData.onNsaids = data.onNsaids;
  if (data.onMra !== undefined) updateData.onMra = data.onMra;
  if (data.onInsulin !== undefined) updateData.onInsulin = data.onInsulin;

  // Get patient name for audit
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { name: true },
  });

  // Update profile and create audit log in transaction
  const [updatedProfile] = await prisma.$transaction([
    prisma.patientProfile.update({
      where: { id: profile.id },
      data: updateData,
    }),
    prisma.patientProfileAudit.create({
      data: {
        patientId,
        entityType: "PATIENT_PROFILE",
        entityId: profile.id,
        actorType: "PATIENT",
        actorId: patientId,
        actorName: patient?.name || "Patient",
        changedFields: buildChangedFields(oldValues, data),
        reason,
      },
    }),
  ]);

  return updatedProfile;
}

export async function updateProfileByClinician(
  patientId: string,
  clinicianId: string,
  data: ClinicianEditableFields,
  reason?: string
) {
  // Verify enrollment
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

  const profile = await getOrCreateProfile(patientId);
  const oldValues = { ...profile };

  // Build update data (includes all patient fields plus clinician-only fields)
  const updateData: Prisma.PatientProfileUpdateInput = {};

  // Patient-editable fields
  if (data.sex !== undefined) updateData.sex = data.sex;
  if (data.heightCm !== undefined) updateData.heightCm = data.heightCm;
  if (data.ckdStageSelfReported !== undefined)
    updateData.ckdStageSelfReported = data.ckdStageSelfReported;
  if (data.primaryEtiology !== undefined)
    updateData.primaryEtiology = data.primaryEtiology;
  if (data.dialysisStatus !== undefined)
    updateData.dialysisStatus = data.dialysisStatus;
  if (data.dialysisStartDate !== undefined)
    updateData.dialysisStartDate = data.dialysisStartDate;
  if (data.transplantStatus !== undefined)
    updateData.transplantStatus = data.transplantStatus;
  if (data.transplantDate !== undefined)
    updateData.transplantDate = data.transplantDate;
  if (data.hasHeartFailure !== undefined)
    updateData.hasHeartFailure = data.hasHeartFailure;
  if (data.diabetesType !== undefined) updateData.diabetesType = data.diabetesType;
  if (data.hasHypertension !== undefined)
    updateData.hasHypertension = data.hasHypertension;
  if (data.otherConditions !== undefined)
    updateData.otherConditions = data.otherConditions;
  if (data.onDiuretics !== undefined) updateData.onDiuretics = data.onDiuretics;
  if (data.onAceArbInhibitor !== undefined)
    updateData.onAceArbInhibitor = data.onAceArbInhibitor;
  if (data.onSglt2Inhibitor !== undefined)
    updateData.onSglt2Inhibitor = data.onSglt2Inhibitor;
  if (data.onNsaids !== undefined) updateData.onNsaids = data.onNsaids;
  if (data.onMra !== undefined) updateData.onMra = data.onMra;
  if (data.onInsulin !== undefined) updateData.onInsulin = data.onInsulin;

  // Clinician-only fields
  if (data.ckdStageClinician !== undefined) {
    updateData.ckdStageClinician = data.ckdStageClinician;
    updateData.ckdStageSetById = clinicianId;
    updateData.ckdStageSetAt = new Date();
  }
  if (data.heartFailureClass !== undefined)
    updateData.heartFailureClass = data.heartFailureClass;
  if (data.medicationNotes !== undefined)
    updateData.medicationNotes = data.medicationNotes;

  // Get clinician name for audit
  const clinician = await prisma.clinician.findUnique({
    where: { id: clinicianId },
    select: { name: true },
  });

  // Update profile and create audit log in transaction
  const [updatedProfile] = await prisma.$transaction([
    prisma.patientProfile.update({
      where: { id: profile.id },
      data: updateData,
    }),
    prisma.patientProfileAudit.create({
      data: {
        patientId,
        entityType: "PATIENT_PROFILE",
        entityId: profile.id,
        actorType: "CLINICIAN",
        actorId: clinicianId,
        actorName: clinician?.name || "Clinician",
        changedFields: buildChangedFields(oldValues, data),
        reason,
      },
    }),
  ]);

  return updatedProfile;
}

// ============================================
// Profile History
// ============================================

export async function getProfileHistory(
  patientId: string,
  options?: { limit?: number; offset?: number }
) {
  return prisma.patientProfileAudit.findMany({
    where: { patientId },
    orderBy: { timestamp: "desc" },
    take: options?.limit ?? 50,
    skip: options?.offset ?? 0,
  });
}

// ============================================
// Completeness Calculation
// ============================================

export function calculateProfileCompleteness(
  profile: PatientProfile | null
): ProfileCompleteness {
  if (!profile) {
    return {
      profileScore: 0,
      missingCritical: CRITICAL_FIELDS,
      missingRecommended: RECOMMENDED_FIELDS,
      showProfileBanner: true,
    };
  }

  const missingCritical: string[] = [];
  const missingRecommended: string[] = [];

  // Check critical fields
  if (!profile.ckdStageClinician) missingCritical.push("ckdStageClinician");
  if (profile.dialysisStatus === "NONE" && !profile.ckdStageClinician) {
    // dialysisStatus defaults to NONE, so only flag if no CKD stage is set
    // Actually, dialysisStatus is set by default, so we check if it's been explicitly set
    // For now, we consider it "set" if ckdStage is set
  }

  // Check recommended fields
  if (!profile.heightCm) missingRecommended.push("heightCm");
  if (profile.diabetesType === "NONE" && !profile.hasHeartFailure && !profile.hasHypertension) {
    // If no comorbidities are explicitly set, suggest they review
    missingRecommended.push("comorbidities");
  }

  // Calculate score (simple percentage)
  const totalFields = CRITICAL_FIELDS.length + RECOMMENDED_FIELDS.length;
  const filledCritical = CRITICAL_FIELDS.length - missingCritical.length;
  const filledRecommended = RECOMMENDED_FIELDS.length - missingRecommended.length;
  const score = Math.round(
    ((filledCritical * 2 + filledRecommended) / (totalFields + CRITICAL_FIELDS.length)) * 100
  );

  return {
    profileScore: score,
    missingCritical,
    missingRecommended,
    showProfileBanner: missingCritical.length > 0,
  };
}

// ============================================
// Response Formatting
// ============================================

export function formatProfileResponse(profile: PatientProfile | null) {
  if (!profile) return null;

  const ckdStageEffective = profile.ckdStageClinician ?? profile.ckdStageSelfReported;

  return {
    id: profile.id,
    patientId: profile.patientId,

    // Demographics
    sex: profile.sex,
    heightCm: profile.heightCm ? Number(profile.heightCm) : null,
    heightDisplay: profile.heightCm
      ? formatHeight(Number(profile.heightCm))
      : null,

    // CKD Context
    ckdStageSelfReported: profile.ckdStageSelfReported,
    ckdStageClinician: profile.ckdStageClinician,
    ckdStageEffective,
    ckdStageEffectiveLabel: ckdStageEffective
      ? CKD_STAGE_LABELS[ckdStageEffective]
      : "Unknown",
    ckdStageSource: profile.ckdStageClinician
      ? "clinician"
      : profile.ckdStageSelfReported
        ? "self_reported"
        : null,

    primaryEtiology: profile.primaryEtiology,
    primaryEtiologyLabel: profile.primaryEtiology
      ? ETIOLOGY_LABELS[profile.primaryEtiology]
      : null,
    dialysisStatus: profile.dialysisStatus,
    dialysisStatusLabel: DIALYSIS_STATUS_LABELS[profile.dialysisStatus],
    dialysisStartDate: profile.dialysisStartDate?.toISOString() ?? null,
    transplantStatus: profile.transplantStatus,
    transplantDate: profile.transplantDate?.toISOString() ?? null,

    // Comorbidities
    hasHeartFailure: profile.hasHeartFailure,
    heartFailureClass: profile.heartFailureClass,
    heartFailureLabel: profile.heartFailureClass
      ? NYHA_LABELS[profile.heartFailureClass]
      : null,
    diabetesType: profile.diabetesType,
    diabetesLabel: DIABETES_LABELS[profile.diabetesType],
    hasHypertension: profile.hasHypertension,
    otherConditions: (profile.otherConditions as string[]) ?? [],

    // Medications
    medications: {
      onDiuretics: profile.onDiuretics,
      onAceArbInhibitor: profile.onAceArbInhibitor,
      onSglt2Inhibitor: profile.onSglt2Inhibitor,
      onNsaids: profile.onNsaids,
      onMra: profile.onMra,
      onInsulin: profile.onInsulin,
    },
    medicationNotes: profile.medicationNotes,

    updatedAt: profile.updatedAt.toISOString(),
  };
}

// ============================================
// Helpers
// ============================================

function formatHeight(cm: number): string {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}'${inches}"`;
}

function buildChangedFields(
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>
): Prisma.InputJsonValue {
  const changes: Record<string, { old: unknown; new: unknown }> = {};

  for (const [key, newVal] of Object.entries(newValues)) {
    if (newVal === undefined) continue;

    const oldVal = oldValues[key];
    // Convert Decimal to number for comparison
    const oldCompare = oldVal instanceof Object && "toNumber" in oldVal
      ? (oldVal as { toNumber: () => number }).toNumber()
      : oldVal;

    if (oldCompare !== newVal) {
      changes[key] = { old: oldCompare ?? null, new: newVal };
    }
  }

  return changes as Prisma.InputJsonValue;
}
