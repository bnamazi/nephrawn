import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import request from "supertest";
import {
  testApp,
  prisma,
  testPatient,
  testClinician,
  createTestPatient,
  createTestClinician,
  getPatientToken,
  getClinicianToken,
  cleanupTestData,
  disconnectPrisma,
} from "./setup.js";

describe("Auth Integration Tests", () => {
  afterEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  describe("Patient Registration", () => {
    it("registers a new patient successfully", async () => {
      const response = await request(testApp)
        .post("/auth/patient/register")
        .send({
          email: testPatient.email,
          password: testPatient.password,
          name: testPatient.name,
          dateOfBirth: "1990-01-15",
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("token");
      expect(response.body).toHaveProperty("user");
      expect(response.body.user.email).toBe(testPatient.email);
      expect(response.body.user.name).toBe(testPatient.name);
      expect(response.body.user).not.toHaveProperty("passwordHash");
    });

    it("rejects registration with existing email", async () => {
      // Create existing patient
      await createTestPatient();

      const response = await request(testApp)
        .post("/auth/patient/register")
        .send({
          email: testPatient.email,
          password: testPatient.password,
          name: testPatient.name,
          dateOfBirth: "1990-01-15",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Email already registered");
    });

    it("rejects registration with weak password", async () => {
      const response = await request(testApp)
        .post("/auth/patient/register")
        .send({
          email: "newpatient@example.com",
          password: "weak", // Too short, no uppercase, no number
          name: testPatient.name,
          dateOfBirth: "1990-01-15",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
    });

    it("rejects registration with invalid email", async () => {
      const response = await request(testApp)
        .post("/auth/patient/register")
        .send({
          email: "not-an-email",
          password: testPatient.password,
          name: testPatient.name,
          dateOfBirth: "1990-01-15",
        });

      expect(response.status).toBe(400);
    });

    it("rejects registration with future date of birth", async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const response = await request(testApp)
        .post("/auth/patient/register")
        .send({
          email: "newpatient@example.com",
          password: testPatient.password,
          name: testPatient.name,
          dateOfBirth: futureDate.toISOString().split("T")[0],
        });

      expect(response.status).toBe(400);
    });
  });

  describe("Patient Login", () => {
    it("logs in with valid credentials", async () => {
      await createTestPatient();

      const response = await request(testApp)
        .post("/auth/patient/login")
        .send({
          email: testPatient.email,
          password: testPatient.password,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("token");
      expect(response.body).toHaveProperty("user");
      expect(response.body.user.email).toBe(testPatient.email);
    });

    it("rejects login with wrong password", async () => {
      await createTestPatient();

      const response = await request(testApp)
        .post("/auth/patient/login")
        .send({
          email: testPatient.email,
          password: "WrongPassword123",
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid credentials");
    });

    it("rejects login with non-existent email", async () => {
      const response = await request(testApp)
        .post("/auth/patient/login")
        .send({
          email: "nonexistent@example.com",
          password: testPatient.password,
        });

      expect(response.status).toBe(401);
    });
  });

  describe("Clinician Login", () => {
    it("logs in with valid credentials", async () => {
      await createTestClinician();

      const response = await request(testApp)
        .post("/auth/clinician/login")
        .send({
          email: testClinician.email,
          password: testClinician.password,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("token");
      expect(response.body).toHaveProperty("user");
      expect(response.body.user.email).toBe(testClinician.email);
    });

    it("rejects login with wrong password", async () => {
      await createTestClinician();

      const response = await request(testApp)
        .post("/auth/clinician/login")
        .send({
          email: testClinician.email,
          password: "WrongPassword123",
        });

      expect(response.status).toBe(401);
    });
  });

  describe("Protected Routes", () => {
    it("allows access to /patient/me with valid token", async () => {
      const patient = await createTestPatient();
      const token = getPatientToken(patient.id);

      const response = await request(testApp)
        .get("/patient/me")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.patient.id).toBe(patient.id);
      expect(response.body.patient.email).toBe(patient.email);
    });

    it("rejects access without token", async () => {
      const response = await request(testApp).get("/patient/me");

      expect(response.status).toBe(401);
    });

    it("rejects access with invalid token", async () => {
      const response = await request(testApp)
        .get("/patient/me")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
    });

    it("rejects access with expired token format", async () => {
      // Malformed token
      const response = await request(testApp)
        .get("/patient/me")
        .set("Authorization", "Bearer abc.def.ghi");

      expect(response.status).toBe(401);
    });

    it("allows access to /clinician/me with valid clinician token", async () => {
      const clinician = await createTestClinician();
      const token = getClinicianToken(clinician.id);

      const response = await request(testApp)
        .get("/clinician/me")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.clinician.id).toBe(clinician.id);
    });

    it("rejects patient token on clinician routes", async () => {
      const patient = await createTestPatient();
      const token = getPatientToken(patient.id);

      const response = await request(testApp)
        .get("/clinician/me")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
    });

    it("rejects clinician token on patient routes", async () => {
      const clinician = await createTestClinician();
      const token = getClinicianToken(clinician.id);

      const response = await request(testApp)
        .get("/patient/me")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
    });
  });
});
