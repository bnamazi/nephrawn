import { TimeEntryActivity } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

// Activity categorization for billing (mutually exclusive - no double-counting)
// RPM activities: Count toward 99470/99457/99458 only
const RPM_ACTIVITIES: TimeEntryActivity[] = [
  "PATIENT_REVIEW",
  "DOCUMENTATION",
  "OTHER",
];

// CCM activities: Count toward 99490 only
const CCM_ACTIVITIES: TimeEntryActivity[] = [
  "CARE_PLAN_UPDATE",
  "COORDINATION",
  "PHONE_CALL",
];

// Eligibility thresholds (2026 CMS rules)
const DEVICE_DAYS_THRESHOLD_LOW = 2; // 99445: 2-15 device transmission days
const DEVICE_DAYS_THRESHOLD_HIGH = 16; // 99454: 16+ device transmission days
const TIME_MINUTES_THRESHOLD_LOW = 10; // 99470: 10-19 minutes
const TIME_MINUTES_THRESHOLD_HIGH = 20; // 99457/99490: 20+ minutes
const MAX_99458_BLOCKS = 2; // Maximum 99458 blocks per month (at 40 and 60 min)

export interface DeviceTransmissionSummary {
  totalDays: number;
  dates: string[]; // ISO date strings (YYYY-MM-DD)
  eligible99445: boolean; // 2-15 days (new 2026 code)
  eligible99454: boolean; // 16+ days
}

export interface TimeSummary {
  totalMinutes: number;
  byActivity: Partial<Record<TimeEntryActivity, number>>;
  rpmMinutes: number; // All activities count toward RPM
  ccmMinutes: number; // Only CCM activities
  eligible99470: boolean; // 10-19 min (new 2026 code, mutually exclusive with 99457)
  eligible99457: boolean; // 20+ min
  eligible99458Count: number; // Number of additional 20-min blocks (max 2)
  eligible99490: boolean;
}

export interface InitialSetupSummary {
  eligible99453: boolean; // Can bill 99453 (first time 16+ device days achieved)
  alreadyBilled: boolean; // 99453 was already billed for this enrollment
  billedAt: Date | null; // When it was billed
}

export interface PatientBillingSummary {
  patientId: string;
  patientName: string;
  period: { from: Date; to: Date };
  deviceTransmission: DeviceTransmissionSummary;
  time: TimeSummary;
  initialSetup: InitialSetupSummary;
  eligibleCodes: string[];
}

export interface ClinicBillingSummary {
  totalPatients: number;
  patientsWithDeviceData: number;
  patientsWith99453: number; // Initial setup eligible (one-time)
  patientsWith99445: number; // 2-15 device days (new 2026)
  patientsWith99454: number; // 16+ device days
  patientsWith99470: number; // 10-19 RPM min (new 2026)
  patientsWith99457: number; // 20+ RPM min
  patientsWith99490: number; // 20+ CCM min
  totalRpmMinutes: number;
  totalCcmMinutes: number;
}

export interface ClinicBillingReport {
  clinicId: string;
  clinicName: string;
  period: { from: Date; to: Date };
  summary: ClinicBillingSummary;
  patients: PatientBillingSummary[];
}

/**
 * Get distinct device transmission days for a patient within a date range.
 * Only counts measurements from device sources (not manual entry).
 */
export async function getDeviceTransmissionDays(
  patientId: string,
  from: Date,
  to: Date
): Promise<DeviceTransmissionSummary> {
  // Get distinct dates with device-sourced measurements
  const measurements = await prisma.measurement.findMany({
    where: {
      patientId,
      timestamp: {
        gte: from,
        lte: to,
      },
      source: {
        not: "manual",
      },
    },
    select: {
      timestamp: true,
    },
    orderBy: {
      timestamp: "asc",
    },
  });

  // Extract unique dates (YYYY-MM-DD format)
  const uniqueDates = new Set<string>();
  for (const m of measurements) {
    const dateStr = m.timestamp.toISOString().split("T")[0];
    uniqueDates.add(dateStr);
  }

  const dates = Array.from(uniqueDates).sort();
  const totalDays = dates.length;

  // 99445 and 99454 are mutually exclusive - pick one based on days
  const eligible99454 = totalDays >= DEVICE_DAYS_THRESHOLD_HIGH;
  const eligible99445 = !eligible99454 && totalDays >= DEVICE_DAYS_THRESHOLD_LOW;

  return {
    totalDays,
    dates,
    eligible99445,
    eligible99454,
  };
}

