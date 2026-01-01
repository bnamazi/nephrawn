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

export type PatientRegisterDto = z.infer<typeof patientRegisterSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type SymptomCheckinDto = z.infer<typeof symptomCheckinSchema>;
