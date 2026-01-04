import "dotenv/config";
import bcrypt from "bcrypt";
import { createApp } from "../app.js";
import { signToken, TokenPayload } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";

// Test app instance (with rate limiting and HTTP logging disabled)
export const testApp = createApp({ skipRateLimiting: true, skipHttpLogging: true });

// Re-export prisma from the app's client
export { prisma };

// Test user data
export const testPatient = {
  email: "test.patient@example.com",
  password: "TestPass123",
  name: "Test Patient",
  dateOfBirth: new Date("1990-01-15"),
};

export const testClinician = {
  email: "test.clinician@example.com",
  password: "TestPass123",
  name: "Dr. Test Clinician",
};

/**
 * Create a test patient in the database
 */
export async function createTestPatient(overrides: Partial<typeof testPatient> = {}) {
  const data = { ...testPatient, ...overrides };
  const hashedPassword = await bcrypt.hash(data.password, 10);

  return prisma.patient.create({
    data: {
      email: data.email,
      passwordHash: hashedPassword,
      name: data.name,
      dateOfBirth: data.dateOfBirth,
    },
  });
}

/**
 * Create a test clinician in the database
 */
export async function createTestClinician(overrides: Partial<typeof testClinician> = {}) {
  const data = { ...testClinician, ...overrides };
  const hashedPassword = await bcrypt.hash(data.password, 10);

  return prisma.clinician.create({
    data: {
      email: data.email,
      passwordHash: hashedPassword,
      name: data.name,
    },
  });
}

/**
 * Get an auth token for a patient
 */
export function getPatientToken(patientId: string, email: string = testPatient.email): string {
  const payload: TokenPayload = {
    sub: patientId,
    email,
    role: "patient",
  };
  return signToken(payload);
}

/**
 * Get an auth token for a clinician
 */
export function getClinicianToken(clinicianId: string, email: string = testClinician.email): string {
  const payload: TokenPayload = {
    sub: clinicianId,
    email,
    role: "clinician",
  };
  return signToken(payload);
}

/**
 * Clean up test data from the database
 * Call this in afterEach or afterAll hooks
 */
export async function cleanupTestData() {
  // Delete in order respecting foreign key constraints
  // Use $executeRaw for tables that might have complex dependencies
  await prisma.$executeRaw`DELETE FROM "interaction_logs"`;
  await prisma.alert.deleteMany({});
  await prisma.clinicianNote.deleteMany({});
  await prisma.symptomCheckin.deleteMany({});
  await prisma.measurement.deleteMany({});
  await prisma.enrollment.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.clinician.deleteMany({});
}

/**
 * Disconnect Prisma client
 * Call this in afterAll hook
 */
export async function disconnectPrisma() {
  await prisma.$disconnect();
}
