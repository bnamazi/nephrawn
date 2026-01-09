import { Prisma, LabSource, LabResultFlag } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { logInteraction } from "./interaction.service.js";

// ============================================
// Input Types
// ============================================

export type LabResultInput = {
  analyteName: string;
  analyteCode?: string;
  value: number;
  unit: string;
  referenceRangeLow?: number;
  referenceRangeHigh?: number;
  flag?: LabResultFlag;
};

export type CreateLabReportInput = {
  patientId: string;
  collectedAt: Date;
  reportedAt?: Date;
  labName?: string;
  orderingProvider?: string;
  notes?: string;
  documentId?: string;
  source?: LabSource;
  results?: LabResultInput[];
};

export type UpdateLabReportInput = {
  collectedAt?: Date;
  reportedAt?: Date | null;
  labName?: string | null;
  orderingProvider?: string | null;
  notes?: string | null;
};

export type UpdateLabResultInput = {
  analyteName?: string;
  analyteCode?: string | null;
  value?: number;
  unit?: string;
  referenceRangeLow?: number | null;
  referenceRangeHigh?: number | null;
  flag?: LabResultFlag | null;
};

// ============================================
// Patient Lab Report CRUD
// ============================================

/**
 * List lab reports for a patient
 */
export async function listLabReports(
  patientId: string,
  options?: {
    limit?: number;
    offset?: number;
  }
) {
  return prisma.labReport.findMany({
    where: { patientId },
    orderBy: { collectedAt: "desc" },
    take: options?.limit ?? 50,
    skip: options?.offset ?? 0,
    include: {
      results: {
        orderBy: { analyteName: "asc" },
      },
      verifiedBy: {
        select: { id: true, name: true },
      },
    },
  });
}

/**
 * Get a single lab report by ID with ownership check
 */
export async function getLabReport(reportId: string, patientId: string) {
  const report = await prisma.labReport.findUnique({
    where: { id: reportId },
    include: {
      results: {
        orderBy: { analyteName: "asc" },
      },
      verifiedBy: {
        select: { id: true, name: true },
      },
      document: {
        select: { id: true, filename: true, storageKey: true },
      },
    },
  });

  if (!report || report.patientId !== patientId) {
    return null;
  }

  return report;
}

/**
 * Create a new lab report with optional results
 */
export async function createLabReport(input: CreateLabReportInput) {
  const report = await prisma.labReport.create({
    data: {
      patientId: input.patientId,
      collectedAt: input.collectedAt,
      reportedAt: input.reportedAt,
      labName: input.labName,
      orderingProvider: input.orderingProvider,
      notes: input.notes,
      documentId: input.documentId,
      source: input.source ?? "MANUAL_PATIENT",
      results: input.results
        ? {
            create: input.results.map((r) => ({
              analyteName: r.analyteName,
              analyteCode: r.analyteCode,
              value: r.value,
              unit: r.unit,
              referenceRangeLow: r.referenceRangeLow,
              referenceRangeHigh: r.referenceRangeHigh,
              flag: r.flag,
            })),
          }
        : undefined,
    },
    include: {
      results: {
        orderBy: { analyteName: "asc" },
      },
    },
  });

  // Log interaction for RPM/CCM
  await logInteraction({
    patientId: input.patientId,
    interactionType: "PATIENT_LAB_REPORT",
    metadata: {
      labReportId: report.id,
      action: "create",
      resultsCount: report.results.length,
    } as Prisma.InputJsonValue,
  });

  return report;
}

/**
 * Update a lab report with ownership check
 */
export async function updateLabReport(
  reportId: string,
  patientId: string,
  input: UpdateLabReportInput
) {
  // Verify ownership
  const existing = await prisma.labReport.findUnique({
    where: { id: reportId },
  });

  if (!existing || existing.patientId !== patientId) {
    return null;
  }

  const report = await prisma.labReport.update({
    where: { id: reportId },
    data: {
      collectedAt: input.collectedAt,
      reportedAt: input.reportedAt,
      labName: input.labName,
      orderingProvider: input.orderingProvider,
      notes: input.notes,
    },
    include: {
      results: {
        orderBy: { analyteName: "asc" },
      },
      verifiedBy: {
        select: { id: true, name: true },
      },
    },
  });

  // Log interaction for RPM/CCM
  await logInteraction({
    patientId,
    interactionType: "PATIENT_LAB_REPORT",
    metadata: {
      labReportId: report.id,
      action: "update",
    } as Prisma.InputJsonValue,
  });

  return report;
}

/**
 * Delete a lab report with ownership check (hard delete)
 */
export async function deleteLabReport(reportId: string, patientId: string) {
  // Verify ownership
  const existing = await prisma.labReport.findUnique({
    where: { id: reportId },
  });

  if (!existing || existing.patientId !== patientId) {
    return false;
  }

  // Delete the report (results cascade delete)
  await prisma.labReport.delete({
    where: { id: reportId },
  });

  // Log interaction for RPM/CCM
  await logInteraction({
    patientId,
    interactionType: "PATIENT_LAB_REPORT",
    metadata: {
      labReportId: reportId,
      action: "delete",
    } as Prisma.InputJsonValue,
  });

  return true;
}