/**
 * Get time entry summary for a patient within a date range.
 * Aggregates all time entries from all clinicians.
 */
export async function getTimeSummary(
  patientId: string,
  from: Date,
  to: Date
): Promise<TimeSummary> {
  const timeEntries = await prisma.timeEntry.findMany({
    where: {
      patientId,
      entryDate: {
        gte: from,
        lte: to,
      },
    },
    select: {
      durationMinutes: true,
      activity: true,
    },
  });

  // Aggregate by activity - RPM and CCM are mutually exclusive (no double-counting)
  const byActivity: Partial<Record<TimeEntryActivity, number>> = {};
  let totalMinutes = 0;
  let rpmMinutes = 0;
  let ccmMinutes = 0;

  for (const entry of timeEntries) {
    totalMinutes += entry.durationMinutes;
    byActivity[entry.activity] = (byActivity[entry.activity] || 0) + entry.durationMinutes;

    // Each activity counts toward EITHER RPM or CCM, never both
    if (RPM_ACTIVITIES.includes(entry.activity)) {
      rpmMinutes += entry.durationMinutes;
    } else if (CCM_ACTIVITIES.includes(entry.activity)) {
      ccmMinutes += entry.durationMinutes;
    }
  }

  // Calculate eligibility (2026 rules)
  // RPM: 99470 and 99457 are mutually exclusive - pick one based on RPM time only
  const eligible99457 = rpmMinutes >= TIME_MINUTES_THRESHOLD_HIGH;
  const eligible99470 = !eligible99457 && rpmMinutes >= TIME_MINUTES_THRESHOLD_LOW;

  // 99458 requires 99457 first, then additional 20-min blocks (max 2 per month)
  const rawBlocks = eligible99457
    ? Math.floor((rpmMinutes - TIME_MINUTES_THRESHOLD_HIGH) / TIME_MINUTES_THRESHOLD_HIGH)
    : 0;
  const eligible99458Count = Math.min(rawBlocks, MAX_99458_BLOCKS);

  // CCM: 99490 based on CCM time only
  const eligible99490 = ccmMinutes >= TIME_MINUTES_THRESHOLD_HIGH;

  return {
    totalMinutes,
    byActivity,
    rpmMinutes,
    ccmMinutes,
    eligible99470,
    eligible99457,
    eligible99458Count,
    eligible99490,
  };
}

/**
 * Get complete billing summary for a patient.
 * Returns null if clinician is not enrolled with patient.
 */
export async function getPatientBillingSummary(
  patientId: string,
  clinicianId: string,
  from: Date,
  to: Date
): Promise<PatientBillingSummary | null> {
  // Verify enrollment and get 99453 billing status
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      patientId,
      clinicianId,
      status: "ACTIVE",
    },
    include: {
      patient: {
        select: { id: true, name: true },
      },
    },
  });

  if (!enrollment) {
    return null;
  }

  const [deviceTransmission, time] = await Promise.all([
    getDeviceTransmissionDays(patientId, from, to),
    getTimeSummary(patientId, from, to),
  ]);

  // 99453 Initial Setup: One-time billing when patient first achieves 16+ device days
  // Can only be billed once per enrollment
  const alreadyBilled99453 = enrollment.initialSetupBilledAt !== null;
  const eligible99453 = deviceTransmission.eligible99454 && !alreadyBilled99453;

  const initialSetup: InitialSetupSummary = {
    eligible99453,
    alreadyBilled: alreadyBilled99453,
    billedAt: enrollment.initialSetupBilledAt,
  };

  // Determine eligible codes (2026 rules with mutual exclusivity)
  const eligibleCodes: string[] = [];

  // Initial setup (one-time)
  if (eligible99453) eligibleCodes.push("99453");

  // Device transmission: 99445 OR 99454 (mutually exclusive)
  if (deviceTransmission.eligible99454) eligibleCodes.push("99454");
  else if (deviceTransmission.eligible99445) eligibleCodes.push("99445");

  // RPM time: 99470 OR 99457 (mutually exclusive)
  if (time.eligible99457) eligibleCodes.push("99457");
  else if (time.eligible99470) eligibleCodes.push("99470");

  // Additional time blocks (only if 99457 eligible, max 2)
  if (time.eligible99458Count > 0) {
    for (let i = 0; i < time.eligible99458Count; i++) {
      eligibleCodes.push("99458");
    }
  }

  // CCM time
  if (time.eligible99490) eligibleCodes.push("99490");

  return {
    patientId,
    patientName: enrollment.patient.name,
    period: { from, to },
    deviceTransmission,
    time,
    initialSetup,
    eligibleCodes,
  };
}

