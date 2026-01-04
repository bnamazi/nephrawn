import { z } from "zod";

// Password must be at least 8 chars with uppercase, lowercase, and number
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

// Date of birth validation: not in future, reasonable age (0-120 years)
const dateOfBirthSchema = z.string().transform((val, ctx) => {
  const date = new Date(val);
  if (isNaN(date.getTime())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid date format",
    });
    return z.NEVER;
  }

  const now = new Date();
  if (date > now) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Date of birth cannot be in the future",
    });
    return z.NEVER;
  }

  const age = (now.getTime() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (age > 120) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Age cannot exceed 120 years",
    });
    return z.NEVER;
  }

  return date;
});

export const patientRegisterSchema = z.object({
  email: z.email(),
  password: passwordSchema,
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  dateOfBirth: dateOfBirthSchema,
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1, "Password is required"),
});

// Symptom severity: 0 = none, 1 = mild, 2 = moderate, 3 = severe
const severitySchema = z.number().min(0).max(3);

const symptomEntrySchema = z.object({
  severity: severitySchema,
  location: z.string().optional(),
  atRest: z.boolean().optional(),
});

const appetiteLevelSchema = z.number().min(0).max(3); // 0 = none, 1 = poor, 2 = fair, 3 = good

export const symptomCheckinSchema = z.object({
  symptoms: z.object({
    edema: z.object({ severity: severitySchema, location: z.string().optional() }).optional(),
    fatigue: z.object({ severity: severitySchema }).optional(),
    shortnessOfBreath: z.object({ severity: severitySchema, atRest: z.boolean().optional() }).optional(),
    nausea: z.object({ severity: severitySchema }).optional(),
    appetite: z.object({ level: appetiteLevelSchema }).optional(),
    pain: z.object({ severity: severitySchema, location: z.string().optional() }).optional(),
  }),
  notes: z.string().optional(),
  timestamp: z.string().datetime().optional(),
});

// Measurement types and validation
export const measurementTypeSchema = z.enum([
  "WEIGHT",
  "BP_SYSTOLIC",
  "BP_DIASTOLIC",
  "SPO2",
  "HEART_RATE",
]);

// Measurement bounds by type (all in canonical units)
const measurementBounds: Record<string, { min: number; max: number; unit: string }> = {
  WEIGHT: { min: 20, max: 500, unit: "kg" }, // 20-500 kg
  BP_SYSTOLIC: { min: 40, max: 300, unit: "mmHg" },
  BP_DIASTOLIC: { min: 20, max: 200, unit: "mmHg" },
  SPO2: { min: 50, max: 100, unit: "%" }, // SpO2 below 50% is barely measurable
  HEART_RATE: { min: 20, max: 300, unit: "bpm" },
};

export const measurementSchema = z
  .object({
    type: measurementTypeSchema,
    value: z.number().positive("Value must be positive"),
    unit: z.string().min(1, "Unit is required"),
    timestamp: z.string().datetime().optional(),
  })
  .check((payload) => {
    const data = payload.value;
    const bounds = measurementBounds[data.type];
    if (!bounds) return;
    // For weight, convert lbs to kg for validation if needed
    let valueInCanonicalUnit = data.value;
    if (data.type === "WEIGHT" && data.unit === "lbs") {
      valueInCanonicalUnit = data.value * 0.453592;
    }
    if (valueInCanonicalUnit < bounds.min || valueInCanonicalUnit > bounds.max) {
      payload.issues.push({
        code: "custom",
        message: `${data.type} must be between ${bounds.min} and ${bounds.max} ${bounds.unit}`,
        path: ["value"],
        input: data.value,
      });
    }
  });

// Blood pressure is submitted as a pair
export const bloodPressureSchema = z.object({
  systolic: z.number().min(40).max(300),
  diastolic: z.number().min(20).max(200),
  unit: z.literal("mmHg").optional().default("mmHg"),
  timestamp: z.string().datetime().optional(),
});

export type PatientRegisterDto = z.infer<typeof patientRegisterSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type SymptomCheckinDto = z.infer<typeof symptomCheckinSchema>;
export type MeasurementDto = z.infer<typeof measurementSchema>;
export type BloodPressureDto = z.infer<typeof bloodPressureSchema>;