// ============================================
// Patient Lab Result CRUD
// ============================================

/**
 * Add a result to an existing lab report
 */
export async function addLabResult(
  reportId: string,
  patientId: string,
  input: LabResultInput
) {
  // Verify ownership
  const report = await prisma.labReport.findUnique({
    where: { id: reportId },
  });

  if (!report || report.patientId !== patientId) {
    return null;
  }

  const result = await prisma.labResult.create({
    data: {
      reportId,
      analyteName: input.analyteName,
      analyteCode: input.analyteCode,
      value: input.value,
      unit: input.unit,
      referenceRangeLow: input.referenceRangeLow,
      referenceRangeHigh: input.referenceRangeHigh,
      flag: input.flag,
    },
  });

  // Log interaction for RPM/CCM
  await logInteraction({
    patientId,
    interactionType: "PATIENT_LAB_REPORT",
    metadata: {
      labReportId: reportId,
      labResultId: result.id,
      action: "add_result",
      analyteName: input.analyteName,
    } as Prisma.InputJsonValue,
  });

  return result;
}

/**
 * Update a lab result with ownership check
 */
export async function updateLabResult(
  resultId: string,
  patientId: string,
  input: UpdateLabResultInput
) {
  // Get the result and verify ownership through report
  const existing = await prisma.labResult.findUnique({
    where: { id: resultId },
    include: { report: true },
  });

  if (!existing || existing.report.patientId !== patientId) {
    return null;
  }

  const result = await prisma.labResult.update({
    where: { id: resultId },
    data: {
      analyteName: input.analyteName,
      analyteCode: input.analyteCode,
      value: input.value,
      unit: input.unit,
      referenceRangeLow: input.referenceRangeLow,
      referenceRangeHigh: input.referenceRangeHigh,
      flag: input.flag,
    },
  });

  // Log interaction for RPM/CCM
  await logInteraction({
    patientId,
    interactionType: "PATIENT_LAB_REPORT",
    metadata: {
      labReportId: existing.reportId,
      labResultId: result.id,
      action: "update_result",
      analyteName: result.analyteName,
    } as Prisma.InputJsonValue,
  });

  return result;
}

/**
 * Delete a lab result with ownership check
 */
export async function deleteLabResult(resultId: string, patientId: string) {
  // Get the result and verify ownership through report
  const existing = await prisma.labResult.findUnique({
    where: { id: resultId },
    include: { report: true },
  });

  if (!existing || existing.report.patientId !== patientId) {
    return false;
  }

  await prisma.labResult.delete({
    where: { id: resultId },
  });

  // Log interaction for RPM/CCM
  await logInteraction({
    patientId,
    interactionType: "PATIENT_LAB_REPORT",
    metadata: {
      labReportId: existing.reportId,
      labResultId: resultId,
      action: "delete_result",
      analyteName: existing.analyteName,
    } as Prisma.InputJsonValue,
  });

  return true;
}

// ============================================
// Clinician View & Actions
// ============================================

/**
 * Get lab reports for a patient (clinician access)
 * Verifies enrollment before returning data
 */
export async function getLabReportsForClinician(
  patientId: string,
  clinicianId: string,
  options?: {
    limit?: number;
    offset?: number;
  }
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

  // Log interaction for RPM/CCM
  await logInteraction({
    patientId,
    clinicianId,
    interactionType: "CLINICIAN_LAB_VIEW",
    metadata: {
      endpoint: "GET /clinician/patients/:patientId/labs",
    } as Prisma.InputJsonValue,
  });

  return prisma.labReport.findMany({
    where: { patientId },
    orderBy: { collectedAt: "desc" },
    take: options?.limit ?? 50,
    skip: options?.offset ?? 0,
    include: {
      results: {
        orderBy: { analyteName: "asc" },
      },
      verifiedBy: {
        select: { id: true, name: true },
      },
      document: {
        select: { id: true, filename: true, storageKey: true },
      },
    },
  });
}

/**
 * Get a single lab report for clinician view
 */
export async function getLabReportForClinician(
  reportId: string,
  patientId: string,
  clinicianId: string
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

  const report = await prisma.labReport.findUnique({
    where: { id: reportId },
    include: {
      results: {
        orderBy: { analyteName: "asc" },
      },
      verifiedBy: {
        select: { id: true, name: true },
      },
      document: {
        select: { id: true, filename: true, storageKey: true },
      },
    },
  });

  if (!report || report.patientId !== patientId) {
    return null;
  }

  return report;
}

/**
 * Create a lab report for a patient (clinician action)
 */
