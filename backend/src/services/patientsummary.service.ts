import { prisma } from "../lib/prisma.js";
import { getPatientDashboard, MeasurementSummary } from "./timeseries.service.js";
import {
  getProfile,
  calculateProfileCompleteness,
  formatProfileResponse,
  ProfileCompleteness,
} from "./profile.service.js";
import {
  getCarePlanByPatientAndClinician,
  calculateCarePlanCompleteness,
  formatCarePlanResponse,
  CarePlanCompleteness,
} from "./careplan.service.js";

// ============================================
// Types
// ============================================

export type LatestMeasurements = {
  weight: { value: number; unit: string; timestamp: string } | null;
  systolic: { value: number; unit: string; timestamp: string } | null;
  diastolic: { value: number; unit: string; timestamp: string } | null;
  spo2: { value: number; unit: string; timestamp: string } | null;
  heartRate: { value: number; unit: string; timestamp: string } | null;
};

export type PatientSummaryResponse = {
  patient: {
    id: string;
    name: string;
    dateOfBirth: string;
  };
  enrollment: {
    id: string;
    clinicId: string;
    clinicName: string;
    isPrimary: boolean;
    enrolledAt: string;
  };
  latestMeasurements: LatestMeasurements;
  measurementSummaries: {
    weight: MeasurementSummary;
    bloodPressure: {
      systolic: MeasurementSummary;
      diastolic: MeasurementSummary;
    };
    spo2: MeasurementSummary;
    heartRate: MeasurementSummary;
  };
  profile: ReturnType<typeof formatProfileResponse>;
  carePlan: ReturnType<typeof formatCarePlanResponse>;
  completeness: {
    profileScore: number;
    carePlanScore: number;
    overallScore: number;
    missingCritical: string[];
  };
  banners: {
    showTargetsBanner: boolean;
    showProfileBanner: boolean;
  };
  alerts: {
    openCount: number;
    criticalCount: number;
    latestTriggeredAt: string | null;
  };
  lastActivity: {
    lastCheckinAt: string | null;
    lastMeasurementAt: string | null;
  };
  meta: {
    generatedAt: string;
  };
};

// ============================================
// Patient Summary
// ============================================

/**
 * Get comprehensive patient summary for clinician view
 * Aggregates: measurements, profile, care plan, completeness, alerts
 */
export async function getPatientSummary(
  patientId: string,
  clinicianId: string
): Promise<PatientSummaryResponse | null> {
  // Verify enrollment and get patient + clinic info
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      patientId,
      clinicianId,
      status: "ACTIVE",
    },
    include: {
      patient: {
        select: {
          id: true,
          name: true,
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
  });

  if (!enrollment) {
    return null;
  }

  // Fetch all data in parallel
  const [
    dashboard,
    latestMeasurements,
    profile,
    carePlanResult,
    alertStats,
    lastActivity,
  ] = await Promise.all([
    getPatientDashboard(patientId),
    getLatestMeasurements(patientId),
    getProfile(patientId),
    getCarePlanByPatientAndClinician(patientId, clinicianId),
    getAlertStats(patientId),
    getLastActivity(patientId),
  ]);

  const profileCompleteness = calculateProfileCompleteness(profile);
  const carePlanCompleteness = calculateCarePlanCompleteness(
    carePlanResult?.carePlan ?? null
  );

  // Calculate overall completeness (weighted: profile 40%, care plan 60%)
  const overallScore = Math.round(
    profileCompleteness.profileScore * 0.4 +
      carePlanCompleteness.carePlanScore * 0.6
  );

  return {
    patient: {
      id: enrollment.patient.id,
      name: enrollment.patient.name,
      dateOfBirth: enrollment.patient.dateOfBirth.toISOString().split("T")[0],
    },
    enrollment: {
      id: enrollment.id,
      clinicId: enrollment.clinic.id,
      clinicName: enrollment.clinic.name,
      isPrimary: enrollment.isPrimary,
      enrolledAt: enrollment.enrolledAt.toISOString(),
    },
    latestMeasurements,
    measurementSummaries: {
      weight: dashboard.weight,
      bloodPressure: dashboard.bloodPressure,
      spo2: dashboard.spo2,
      heartRate: dashboard.heartRate,
    },
    profile: formatProfileResponse(profile),
    carePlan: formatCarePlanResponse(carePlanResult?.carePlan ?? null),
    completeness: {
      profileScore: profileCompleteness.profileScore,
      carePlanScore: carePlanCompleteness.carePlanScore,
      overallScore,
      missingCritical: [
        ...profileCompleteness.missingCritical,
        ...carePlanCompleteness.missingCritical,
      ],
    },
    banners: {
      showTargetsBanner: carePlanCompleteness.showTargetsBanner,
      showProfileBanner: profileCompleteness.showProfileBanner,
    },
    alerts: alertStats,
    lastActivity,
    meta: {
      generatedAt: new Date().toISOString(),
    },
  };
}

// ============================================
// Helper Functions
// ============================================

async function getLatestMeasurements(
  patientId: string
): Promise<LatestMeasurements> {
  const types = [
    "WEIGHT",
    "BP_SYSTOLIC",
    "BP_DIASTOLIC",
    "SPO2",
    "HEART_RATE",
  ] as const;

  const results = await Promise.all(
    types.map((type) =>
      prisma.measurement.findFirst({
        where: { patientId, type },
        orderBy: { timestamp: "desc" },
        select: { value: true, unit: true, timestamp: true },
      })
    )
  );

  const format = (
    m: { value: { toNumber(): number } | number; unit: string; timestamp: Date } | null
  ) =>
    m
      ? {
          value: typeof m.value === "number" ? m.value : m.value.toNumber(),
          unit: m.unit,
          timestamp: m.timestamp.toISOString(),
        }
      : null;

  return {
    weight: format(results[0]),
    systolic: format(results[1]),
    diastolic: format(results[2]),
    spo2: format(results[3]),
    heartRate: format(results[4]),
  };
}

async function getAlertStats(patientId: string): Promise<{
  openCount: number;
  criticalCount: number;
  latestTriggeredAt: string | null;
}> {
  const [openCount, criticalCount, latestAlert] = await Promise.all([
    prisma.alert.count({
      where: { patientId, status: "OPEN" },
    }),
    prisma.alert.count({
      where: { patientId, status: "OPEN", severity: "CRITICAL" },
    }),
    prisma.alert.findFirst({
      where: { patientId },
      orderBy: { triggeredAt: "desc" },
      select: { triggeredAt: true },
    }),
  ]);

  return {
    openCount,
    criticalCount,
    latestTriggeredAt: latestAlert?.triggeredAt.toISOString() ?? null,
  };
}

async function getLastActivity(patientId: string): Promise<{
  lastCheckinAt: string | null;
  lastMeasurementAt: string | null;
}> {
  const [lastCheckin, lastMeasurement] = await Promise.all([
    prisma.symptomCheckin.findFirst({
      where: { patientId },
      orderBy: { timestamp: "desc" },
      select: { timestamp: true },
    }),
    prisma.measurement.findFirst({
      where: { patientId },
      orderBy: { timestamp: "desc" },
      select: { timestamp: true },
    }),
  ]);

  return {
    lastCheckinAt: lastCheckin?.timestamp.toISOString() ?? null,
    lastMeasurementAt: lastMeasurement?.timestamp.toISOString() ?? null,
  };
}
