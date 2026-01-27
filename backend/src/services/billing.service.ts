import { TimeEntryActivity, PerformerType, BillingProgram } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

// Activity categorization for billing (mutually exclusive - no double-counting)
// RPM activities: Count toward 99470/99457/99458 only
const RPM_ACTIVITIES: TimeEntryActivity[] = [
  "PATIENT_REVIEW",
  "DOCUMENTATION",
  "OTHER",
];

// CCM/PCM activities: Count toward CCM or PCM codes based on billing program
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

// RPM physician threshold
const RPM_PHYSICIAN_DATA_THRESHOLD = 30;   // 99091: 30+ min physician RPM time

// CCM thresholds by performer type
const CCM_CLINICAL_STAFF_THRESHOLD = 20;   // 99490: 20+ min clinical staff
const CCM_PHYSICIAN_THRESHOLD = 30;        // 99491: 30+ min physician
const MAX_99439_BLOCKS = 2;                // 99439: Additional 20-min CCM staff blocks (max 2)
const MAX_99437_BLOCKS = 2;                // 99437: Additional 30-min CCM physician blocks (max 2)

// PCM thresholds (single high-risk condition)
const PCM_PHYSICIAN_THRESHOLD = 30;        // 99424: 30+ min physician
const PCM_CLINICAL_STAFF_THRESHOLD = 30;   // 99426: 30+ min clinical staff
const MAX_99425_BLOCKS = 2;                // 99425: Additional 30-min PCM physician blocks (max 2)
const MAX_99427_BLOCKS = 2;                // 99427: Additional 30-min PCM staff blocks (max 2)

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
  rpmPhysicianMinutes: number; // RPM activities by physician only (for 99091)
  ccmMinutes: number; // Only CCM activities (legacy - total for backward compat)
  eligible99470: boolean; // 10-19 min (new 2026 code, mutually exclusive with 99457)
  eligible99457: boolean; // 20+ min
  eligible99458Count: number; // Number of additional 20-min blocks (max 2)
  eligible99091: boolean; // 30+ min physician RPM time
  eligible99490: boolean;

  // CCM breakdown by performer type
  ccmClinicalStaffMinutes: number;
  ccmPhysicianMinutes: number;
  eligible99439Count: number;  // Add-on blocks to 99490 (max 2)
  eligible99491: boolean;      // 30+ min physician
  eligible99437Count: number;  // Add-on blocks to 99491 (max 2)

  // PCM breakdown by performer type
  pcmPhysicianMinutes: number;
  pcmClinicalStaffMinutes: number;
  eligible99424: boolean;      // 30+ min physician
  eligible99425Count: number;  // Add-on blocks (max 2)
  eligible99426: boolean;      // 30+ min staff
  eligible99427Count: number;  // Add-on blocks (max 2)
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
  patientsWith99091: number; // 30+ RPM physician min (data interpretation)
  patientsWith99490: number; // 20+ CCM staff min
  patientsWith99439: number; // CCM staff add-on blocks
  patientsWith99491: number; // 30+ CCM physician min
  patientsWith99437: number; // CCM physician add-on blocks
  patientsWith99424: number; // 30+ PCM physician min
  patientsWith99425: number; // PCM physician add-on blocks
  patientsWith99426: number; // 30+ PCM staff min
  patientsWith99427: number; // PCM staff add-on blocks
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
 * Includes breakdown by performer type for CCM/PCM billing.
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
      performerType: true,
    },
  });

  // Aggregate by activity - RPM and CCM are mutually exclusive (no double-counting)
  const byActivity: Partial<Record<TimeEntryActivity, number>> = {};
  let totalMinutes = 0;
  let rpmMinutes = 0;
  let rpmPhysicianMinutes = 0; // RPM activities by physician only (for 99091)
  let ccmMinutes = 0;

  // CCM breakdown by performer type
  let ccmClinicalStaffMinutes = 0;
  let ccmPhysicianMinutes = 0;

  // PCM uses same activities as CCM but tracked separately by performer type
  let pcmPhysicianMinutes = 0;
  let pcmClinicalStaffMinutes = 0;

  for (const entry of timeEntries) {
    totalMinutes += entry.durationMinutes;
    byActivity[entry.activity] = (byActivity[entry.activity] || 0) + entry.durationMinutes;

    // Each activity counts toward EITHER RPM or CCM/PCM, never both
    if (RPM_ACTIVITIES.includes(entry.activity)) {
      rpmMinutes += entry.durationMinutes;
      // Track physician RPM time separately for 99091
      if (entry.performerType === "PHYSICIAN_QHP") {
        rpmPhysicianMinutes += entry.durationMinutes;
      }
    } else if (CCM_ACTIVITIES.includes(entry.activity)) {
      ccmMinutes += entry.durationMinutes;

      // Break down by performer type (same minutes, different codes)
      if (entry.performerType === "PHYSICIAN_QHP") {
        ccmPhysicianMinutes += entry.durationMinutes;
        pcmPhysicianMinutes += entry.durationMinutes;
      } else {
        ccmClinicalStaffMinutes += entry.durationMinutes;
        pcmClinicalStaffMinutes += entry.durationMinutes;
      }
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

  // 99091: RPM physician data interpretation (30+ min physician RPM time)
  // Can coexist with 99457/99458 (different services)
  const eligible99091 = rpmPhysicianMinutes >= RPM_PHYSICIAN_DATA_THRESHOLD;

  // CCM staff codes: 99490 (base) + 99439 (add-on blocks)
  const eligible99490 = ccmClinicalStaffMinutes >= CCM_CLINICAL_STAFF_THRESHOLD;
  const raw99439Blocks = eligible99490
    ? Math.floor((ccmClinicalStaffMinutes - CCM_CLINICAL_STAFF_THRESHOLD) / CCM_CLINICAL_STAFF_THRESHOLD)
    : 0;
  const eligible99439Count = Math.min(raw99439Blocks, MAX_99439_BLOCKS);

  // CCM physician codes: 99491 (base) + 99437 (add-on blocks)
  const eligible99491 = ccmPhysicianMinutes >= CCM_PHYSICIAN_THRESHOLD;
  const raw99437Blocks = eligible99491
    ? Math.floor((ccmPhysicianMinutes - CCM_PHYSICIAN_THRESHOLD) / CCM_PHYSICIAN_THRESHOLD)
    : 0;
  const eligible99437Count = Math.min(raw99437Blocks, MAX_99437_BLOCKS);

  // PCM physician codes: 99424 (base) + 99425 (add-on blocks)
  const eligible99424 = pcmPhysicianMinutes >= PCM_PHYSICIAN_THRESHOLD;
  const raw99425Blocks = eligible99424
    ? Math.floor((pcmPhysicianMinutes - PCM_PHYSICIAN_THRESHOLD) / PCM_PHYSICIAN_THRESHOLD)
    : 0;
  const eligible99425Count = Math.min(raw99425Blocks, MAX_99425_BLOCKS);

  // PCM staff codes: 99426 (base) + 99427 (add-on blocks)
  const eligible99426 = pcmClinicalStaffMinutes >= PCM_CLINICAL_STAFF_THRESHOLD;
  const raw99427Blocks = eligible99426
    ? Math.floor((pcmClinicalStaffMinutes - PCM_CLINICAL_STAFF_THRESHOLD) / PCM_CLINICAL_STAFF_THRESHOLD)
    : 0;
  const eligible99427Count = Math.min(raw99427Blocks, MAX_99427_BLOCKS);

  return {
    totalMinutes,
    byActivity,
    rpmMinutes,
    rpmPhysicianMinutes,
    ccmMinutes,
    eligible99470,
    eligible99457,
    eligible99458Count,
    eligible99091,
    eligible99490,
    // CCM breakdown
    ccmClinicalStaffMinutes,
    ccmPhysicianMinutes,
    eligible99439Count,
    eligible99491,
    eligible99437Count,
    // PCM breakdown (uses same minutes as CCM, but different codes based on billingProgram)
    pcmPhysicianMinutes,
    pcmClinicalStaffMinutes,
    eligible99424,
    eligible99425Count,
    eligible99426,
    eligible99427Count,
  };
}

/**
 * Get complete billing summary for a patient.
 * Returns null if clinician is not enrolled with patient.
 * Uses enrollment's billingProgram to determine CCM vs PCM codes.
 */
export async function getPatientBillingSummary(
  patientId: string,
  clinicianId: string,
  from: Date,
  to: Date
): Promise<PatientBillingSummary | null> {
  // Verify enrollment and get 99453 billing status + billing program
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

  // Additional RPM time blocks (only if 99457 eligible, max 2)
  if (time.eligible99458Count > 0) {
    for (let i = 0; i < time.eligible99458Count; i++) {
      eligibleCodes.push("99458");
    }
  }

  // 99091: RPM physician data interpretation (can coexist with 99457/99458)
  if (time.eligible99091) eligibleCodes.push("99091");

  // CCM vs PCM codes based on billing program (mutually exclusive tracks)
  if (enrollment.billingProgram === "RPM_CCM") {
    // CCM Track: 2+ chronic conditions
    // Clinical staff codes: 99490 (base) + 99439 (add-on)
    if (time.eligible99490) {
      eligibleCodes.push("99490");
      for (let i = 0; i < time.eligible99439Count; i++) {
        eligibleCodes.push("99439");
      }
    }
    // Physician codes: 99491 (base) + 99437 (add-on) - can coexist with staff codes
    if (time.eligible99491) {
      eligibleCodes.push("99491");
      for (let i = 0; i < time.eligible99437Count; i++) {
        eligibleCodes.push("99437");
      }
    }
  } else if (enrollment.billingProgram === "RPM_PCM") {
    // PCM Track: Single high-risk condition
    // Physician OR staff codes (not both) - physician takes priority
    if (time.eligible99424) {
      eligibleCodes.push("99424");
      for (let i = 0; i < time.eligible99425Count; i++) {
        eligibleCodes.push("99425");
      }
    } else if (time.eligible99426) {
      eligibleCodes.push("99426");
      for (let i = 0; i < time.eligible99427Count; i++) {
        eligibleCodes.push("99427");
      }
    }
  }
  // RPM_ONLY: No CCM/PCM codes added

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
 * Includes all CCM and PCM codes based on each patient's billing program.
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

    // Additional RPM time blocks (only if 99457 eligible, max 2)
    if (time.eligible99458Count > 0) {
      for (let i = 0; i < time.eligible99458Count; i++) {
        eligibleCodes.push("99458");
      }
    }

    // 99091: RPM physician data interpretation (can coexist with 99457/99458)
    if (time.eligible99091) eligibleCodes.push("99091");

    // CCM vs PCM codes based on billing program (mutually exclusive tracks)
    if (enrollment.billingProgram === "RPM_CCM") {
      // CCM Track: 2+ chronic conditions
      if (time.eligible99490) {
        eligibleCodes.push("99490");
        for (let i = 0; i < time.eligible99439Count; i++) {
          eligibleCodes.push("99439");
        }
      }
      if (time.eligible99491) {
        eligibleCodes.push("99491");
        for (let i = 0; i < time.eligible99437Count; i++) {
          eligibleCodes.push("99437");
        }
      }
    } else if (enrollment.billingProgram === "RPM_PCM") {
      // PCM Track: Single high-risk condition (physician OR staff, not both)
      if (time.eligible99424) {
        eligibleCodes.push("99424");
        for (let i = 0; i < time.eligible99425Count; i++) {
          eligibleCodes.push("99425");
        }
      } else if (time.eligible99426) {
        eligibleCodes.push("99426");
        for (let i = 0; i < time.eligible99427Count; i++) {
          eligibleCodes.push("99427");
        }
      }
    }

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
    patientsWith99091: patientSummaries.filter((p) => p.time.eligible99091).length,
    patientsWith99490: patientSummaries.filter((p) => p.eligibleCodes.includes("99490")).length,
    patientsWith99439: patientSummaries.filter((p) => p.eligibleCodes.includes("99439")).length,
    patientsWith99491: patientSummaries.filter((p) => p.eligibleCodes.includes("99491")).length,
    patientsWith99437: patientSummaries.filter((p) => p.eligibleCodes.includes("99437")).length,
    patientsWith99424: patientSummaries.filter((p) => p.eligibleCodes.includes("99424")).length,
    patientsWith99425: patientSummaries.filter((p) => p.eligibleCodes.includes("99425")).length,
    patientsWith99426: patientSummaries.filter((p) => p.eligibleCodes.includes("99426")).length,
    patientsWith99427: patientSummaries.filter((p) => p.eligibleCodes.includes("99427")).length,
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