export async function createLabReportForPatient(
  patientId: string,
  clinicianId: string,
  input: Omit<CreateLabReportInput, "patientId" | "source">
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

  const report = await prisma.labReport.create({
    data: {
      patientId,
      collectedAt: input.collectedAt,
      reportedAt: input.reportedAt,
      labName: input.labName,
      orderingProvider: input.orderingProvider,
      notes: input.notes,
      documentId: input.documentId,
      source: "MANUAL_CLINICIAN",
      results: input.results
        ? {
            create: input.results.map((r) => ({
              analyteName: r.analyteName,
              analyteCode: r.analyteCode,
              value: r.value,
              unit: r.unit,
              referenceRangeLow: r.referenceRangeLow,
              referenceRangeHigh: r.referenceRangeHigh,
              flag: r.flag,
            })),
          }
        : undefined,
    },
    include: {
      results: {
        orderBy: { analyteName: "asc" },
      },
    },
  });

  // Log interaction for RPM/CCM
  await logInteraction({
    patientId,
    clinicianId,
    interactionType: "CLINICIAN_LAB_CREATE",
    metadata: {
      labReportId: report.id,
      resultsCount: report.results.length,
    } as Prisma.InputJsonValue,
  });

  return report;
}

/**
 * Verify a lab report (clinician action)
 */
export async function verifyLabReport(
  reportId: string,
  patientId: string,
  clinicianId: string
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

  // Verify report ownership
  const existing = await prisma.labReport.findUnique({
    where: { id: reportId },
  });

  if (!existing || existing.patientId !== patientId) {
    return null;
  }

  const report = await prisma.labReport.update({
    where: { id: reportId },
    data: {
      verifiedAt: new Date(),
      verifiedById: clinicianId,
    },
    include: {
      results: {
        orderBy: { analyteName: "asc" },
      },
      verifiedBy: {
        select: { id: true, name: true },
      },
    },
  });

  // Log interaction for RPM/CCM
  await logInteraction({
    patientId,
    clinicianId,
    interactionType: "CLINICIAN_LAB_VERIFY",
    metadata: {
      labReportId: report.id,
    } as Prisma.InputJsonValue,
  });

  return report;
}

/**
 * Add a result to a lab report (clinician action)
 */
export async function addLabResultForPatient(
  reportId: string,
  patientId: string,
  clinicianId: string,
  input: LabResultInput
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

  // Verify report ownership
  const report = await prisma.labReport.findUnique({
    where: { id: reportId },
  });

  if (!report || report.patientId !== patientId) {
    return null;
  }

  const result = await prisma.labResult.create({
    data: {
      reportId,
      analyteName: input.analyteName,
      analyteCode: input.analyteCode,
      value: input.value,
      unit: input.unit,
      referenceRangeLow: input.referenceRangeLow,
      referenceRangeHigh: input.referenceRangeHigh,
      flag: input.flag,
    },
  });

  // Log interaction for RPM/CCM
  await logInteraction({
    patientId,
    clinicianId,
    interactionType: "CLINICIAN_LAB_CREATE",
    metadata: {
      labReportId: reportId,
      labResultId: result.id,
      action: "add_result",
      analyteName: input.analyteName,
    } as Prisma.InputJsonValue,
  });

  return result;
}

/**
 * Update a lab result (clinician action)
 */
export async function updateLabResultForPatient(
  resultId: string,
  patientId: string,
  clinicianId: string,
  input: UpdateLabResultInput
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

  // Get the result and verify ownership through report
  const existing = await prisma.labResult.findUnique({
    where: { id: resultId },
    include: { report: true },
  });

  if (!existing || existing.report.patientId !== patientId) {
    return null;
  }

  const result = await prisma.labResult.update({
    where: { id: resultId },
    data: {
      analyteName: input.analyteName,
      analyteCode: input.analyteCode,
      value: input.value,
      unit: input.unit,
      referenceRangeLow: input.referenceRangeLow,
      referenceRangeHigh: input.referenceRangeHigh,
      flag: input.flag,
    },
  });

  // Log interaction for RPM/CCM
  await logInteraction({
    patientId,
    clinicianId,
    interactionType: "CLINICIAN_LAB_CREATE",
    metadata: {
      labReportId: existing.reportId,
      labResultId: result.id,
      action: "update_result",
      analyteName: result.analyteName,
    } as Prisma.InputJsonValue,
  });

  return result;
}

/**
 * Delete a lab result (clinician action)
 */
export async function deleteLabResultForPatient(
  resultId: string,
  patientId: string,
  clinicianId: string
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

  // Get the result and verify ownership through report
  const existing = await prisma.labResult.findUnique({
    where: { id: resultId },
    include: { report: true },
  });

  if (!existing || existing.report.patientId !== patientId) {
    return false;
  }

  await prisma.labResult.delete({
    where: { id: resultId },
  });

  // Log interaction for RPM/CCM
  await logInteraction({
    patientId,
    clinicianId,
    interactionType: "CLINICIAN_LAB_CREATE",
    metadata: {
      labReportId: existing.reportId,
      labResultId: resultId,
      action: "delete_result",
      analyteName: existing.analyteName,
    } as Prisma.InputJsonValue,
  });

  return true;
}
