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

// Medication validation
export const medicationSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name is too long"),
  dosage: z.string().max(100, "Dosage is too long").optional(),
  frequency: z.string().max(100, "Frequency is too long").optional(),
  instructions: z.string().max(500, "Instructions are too long").optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const medicationUpdateSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name is too long").optional(),
  dosage: z.string().max(100, "Dosage is too long").optional().nullable(),
  frequency: z.string().max(100, "Frequency is too long").optional().nullable(),
  instructions: z.string().max(500, "Instructions are too long").optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const adherenceLogSchema = z.object({
  taken: z.boolean(),
  notes: z.string().max(500, "Notes are too long").optional(),
  scheduledFor: z.string().datetime().optional(),
});

export type PatientRegisterDto = z.infer<typeof patientRegisterSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type SymptomCheckinDto = z.infer<typeof symptomCheckinSchema>;
export type MeasurementDto = z.infer<typeof measurementSchema>;
export type BloodPressureDto = z.infer<typeof bloodPressureSchema>;
export type MedicationDto = z.infer<typeof medicationSchema>;
export type MedicationUpdateDto = z.infer<typeof medicationUpdateSchema>;
export type AdherenceLogDto = z.infer<typeof adherenceLogSchema>;

// Document validation
export const documentTypeSchema = z.enum(["LAB_RESULT", "OTHER"]);

const allowedMimeTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
] as const;

export const uploadRequestSchema = z.object({
  filename: z.string().min(1, "Filename is required").max(255, "Filename is too long"),
  mimeType: z.enum(allowedMimeTypes, {
    error: "Invalid file type. Allowed: PDF, JPEG, PNG, HEIC",
  }),
  sizeBytes: z
    .number()
    .int("Size must be an integer")
    .min(1, "File cannot be empty")
    .max(10 * 1024 * 1024, "File size cannot exceed 10MB"),
  type: documentTypeSchema.optional(),
  title: z.string().max(200, "Title is too long").optional(),
  notes: z.string().max(1000, "Notes are too long").optional(),
  documentDate: z.string().datetime().optional(),
});

export const documentMetadataSchema = z.object({
  title: z.string().max(200, "Title is too long").optional().nullable(),
  notes: z.string().max(1000, "Notes are too long").optional().nullable(),
  documentDate: z.string().datetime().optional().nullable(),
  type: documentTypeSchema.optional(),
});

export type UploadRequestDto = z.infer<typeof uploadRequestSchema>;
export type DocumentMetadataDto = z.infer<typeof documentMetadataSchema>;

// Lab result validation
export const labResultFlagSchema = z.enum(["H", "L", "C"]);

export const labResultSchema = z.object({
  analyteName: z.string().min(1, "Analyte name is required").max(100, "Analyte name is too long"),
  analyteCode: z.string().max(50, "Analyte code is too long").optional(),
  value: z.number({ error: "Value must be a number" }),
  unit: z.string().min(1, "Unit is required").max(20, "Unit is too long"),
  referenceRangeLow: z.number().optional(),
  referenceRangeHigh: z.number().optional(),
  flag: labResultFlagSchema.optional(),
});

export const labReportSchema = z.object({
  collectedAt: z.string().datetime(),
  reportedAt: z.string().datetime().optional(),
  labName: z.string().max(200, "Lab name is too long").optional(),
  orderingProvider: z.string().max(200, "Provider name is too long").optional(),
  notes: z.string().max(1000, "Notes are too long").optional(),
  documentId: z.string().uuid().optional(),
  results: z.array(labResultSchema).optional(),
});

export const labReportUpdateSchema = z.object({
  collectedAt: z.string().datetime().optional(),
  reportedAt: z.string().datetime().optional().nullable(),
  labName: z.string().max(200, "Lab name is too long").optional().nullable(),
  orderingProvider: z.string().max(200, "Provider name is too long").optional().nullable(),
  notes: z.string().max(1000, "Notes are too long").optional().nullable(),
});

export const labResultUpdateSchema = z.object({
  analyteName: z.string().min(1, "Analyte name is required").max(100, "Analyte name is too long").optional(),
  analyteCode: z.string().max(50, "Analyte code is too long").optional().nullable(),
  value: z.number().optional(),
  unit: z.string().min(1, "Unit is required").max(20, "Unit is too long").optional(),
  referenceRangeLow: z.number().optional().nullable(),
  referenceRangeHigh: z.number().optional().nullable(),
  flag: labResultFlagSchema.optional().nullable(),
});

export type LabResultDto = z.infer<typeof labResultSchema>;
export type LabReportDto = z.infer<typeof labReportSchema>;
export type LabReportUpdateDto = z.infer<typeof labReportUpdateSchema>;
export type LabResultUpdateDto = z.infer<typeof labResultUpdateSchema>;
