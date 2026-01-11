import { MeasurementType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { TREND_THRESHOLDS, MIN_TREND_TIME_SPAN_MS, fromCanonical, DISPLAY_UNITS } from "../lib/units.js";

// ============================================
// Guardrails
// ============================================

const DEFAULT_LIMIT = 200;
const HARD_MAX_LIMIT = 2000;
const DEFAULT_TIMEZONE = "UTC";

// Blood pressure pairing window (measurements within this window are considered paired)
const BP_PAIRING_WINDOW_MS = 60 * 1000; // 1 minute

function clampLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_LIMIT;
  return Math.min(Math.max(1, limit), HARD_MAX_LIMIT);
}

// ============================================
// Types
// ============================================

export type TimeSeriesPoint = {
  timestamp: string;
  value: number;
  source: string;
};

export type DailyAggregate = {
  date: string;
  min: number;
  max: number;
  avg: number;
  count: number;
};

export type TimeSeriesResponse = {
  type: MeasurementType;
  unit: string;
  displayUnit: string;
  points: TimeSeriesPoint[];
  range: {
    from: string;
    to: string;
  };
  meta: {
    timezone: string;
    totalCount: number;
    returnedCount: number;
    hasMore: boolean;
  };
};

export type DailyAggregateResponse = {
  type: MeasurementType;
  unit: string;
  displayUnit: string;
  aggregates: DailyAggregate[];
  range: {
    from: string;
    to: string;
  };
  meta: {
    timezone: string;
    bucketDefinition: string;
    totalDays: number;
  };
};

/**
 * Get raw time-series data points for a patient's measurements
 */
export async function getTimeSeriesData(
  patientId: string,
  type: MeasurementType,
  options?: {
    from?: Date;
    to?: Date;
    limit?: number;
    displayUnit?: string;
    timezone?: string;
  }
): Promise<TimeSeriesResponse | null> {
  const from = options?.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = options?.to ?? new Date();
  const limit = clampLimit(options?.limit);
  const timezone = options?.timezone ?? DEFAULT_TIMEZONE;
  const displayUnit = options?.displayUnit ?? DISPLAY_UNITS[type];

  // Get total count first
  const totalCount = await prisma.measurement.count({
    where: {
      patientId,
      type,
      timestamp: { gte: from, lte: to },
    },
  });

  const measurements = await prisma.measurement.findMany({
    where: {
      patientId,
      type,
      timestamp: { gte: from, lte: to },
    },
    orderBy: { timestamp: "asc" },
    take: limit,
    select: {
      timestamp: true,
      value: true,
      unit: true,
      source: true,
    },
  });

  if (measurements.length === 0) {
    return null;
  }

  const canonicalUnit = measurements[0].unit;

  return {
    type,
    unit: canonicalUnit,
    displayUnit,
    points: measurements.map((m) => ({
      timestamp: m.timestamp.toISOString(),
      value: fromCanonical(type, m.value.toNumber(), displayUnit),
      source: m.source,
    })),
    range: {
      from: from.toISOString(),
      to: to.toISOString(),
    },
    meta: {
      timezone,
      totalCount,
      returnedCount: measurements.length,
      hasMore: totalCount > measurements.length,
    },
  };
}

/**
 * Get daily aggregated data for trend visualization
 */
export async function getDailyAggregates(
  patientId: string,
  type: MeasurementType,
  options?: {
    from?: Date;
    to?: Date;
    displayUnit?: string;
    timezone?: string;
  }
): Promise<DailyAggregateResponse | null> {
  const from = options?.from ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const to = options?.to ?? new Date();
  const timezone = options?.timezone ?? DEFAULT_TIMEZONE;
  const displayUnit = options?.displayUnit ?? DISPLAY_UNITS[type];

  // Limit to 365 days max to prevent unbounded queries
  const maxRange = 365 * 24 * 60 * 60 * 1000;
  const adjustedFrom = new Date(Math.max(from.getTime(), to.getTime() - maxRange));

  const measurements = await prisma.measurement.findMany({
    where: {
      patientId,
      type,
      timestamp: { gte: adjustedFrom, lte: to },
    },
    orderBy: { timestamp: "asc" },
    take: HARD_MAX_LIMIT, // Safety limit
    select: {
      timestamp: true,
      value: true,
      unit: true,
    },
  });

  if (measurements.length === 0) {
    return null;
  }

  const canonicalUnit = measurements[0].unit;

  // Group by date and calculate aggregates
  // Note: Using UTC for bucketing. Frontend should interpret dates in patient timezone.
  const dailyMap = new Map<string, number[]>();

  for (const m of measurements) {
    const dateKey = m.timestamp.toISOString().split("T")[0]; // YYYY-MM-DD in UTC
    const displayValue = fromCanonical(type, m.value.toNumber(), displayUnit);
    const existing = dailyMap.get(dateKey);
    if (existing) {
      existing.push(displayValue);
    } else {
      dailyMap.set(dateKey, [displayValue]);
    }
  }

  const aggregates: DailyAggregate[] = [];
  for (const [date, values] of dailyMap.entries()) {
    aggregates.push({
      date,
      min: Number(Math.min(...values).toFixed(2)),
      max: Number(Math.max(...values).toFixed(2)),
      avg: Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)),
      count: values.length,
    });
  }

  aggregates.sort((a, b) => a.date.localeCompare(b.date));

  return {
    type,
    unit: canonicalUnit,
    displayUnit,
    aggregates,
    range: {
      from: adjustedFrom.toISOString(),
      to: to.toISOString(),
    },
    meta: {
      timezone,
      bucketDefinition: `Daily buckets in ${timezone}. Date represents start of day (00:00:00).`,
      totalDays: aggregates.length,
    },
  };
}

