import { AlertSeverity, AlertStatus, MeasurementType, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { ALERT_THRESHOLDS } from "../lib/units.js";
import { logger } from "../lib/logger.js";

// ============================================
// Alert Rule Definitions
// ============================================

type AlertRule = {
  id: string;
  name: string;
  description: string;
  measurementType: MeasurementType;
  evaluate: (patientId: string) => Promise<AlertTrigger | null>;
};

type AlertTrigger = {
  severity: AlertSeverity;
  inputs: Record<string, unknown>;
};

/**
 * Alert rules now use canonical units (kg for weight, mmHg for BP, etc.)
 */
const ALERT_RULES: AlertRule[] = [
  {
    id: "weight_gain_48h",
    name: "Rapid Weight Gain",
    description: `Weight increase of ${ALERT_THRESHOLDS.WEIGHT_GAIN_48H} kg (~3 lbs) within 48 hours`,
    measurementType: "WEIGHT",
    evaluate: async (patientId: string): Promise<AlertTrigger | null> => {
      const since = new Date(Date.now() - 48 * 60 * 60 * 1000);

      const measurements = await prisma.measurement.findMany({
        where: {
          patientId,
          type: "WEIGHT",
          timestamp: { gte: since },
        },
        orderBy: { timestamp: "asc" },
        select: { id: true, value: true, timestamp: true, unit: true },
      });

      if (measurements.length < 2) return null;

      const oldest = measurements[0];
      const newest = measurements[measurements.length - 1];
      const delta = newest.value.toNumber() - oldest.value.toNumber();

      // Thresholds are in kg (canonical unit)
      if (delta >= ALERT_THRESHOLDS.WEIGHT_GAIN_48H) {
        return {
          severity: delta >= ALERT_THRESHOLDS.WEIGHT_GAIN_48H_CRITICAL ? "CRITICAL" : "WARNING",
          inputs: {
            measurements: measurements.map(m => ({
              id: m.id,
              value: m.value.toNumber(),
              unit: m.unit,
              timestamp: m.timestamp.toISOString(),
            })),
            oldestValue: oldest.value.toNumber(),
            newestValue: newest.value.toNumber(),
            delta: Number(delta.toFixed(2)),
            thresholdKg: ALERT_THRESHOLDS.WEIGHT_GAIN_48H,
            windowHours: 48,
          },
        };
      }

      return null;
    },
  },
  {
    id: "bp_systolic_high",
    name: "High Systolic Blood Pressure",
    description: `Systolic BP reading above ${ALERT_THRESHOLDS.BP_SYSTOLIC_HIGH} mmHg`,
    measurementType: "BP_SYSTOLIC",
    evaluate: async (patientId: string): Promise<AlertTrigger | null> => {
      const latest = await prisma.measurement.findFirst({
        where: {
          patientId,
          type: "BP_SYSTOLIC",
        },
        orderBy: { timestamp: "desc" },
        select: { id: true, value: true, timestamp: true, unit: true },
      });

      if (!latest) return null;

      const value = latest.value.toNumber();

      if (value >= ALERT_THRESHOLDS.BP_SYSTOLIC_HIGH) {
        return {
          severity: value >= ALERT_THRESHOLDS.BP_SYSTOLIC_CRITICAL ? "CRITICAL" : "WARNING",
          inputs: {
            measurement: {
              id: latest.id,
              value,
              unit: latest.unit,
              timestamp: latest.timestamp.toISOString(),
            },
            threshold: ALERT_THRESHOLDS.BP_SYSTOLIC_HIGH,
          },
        };
      }

      return null;
    },
  },
  {
    id: "bp_systolic_low",
    name: "Low Systolic Blood Pressure",
    description: `Systolic BP reading below ${ALERT_THRESHOLDS.BP_SYSTOLIC_LOW} mmHg`,
    measurementType: "BP_SYSTOLIC",
    evaluate: async (patientId: string): Promise<AlertTrigger | null> => {
      const latest = await prisma.measurement.findFirst({
        where: {
          patientId,
          type: "BP_SYSTOLIC",
        },
        orderBy: { timestamp: "desc" },
        select: { id: true, value: true, timestamp: true, unit: true },
      });

      if (!latest) return null;

      const value = latest.value.toNumber();

      if (value < ALERT_THRESHOLDS.BP_SYSTOLIC_LOW) {
        return {
          severity: value < ALERT_THRESHOLDS.BP_SYSTOLIC_CRITICAL_LOW ? "CRITICAL" : "WARNING",
          inputs: {
            measurement: {
              id: latest.id,
              value,
              unit: latest.unit,
              timestamp: latest.timestamp.toISOString(),
            },
            threshold: ALERT_THRESHOLDS.BP_SYSTOLIC_LOW,
          },
        };
      }

      return null;
    },
  },
  {
    id: "spo2_low",
    name: "Low Oxygen Saturation",
    description: `SpO2 reading below ${ALERT_THRESHOLDS.SPO2_LOW}%`,
    measurementType: "SPO2",
    evaluate: async (patientId: string): Promise<AlertTrigger | null> => {
      const latest = await prisma.measurement.findFirst({
        where: {
          patientId,
          type: "SPO2",
        },
        orderBy: { timestamp: "desc" },
        select: { id: true, value: true, timestamp: true, unit: true },
      });

      if (!latest) return null;

      const value = latest.value.toNumber();

      if (value < ALERT_THRESHOLDS.SPO2_LOW) {
        return {
          severity: value < ALERT_THRESHOLDS.SPO2_CRITICAL ? "CRITICAL" : "WARNING",
          inputs: {
            measurement: {
              id: latest.id,
              value,
              unit: latest.unit,
              timestamp: latest.timestamp.toISOString(),
            },
            threshold: ALERT_THRESHOLDS.SPO2_LOW,
          },
        };
      }

      return null;
    },
  },
];

// ============================================
// Rule Engine
// ============================================

/**
 * Evaluate rules atomically with proper deduplication.
 * If an OPEN alert exists, update its inputs instead of creating a new one.
 */
export async function evaluateRulesAtomic(
  patientId: string,
  measurementType: MeasurementType
): Promise<void> {
  const applicableRules = ALERT_RULES.filter(
    rule => rule.measurementType === measurementType
  );

  for (const rule of applicableRules) {
    try {
      const trigger = await rule.evaluate(patientId);

      if (trigger) {
        // Use transaction to prevent race conditions
        await prisma.$transaction(async (tx) => {
          // Check if there's already an open alert for this rule
          const existingAlert = await tx.alert.findFirst({
            where: {
              patientId,
              ruleId: rule.id,
              status: "OPEN",
            },
          });

          if (existingAlert) {
            // Update existing alert with new inputs (condition is ongoing)
            await tx.alert.update({
              where: { id: existingAlert.id },
              data: {
                severity: trigger.severity,
                inputs: trigger.inputs as Prisma.InputJsonValue,
                updatedAt: new Date(),
              },
            });
          } else {
            // Create new alert
            await tx.alert.create({
              data: {
                patientId,
                ruleId: rule.id,
                ruleName: rule.name,
                severity: trigger.severity,
                inputs: trigger.inputs as Prisma.InputJsonValue,
              },
            });
          }
        });
      }
    } catch (error) {
      logger.error(
        { err: error, ruleId: rule.id, patientId },
        `Error evaluating alert rule ${rule.id}`
      );
    }
  }
}

// ============================================
// Alert CRUD Operations
// ============================================

export async function getAlertsByPatient(
  patientId: string,
  options?: {
    status?: AlertStatus;
    limit?: number;
    offset?: number;
  }
) {
  return prisma.alert.findMany({
    where: {
      patientId,
      status: options?.status,
    },
    orderBy: { triggeredAt: "desc" },
    take: options?.limit ?? 50,
    skip: options?.offset ?? 0,
    include: {
      patient: {
        select: { id: true, name: true },
      },
    },
  });
}

export async function getAlertsForClinician(
  clinicianId: string,
  options?: {
    status?: AlertStatus;
    limit?: number;
    offset?: number;
  }
) {
  // Get all active enrollments for this clinician
  const enrollments = await prisma.enrollment.findMany({
    where: {
      clinicianId,
      status: "ACTIVE",
    },
    select: { patientId: true },
  });

  const patientIds = enrollments.map(e => e.patientId);

  return prisma.alert.findMany({
    where: {
      patientId: { in: patientIds },
      status: options?.status,
    },
    orderBy: [
      { severity: "desc" }, // CRITICAL first
      { triggeredAt: "desc" },
    ],
    take: options?.limit ?? 50,
    skip: options?.offset ?? 0,
    include: {
      patient: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}

export async function acknowledgeAlert(
  alertId: string,
  clinicianId: string
): Promise<boolean> {
  const alert = await prisma.alert.findUnique({
    where: { id: alertId },
  });

  if (!alert || alert.status !== "OPEN") {
    return false;
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
    return false;
  }

  await prisma.alert.update({
    where: { id: alertId },
    data: {
      status: "ACKNOWLEDGED",
      acknowledgedBy: clinicianId,
      acknowledgedAt: new Date(),
    },
  });

  return true;
}

export async function dismissAlert(
  alertId: string,
  clinicianId: string
): Promise<boolean> {
  const alert = await prisma.alert.findUnique({
    where: { id: alertId },
  });

  if (!alert || alert.status === "DISMISSED") {
    return false;
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
    return false;
  }

  await prisma.alert.update({
    where: { id: alertId },
    data: {
      status: "DISMISSED",
      acknowledgedBy: clinicianId,
      acknowledgedAt: new Date(),
    },
  });

  return true;
}

export async function getAlertById(id: string) {
  return prisma.alert.findUnique({
    where: { id },
    include: {
      patient: {
        select: { id: true, name: true, email: true },
      },
      clinician: {
        select: { id: true, name: true },
      },
    },
  });
}
