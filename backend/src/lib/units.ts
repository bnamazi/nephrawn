import { MeasurementType } from "@prisma/client";

/**
 * Canonical Units for Nephrawn
 * All measurements are stored internally in these units.
 * Conversion happens at ingestion time.
 */

export const CANONICAL_UNITS: Record<MeasurementType, string> = {
  WEIGHT: "kg",
  BP_SYSTOLIC: "mmHg",
  BP_DIASTOLIC: "mmHg",
  SPO2: "%",
  HEART_RATE: "bpm",
};

// Display units (defaults for frontend)
export const DISPLAY_UNITS: Record<MeasurementType, string> = {
  WEIGHT: "lbs", // US default
  BP_SYSTOLIC: "mmHg",
  BP_DIASTOLIC: "mmHg",
  SPO2: "%",
  HEART_RATE: "bpm",
};

// Conversion factors TO canonical units
type ConversionFn = (value: number) => number;

const CONVERSIONS: Record<string, Record<string, ConversionFn>> = {
  WEIGHT: {
    kg: (v) => v,
    lbs: (v) => v * 0.453592,
    lb: (v) => v * 0.453592,
    pounds: (v) => v * 0.453592,
  },
  BP_SYSTOLIC: {
    mmHg: (v) => v,
    mmhg: (v) => v,
  },
  BP_DIASTOLIC: {
    mmHg: (v) => v,
    mmhg: (v) => v,
  },
  SPO2: {
    "%": (v) => v,
    percent: (v) => v,
  },
  HEART_RATE: {
    bpm: (v) => v,
    "beats/min": (v) => v,
  },
};

// Conversion factors FROM canonical units (for display)
const DISPLAY_CONVERSIONS: Record<string, Record<string, ConversionFn>> = {
  WEIGHT: {
    kg: (v) => v,
    lbs: (v) => v / 0.453592,
    lb: (v) => v / 0.453592,
  },
  BP_SYSTOLIC: {
    mmHg: (v) => v,
  },
  BP_DIASTOLIC: {
    mmHg: (v) => v,
  },
  SPO2: {
    "%": (v) => v,
  },
  HEART_RATE: {
    bpm: (v) => v,
  },
};

/**
 * Convert a value from input unit to canonical unit
 * @returns The value in canonical units, or null if conversion not possible
 */
export function toCanonical(
  type: MeasurementType,
  value: number,
  inputUnit: string
): { value: number; canonicalUnit: string } | null {
  const normalizedUnit = inputUnit.toLowerCase().trim();
  const typeConversions = CONVERSIONS[type];

  if (!typeConversions) {
    return null;
  }

  // Try exact match first
  const converter = typeConversions[normalizedUnit] || typeConversions[inputUnit];

  if (!converter) {
    return null;
  }

  return {
    value: Number(converter(value).toFixed(4)),
    canonicalUnit: CANONICAL_UNITS[type],
  };
}

/**
 * Convert a value from canonical unit to display unit
 */
export function fromCanonical(
  type: MeasurementType,
  value: number,
  displayUnit: string
): number {
  const typeConversions = DISPLAY_CONVERSIONS[type];

  if (!typeConversions) {
    return value;
  }

  const converter = typeConversions[displayUnit] || typeConversions[displayUnit.toLowerCase()];

  if (!converter) {
    return value;
  }

  return Number(converter(value).toFixed(2));
}

/**
 * Check if a unit is valid for a measurement type
 */
export function isValidUnit(type: MeasurementType, unit: string): boolean {
  const normalizedUnit = unit.toLowerCase().trim();
  const typeConversions = CONVERSIONS[type];

  if (!typeConversions) {
    return false;
  }

  return normalizedUnit in typeConversions || unit in typeConversions;
}

/**
 * Get list of accepted units for a measurement type
 */
export function getAcceptedUnits(type: MeasurementType): string[] {
  const typeConversions = CONVERSIONS[type];
  return typeConversions ? Object.keys(typeConversions) : [];
}

/**
 * Clinical thresholds for trend detection (in canonical units)
 * These are clinically meaningful thresholds, not arbitrary percentages.
 */
export const TREND_THRESHOLDS: Record<MeasurementType, { significant: number; unit: string }> = {
  WEIGHT: { significant: 1.0, unit: "kg" }, // 1 kg (~2.2 lbs) is clinically significant
  BP_SYSTOLIC: { significant: 10, unit: "mmHg" }, // 10 mmHg change is significant
  BP_DIASTOLIC: { significant: 5, unit: "mmHg" }, // 5 mmHg change is significant
  SPO2: { significant: 2, unit: "%" }, // 2% change is significant
  HEART_RATE: { significant: 10, unit: "bpm" }, // 10 bpm change is significant
};

/**
 * Minimum time span required for trend calculation (in milliseconds)
 */
export const MIN_TREND_TIME_SPAN_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Alert rule thresholds (in canonical units - kg for weight)
 */
export const ALERT_THRESHOLDS = {
  WEIGHT_GAIN_48H: 1.36, // ~3 lbs in kg
  WEIGHT_GAIN_48H_CRITICAL: 2.27, // ~5 lbs in kg
  BP_SYSTOLIC_HIGH: 180, // mmHg
  BP_SYSTOLIC_CRITICAL: 200, // mmHg
  BP_SYSTOLIC_LOW: 90, // mmHg
  BP_SYSTOLIC_CRITICAL_LOW: 80, // mmHg
  SPO2_LOW: 92, // %
  SPO2_CRITICAL: 88, // %
};