/**
 * Get blood pressure data as paired systolic/diastolic readings
 */
export type BloodPressurePoint = {
  timestamp: string;
  systolic: number;
  diastolic: number;
  source: string;
};

export type BloodPressureResponse = {
  unit: string;
  points: BloodPressurePoint[];
  range: {
    from: string;
    to: string;
  };
  meta: {
    timezone: string;
    pairingWindowMs: number;
    pairedCount: number;
    unpairedSystolicCount: number;
    unpairedDiastolicCount: number;
  };
};

export async function getBloodPressureTimeSeries(
  patientId: string,
  options?: {
    from?: Date;
    to?: Date;
    limit?: number;
    timezone?: string;
  }
): Promise<BloodPressureResponse | null> {
  const from = options?.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = options?.to ?? new Date();
  const limit = clampLimit(options?.limit);
  const timezone = options?.timezone ?? DEFAULT_TIMEZONE;

  // Get both systolic and diastolic measurements
  const [systolicData, diastolicData] = await Promise.all([
    prisma.measurement.findMany({
      where: {
        patientId,
        type: "BP_SYSTOLIC",
        timestamp: { gte: from, lte: to },
      },
      orderBy: { timestamp: "asc" },
      take: HARD_MAX_LIMIT,
      select: { timestamp: true, value: true, unit: true, source: true },
    }),
    prisma.measurement.findMany({
      where: {
        patientId,
        type: "BP_DIASTOLIC",
        timestamp: { gte: from, lte: to },
      },
      orderBy: { timestamp: "asc" },
      take: HARD_MAX_LIMIT,
      select: { timestamp: true, value: true, source: true },
    }),
  ]);

  if (systolicData.length === 0) {
    return null;
  }

  // Create a map of diastolic readings by timestamp (with window tolerance)
  const diastolicByTime: Array<{ time: number; value: number; source: string; used: boolean }> =
    diastolicData.map(d => ({
      time: d.timestamp.getTime(),
      value: d.value.toNumber(),
      source: d.source,
      used: false,
    }));

  // Pair systolic with diastolic (within pairing window)
  const points: BloodPressurePoint[] = [];
  const usedSystolic = new Set<number>();

  for (const s of systolicData) {
    const sTime = s.timestamp.getTime();

    // Find closest diastolic within window
    let bestMatch: typeof diastolicByTime[0] | null = null;
    let bestDiff = Infinity;

    for (const d of diastolicByTime) {
      if (d.used) continue;
      const diff = Math.abs(sTime - d.time);
      if (diff <= BP_PAIRING_WINDOW_MS && diff < bestDiff) {
        bestDiff = diff;
        bestMatch = d;
      }
    }

    if (bestMatch) {
      points.push({
        timestamp: s.timestamp.toISOString(),
        systolic: s.value.toNumber(),
        diastolic: bestMatch.value,
        source: s.source, // Use systolic source (should match diastolic for paired readings)
      });
      bestMatch.used = true;
      usedSystolic.add(sTime);
    }
  }

  // Apply limit
  const limitedPoints = points.slice(0, limit);

  // Count unpaired
  const unpairedSystolicCount = systolicData.length - points.length;
  const unpairedDiastolicCount = diastolicByTime.filter(d => !d.used).length;

  return {
    unit: systolicData[0].unit,
    points: limitedPoints,
    range: {
      from: from.toISOString(),
      to: to.toISOString(),
    },
    meta: {
      timezone,
      pairingWindowMs: BP_PAIRING_WINDOW_MS,
      pairedCount: points.length,
      unpairedSystolicCount,
      unpairedDiastolicCount,
    },
  };
}

/**
 * Get summary statistics for a measurement type
 */
export type TrendMetadata = {
  method: "two_window_comparison";
  recentWindowSize: number;
  olderWindowSize: number;
  recentAvg: number;
  olderAvg: number;
  absoluteChange: number;
  thresholdUsed: number;
  timeSpanMs: number;
  minTimeSpanMs: number;
};

export type MeasurementSummary = {
  type: MeasurementType;
  unit: string;
  displayUnit: string;
  latest: {
    value: number;
    timestamp: string;
    source: string;
  } | null;
  stats: {
    min: number;
    max: number;
    avg: number;
    count: number;
  } | null;
  trend: "increasing" | "decreasing" | "stable" | "insufficient_data";
  trendMeta?: TrendMetadata;
  range: {
    from: string;
    to: string;
  };
  meta: {
    timezone: string;
  };
};

