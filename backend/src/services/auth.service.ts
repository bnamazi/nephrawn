import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";
import { signToken, TokenPayload } from "../lib/jwt.js";

const SALT_ROUNDS = 10;

export type PatientRegisterInput = {
  email: string;
  password: string;
  name: string;
  dateOfBirth: Date;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type AuthResult = {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: "patient" | "clinician" | "admin";
  };
};

export async function registerPatient(input: PatientRegisterInput): Promise<AuthResult> {
  const existingPatient = await prisma.patient.findUnique({
    where: { email: input.email },
  });

  if (existingPatient) {
    throw new Error("Email already registered");
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const patient = await prisma.patient.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name,
      dateOfBirth: input.dateOfBirth,
    },
  });

  const payload: TokenPayload = {
    sub: patient.id,
    email: patient.email,
    role: "patient",
  };

  return {
    token: signToken(payload),
    user: {
      id: patient.id,
      email: patient.email,
      name: patient.name,
      role: "patient",
    },
  };
}

export async function loginPatient(input: LoginInput): Promise<AuthResult> {
  const patient = await prisma.patient.findUnique({
    where: { email: input.email },
  });

  if (!patient) {
    throw new Error("Invalid credentials");
  }

  const validPassword = await bcrypt.compare(input.password, patient.passwordHash);

  if (!validPassword) {
    throw new Error("Invalid credentials");
  }

  const payload: TokenPayload = {
    sub: patient.id,
    email: patient.email,
    role: "patient",
  };

  return {
    token: signToken(payload),
    user: {
      id: patient.id,
      email: patient.email,
      name: patient.name,
      role: "patient",
    },
  };
}

export async function loginClinician(input: LoginInput): Promise<AuthResult> {
  const clinician = await prisma.clinician.findUnique({
    where: { email: input.email },
  });

  if (!clinician) {
    throw new Error("Invalid credentials");
  }

  const validPassword = await bcrypt.compare(input.password, clinician.passwordHash);

  if (!validPassword) {
    throw new Error("Invalid credentials");
  }

  const role = clinician.role === "ADMIN" ? "admin" : "clinician";

  const payload: TokenPayload = {
    sub: clinician.id,
    email: clinician.email,
    role,
  };

  return {
    token: signToken(payload),
    user: {
      id: clinician.id,
      email: clinician.email,
      name: clinician.name,
      role,
    },
  };
}
