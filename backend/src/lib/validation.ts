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

export type PatientRegisterDto = z.infer<typeof patientRegisterSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
