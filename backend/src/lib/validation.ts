import { z } from "zod";

export const patientRegisterSchema = z.object({
  email: z.email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required"),
  dateOfBirth: z.string().transform((val) => new Date(val)),
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

export const measurementSchema = z.object({
  type: measurementTypeSchema,
  value: z.number().positive("Value must be positive"),
  unit: z.string().min(1, "Unit is required"),
  timestamp: z.string().datetime().optional(),
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