/**
 * Get billing report for an entire clinic.
 * Returns null if clinician doesn't have OWNER/ADMIN role in the clinic.
 */
export async function getClinicBillingReport(
  clinicId: string,
  clinicianId: string,
  from: Date,
  to: Date
): Promise<ClinicBillingReport | null> {
  // Verify clinician has OWNER/ADMIN role
  const membership = await prisma.clinicMembership.findUnique({
    where: {
      clinicId_clinicianId: { clinicId, clinicianId },
    },
    include: {
      clinic: {
        select: { id: true, name: true },
      },
    },
  });

  if (!membership || membership.status !== "ACTIVE") {
    return null;
  }

  if (!["OWNER", "ADMIN"].includes(membership.role)) {
    return null;
  }

  // Get all active enrollments for this clinic
  const enrollments = await prisma.enrollment.findMany({
    where: {
      clinicId,
      status: "ACTIVE",
    },
    include: {
      patient: {
        select: { id: true, name: true },
      },
    },
    distinct: ["patientId"], // One entry per patient
  });

  // Get billing summary for each patient
  const patientSummaries: PatientBillingSummary[] = [];

  for (const enrollment of enrollments) {
    const [deviceTransmission, time] = await Promise.all([
      getDeviceTransmissionDays(enrollment.patientId, from, to),
      getTimeSummary(enrollment.patientId, from, to),
    ]);

    // 99453 Initial Setup: One-time billing when patient first achieves 16+ device days
    const alreadyBilled99453 = enrollment.initialSetupBilledAt !== null;
    const eligible99453 = deviceTransmission.eligible99454 && !alreadyBilled99453;

    const initialSetup: InitialSetupSummary = {
      eligible99453,
      alreadyBilled: alreadyBilled99453,
      billedAt: enrollment.initialSetupBilledAt,
    };

    // Determine eligible codes (2026 rules with mutual exclusivity)
    const eligibleCodes: string[] = [];

    // Initial setup (one-time)
    if (eligible99453) eligibleCodes.push("99453");

    // Device transmission: 99445 OR 99454 (mutually exclusive)
    if (deviceTransmission.eligible99454) eligibleCodes.push("99454");
    else if (deviceTransmission.eligible99445) eligibleCodes.push("99445");

    // RPM time: 99470 OR 99457 (mutually exclusive)
    if (time.eligible99457) eligibleCodes.push("99457");
    else if (time.eligible99470) eligibleCodes.push("99470");

    // Additional time blocks (only if 99457 eligible, max 2)
    if (time.eligible99458Count > 0) {
      for (let i = 0; i < time.eligible99458Count; i++) {
        eligibleCodes.push("99458");
      }
    }

    // CCM time
    if (time.eligible99490) eligibleCodes.push("99490");

    patientSummaries.push({
      patientId: enrollment.patientId,
      patientName: enrollment.patient.name,
      period: { from, to },
      deviceTransmission,
      time,
      initialSetup,
      eligibleCodes,
    });
  }

  // Calculate aggregate summary
  const summary: ClinicBillingSummary = {
    totalPatients: patientSummaries.length,
    patientsWithDeviceData: patientSummaries.filter((p) => p.deviceTransmission.totalDays > 0).length,
    patientsWith99453: patientSummaries.filter((p) => p.initialSetup.eligible99453).length,
    patientsWith99445: patientSummaries.filter((p) => p.deviceTransmission.eligible99445).length,
    patientsWith99454: patientSummaries.filter((p) => p.deviceTransmission.eligible99454).length,
    patientsWith99470: patientSummaries.filter((p) => p.time.eligible99470).length,
    patientsWith99457: patientSummaries.filter((p) => p.time.eligible99457).length,
    patientsWith99490: patientSummaries.filter((p) => p.time.eligible99490).length,
    totalRpmMinutes: patientSummaries.reduce((sum, p) => sum + p.time.rpmMinutes, 0),
    totalCcmMinutes: patientSummaries.reduce((sum, p) => sum + p.time.ccmMinutes, 0),
  };

  return {
    clinicId,
    clinicName: membership.clinic.name,
    period: { from, to },
    summary,
    patients: patientSummaries,
  };
}
