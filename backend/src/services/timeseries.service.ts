import { MeasurementType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export type TimeSeriesPoint = {
  timestamp: string;
  value: number;
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
  points: TimeSeriesPoint[];
  range: {
    from: string;
    to: string;
  };
};

export type DailyAggregateResponse = {
  type: MeasurementType;
  unit: string;
  aggregates: DailyAggregate[];
  range: {
    from: string;
    to: string;
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
  }
): Promise<TimeSeriesResponse | null> {
  const from = options?.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
  const to = options?.to ?? new Date();

  const measurements = await prisma.measurement.findMany({
    where: {
      patientId,
      type,
      timestamp: {
        gte: from,
        lte: to,
      },
    },
    orderBy: { timestamp: "asc" },
    take: options?.limit ?? 1000,
    select: {
      timestamp: true,
      value: true,
      unit: true,
    },
  });

  if (measurements.length === 0) {
    return null;
  }

  return {
    type,
    unit: measurements[0].unit,
    points: measurements.map((m) => ({
      timestamp: m.timestamp.toISOString(),
      value: m.value.toNumber(),
    })),
    range: {
      from: from.toISOString(),
      to: to.toISOString(),
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
  }
): Promise<DailyAggregateResponse | null> {
  const from = options?.from ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // Default: last 90 days
  const to = options?.to ?? new Date();

  // Get all measurements in range
  const measurements = await prisma.measurement.findMany({
    where: {
      patientId,
      type,
      timestamp: {
        gte: from,
        lte: to,
      },
    },
    orderBy: { timestamp: "asc" },
    select: {
      timestamp: true,
      value: true,
      unit: true,
    },
  });

  if (measurements.length === 0) {
    return null;
  }

  // Group by date and calculate aggregates
  const dailyMap = new Map<string, { values: number[]; unit: string }>();

  for (const m of measurements) {
    const dateKey = m.timestamp.toISOString().split("T")[0]; // YYYY-MM-DD
    const existing = dailyMap.get(dateKey);
    if (existing) {
      existing.values.push(m.value.toNumber());
    } else {
      dailyMap.set(dateKey, { values: [m.value.toNumber()], unit: m.unit });
    }
  }

  const aggregates: DailyAggregate[] = [];
  for (const [date, data] of dailyMap.entries()) {
    const values = data.values;
    aggregates.push({
      date,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)),
      count: values.length,
    });
  }

  // Sort by date
  aggregates.sort((a, b) => a.date.localeCompare(b.date));

  return {
    type,
    unit: measurements[0].unit,
    aggregates,
    range: {
      from: from.toISOString(),
      to: to.toISOString(),
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
};

export type BloodPressureResponse = {
  unit: string;
  points: BloodPressurePoint[];
  range: {
    from: string;
    to: string;
  };
};

export async function getBloodPressureTimeSeries(
  patientId: string,
  options?: {
    from?: Date;
    to?: Date;
    limit?: number;
  }
): Promise<BloodPressureResponse | null> {
  const from = options?.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = options?.to ?? new Date();

  // Get both systolic and diastolic measurements
  const [systolicData, diastolicData] = await Promise.all([
    prisma.measurement.findMany({
      where: {
        patientId,
        type: "BP_SYSTOLIC",
        timestamp: { gte: from, lte: to },
      },
      orderBy: { timestamp: "asc" },
      select: { timestamp: true, value: true, unit: true },
    }),
    prisma.measurement.findMany({
      where: {
        patientId,
        type: "BP_DIASTOLIC",
        timestamp: { gte: from, lte: to },
      },
      orderBy: { timestamp: "asc" },
      select: { timestamp: true, value: true },
    }),
  ]);

  if (systolicData.length === 0) {
    return null;
  }

  // Create a map of diastolic readings by timestamp
  const diastolicMap = new Map<string, number>();
  for (const d of diastolicData) {
    diastolicMap.set(d.timestamp.toISOString(), d.value.toNumber());
  }

  // Pair systolic with diastolic (they should have matching timestamps)
  const points: BloodPressurePoint[] = [];
  for (const s of systolicData) {
    const ts = s.timestamp.toISOString();
    const diastolic = diastolicMap.get(ts);
    if (diastolic !== undefined) {
      points.push({
        timestamp: ts,
        systolic: s.value.toNumber(),
        diastolic,
      });
    }
  }

  if (options?.limit && points.length > options.limit) {
    points.splice(options.limit);
  }

  return {
    unit: systolicData[0].unit,
    points,
    range: {
      from: from.toISOString(),
      to: to.toISOString(),
    },
  };
}

/**
 * Get summary statistics for a measurement type
 */
export type MeasurementSummary = {
  type: MeasurementType;
  unit: string;
  latest: {
    value: number;
    timestamp: string;
  } | null;
  stats: {
    min: number;
    max: number;
    avg: number;
    count: number;
  } | null;
  trend: "increasing" | "decreasing" | "stable" | "insufficient_data";
  range: {
    from: string;
    to: string;
  };
};

export async function getMeasurementSummary(
  patientId: string,
  type: MeasurementType,
  options?: {
    from?: Date;
    to?: Date;
  }
): Promise<MeasurementSummary> {
  const from = options?.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = options?.to ?? new Date();

  const measurements = await prisma.measurement.findMany({
    where: {
      patientId,
      type,
      timestamp: { gte: from, lte: to },
    },
    orderBy: { timestamp: "desc" },
    select: { timestamp: true, value: true, unit: true },
  });

  if (measurements.length === 0) {
    return {
      type,
      unit: "",
      latest: null,
      stats: null,
      trend: "insufficient_data",
      range: { from: from.toISOString(), to: to.toISOString() },
    };
  }

  const values = measurements.map((m) => m.value.toNumber());
  const unit = measurements[0].unit;

  // Calculate trend (compare first half avg to second half avg)
  let trend: MeasurementSummary["trend"] = "insufficient_data";
  if (measurements.length >= 4) {
    const midpoint = Math.floor(measurements.length / 2);
    const recentHalf = values.slice(0, midpoint);
    const olderHalf = values.slice(midpoint);

    const recentAvg = recentHalf.reduce((a, b) => a + b, 0) / recentHalf.length;
    const olderAvg = olderHalf.reduce((a, b) => a + b, 0) / olderHalf.length;

    const percentChange = ((recentAvg - olderAvg) / olderAvg) * 100;

    if (percentChange > 5) {
      trend = "increasing";
    } else if (percentChange < -5) {
      trend = "decreasing";
    } else {
      trend = "stable";
    }
  }

  return {
    type,
    unit,
    latest: {
      value: values[0],
      timestamp: measurements[0].timestamp.toISOString(),
    },
    stats: {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)),
      count: values.length,
    },
    trend,
    range: { from: from.toISOString(), to: to.toISOString() },
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
  }
): Promise<{
  weight: MeasurementSummary;
  bloodPressure: {
    systolic: MeasurementSummary;
    diastolic: MeasurementSummary;
  };
  spo2: MeasurementSummary;
  heartRate: MeasurementSummary;
}> {
  const [weight, systolic, diastolic, spo2, heartRate] = await Promise.all([
    getMeasurementSummary(patientId, "WEIGHT", options),
    getMeasurementSummary(patientId, "BP_SYSTOLIC", options),
    getMeasurementSummary(patientId, "BP_DIASTOLIC", options),
    getMeasurementSummary(patientId, "SPO2", options),
    getMeasurementSummary(patientId, "HEART_RATE", options),
  ]);

  return {
    weight,
    bloodPressure: { systolic, diastolic },
    spo2,
    heartRate,
  };
}