export async function getMeasurementSummary(
  patientId: string,
  type: MeasurementType,
  options?: {
    from?: Date;
    to?: Date;
    displayUnit?: string;
    timezone?: string;
  }
): Promise<MeasurementSummary> {
  const from = options?.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = options?.to ?? new Date();
  const timezone = options?.timezone ?? DEFAULT_TIMEZONE;
  const displayUnit = options?.displayUnit ?? DISPLAY_UNITS[type];

  const measurements = await prisma.measurement.findMany({
    where: {
      patientId,
      type,
      timestamp: { gte: from, lte: to },
    },
    orderBy: { timestamp: "desc" },
    take: HARD_MAX_LIMIT,
    select: { timestamp: true, value: true, unit: true, source: true },
  });

  if (measurements.length === 0) {
    return {
      type,
      unit: "",
      displayUnit,
      latest: null,
      stats: null,
      trend: "insufficient_data",
      range: { from: from.toISOString(), to: to.toISOString() },
      meta: { timezone },
    };
  }

  const canonicalUnit = measurements[0].unit;
  const values = measurements.map((m) => fromCanonical(type, m.value.toNumber(), displayUnit));

  // Calculate trend with clinical thresholds
  let trend: MeasurementSummary["trend"] = "insufficient_data";
  let trendMeta: TrendMetadata | undefined;

  // Need at least 4 points AND sufficient time span
  const timeSpanMs = measurements[0].timestamp.getTime() -
                     measurements[measurements.length - 1].timestamp.getTime();

  if (measurements.length >= 4 && timeSpanMs >= MIN_TREND_TIME_SPAN_MS) {
    const midpoint = Math.floor(measurements.length / 2);
    const recentHalf = values.slice(0, midpoint);
    const olderHalf = values.slice(midpoint);

    const recentAvg = recentHalf.reduce((a, b) => a + b, 0) / recentHalf.length;
    const olderAvg = olderHalf.reduce((a, b) => a + b, 0) / olderHalf.length;
    const absoluteChange = recentAvg - olderAvg;

    // Use clinically significant thresholds (converted to display unit)
    const threshold = fromCanonical(type, TREND_THRESHOLDS[type].significant, displayUnit);

    if (absoluteChange > threshold) {
      trend = "increasing";
    } else if (absoluteChange < -threshold) {
      trend = "decreasing";
    } else {
      trend = "stable";
    }

    trendMeta = {
      method: "two_window_comparison",
      recentWindowSize: recentHalf.length,
      olderWindowSize: olderHalf.length,
      recentAvg: Number(recentAvg.toFixed(2)),
      olderAvg: Number(olderAvg.toFixed(2)),
      absoluteChange: Number(absoluteChange.toFixed(2)),
      thresholdUsed: Number(threshold.toFixed(2)),
      timeSpanMs,
      minTimeSpanMs: MIN_TREND_TIME_SPAN_MS,
    };
  }

  return {
    type,
    unit: canonicalUnit,
    displayUnit,
    latest: {
      value: values[0],
      timestamp: measurements[0].timestamp.toISOString(),
      source: measurements[0].source,
    },
    stats: {
      min: Number(Math.min(...values).toFixed(2)),
      max: Number(Math.max(...values).toFixed(2)),
      avg: Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)),
      count: values.length,
    },
    trend,
    trendMeta,
    range: { from: from.toISOString(), to: to.toISOString() },
    meta: { timezone },
  };
}

/**
 * Get dashboard overview with all measurement summaries
 */
export async function getPatientDashboard(
  patientId: string,
  options?: {
    from?: Date;
    to?: Date;
    timezone?: string;
  }
): Promise<{
  weight: MeasurementSummary;
  bloodPressure: {
    systolic: MeasurementSummary;
    diastolic: MeasurementSummary;
  };
  spo2: MeasurementSummary;
  heartRate: MeasurementSummary;
  meta: {
    timezone: string;
    generatedAt: string;
  };
}> {
  const timezone = options?.timezone ?? DEFAULT_TIMEZONE;

  const [weight, systolic, diastolic, spo2, heartRate] = await Promise.all([
    getMeasurementSummary(patientId, "WEIGHT", { ...options, timezone }),
    getMeasurementSummary(patientId, "BP_SYSTOLIC", { ...options, timezone }),
    getMeasurementSummary(patientId, "BP_DIASTOLIC", { ...options, timezone }),
    getMeasurementSummary(patientId, "SPO2", { ...options, timezone }),
    getMeasurementSummary(patientId, "HEART_RATE", { ...options, timezone }),
  ]);

  return {
    weight,
    bloodPressure: { systolic, diastolic },
    spo2,
    heartRate,
    meta: {
      timezone,
      generatedAt: new Date().toISOString(),
    },
  };
}
