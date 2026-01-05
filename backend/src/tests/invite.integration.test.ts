import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import {
  testApp,
  prisma,
  createTestPatient,
  createTestClinician,
  createTestClinic,
  createClinicMembership,
  getPatientToken,
  getClinicianToken,
  cleanupTestData,
  disconnectPrisma,
} from "./setup.js";

describe("Invite Integration Tests", () => {
  let clinicId: string;
  let clinicianId: string;
  let clinicianToken: string;

  beforeEach(async () => {
    await cleanupTestData();

    // Create test clinic and clinician
    const clinic = await createTestClinic();
    clinicId = clinic.id;

    const clinician = await createTestClinician();
    clinicianId = clinician.id;
    clinicianToken = getClinicianToken(clinician.id);

    // Create clinic membership
    await createClinicMembership(clinic.id, clinician.id, "OWNER");
  });

  afterAll(async () => {
    await cleanupTestData();
    await disconnectPrisma();
  });

  describe("POST /clinician/clinic/:clinicId/invites", () => {
    it("creates a new invite", async () => {
      const response = await request(testApp)
        .post(`/clinician/clinic/${clinicId}/invites`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({
          patientName: "John Doe",
          patientDob: "1985-03-15",
          patientEmail: "john.doe@example.com",
        });

      expect(response.status).toBe(201);
      expect(response.body.invite).toBeDefined();
      expect(response.body.invite.code).toHaveLength(40);
      expect(response.body.invite.patientName).toBe("John Doe");
      expect(response.body.invite.patientEmail).toBe("john.doe@example.com");
      expect(response.body.invite.status).toBe("PENDING");
      expect(response.body.remainingToday).toBeDefined();
    });

    it("creates invite without email", async () => {
      const response = await request(testApp)
        .post(`/clinician/clinic/${clinicId}/invites`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({
          patientName: "Jane Doe",
          patientDob: "1990-06-20",
        });

      expect(response.status).toBe(201);
      expect(response.body.invite.patientEmail).toBeNull();
    });

    it("rejects invite without patient name", async () => {
      const response = await request(testApp)
        .post(`/clinician/clinic/${clinicId}/invites`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({
          patientDob: "1985-03-15",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Patient name");
    });

    it("rejects invite without DOB", async () => {
      const response = await request(testApp)
        .post(`/clinician/clinic/${clinicId}/invites`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({
          patientName: "John Doe",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("date of birth");
    });

    it("rejects invalid DOB format", async () => {
      const response = await request(testApp)
        .post(`/clinician/clinic/${clinicId}/invites`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({
          patientName: "John Doe",
          patientDob: "not-a-date",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid date");
    });

    it("rejects future DOB", async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const response = await request(testApp)
        .post(`/clinician/clinic/${clinicId}/invites`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({
          patientName: "John Doe",
          patientDob: futureDate.toISOString(),
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("past");
    });

    it("rejects invalid email format", async () => {
      const response = await request(testApp)
        .post(`/clinician/clinic/${clinicId}/invites`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({
          patientName: "John Doe",
          patientDob: "1985-03-15",
          patientEmail: "not-an-email",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("email");
    });

    it("rejects request from non-member", async () => {
      // Create another clinician without membership
      const otherClinician = await createTestClinician({
        email: "other.clinician@example.com",
      });
      const otherToken = getClinicianToken(otherClinician.id);

      const response = await request(testApp)
        .post(`/clinician/clinic/${clinicId}/invites`)
        .set("Authorization", `Bearer ${otherToken}`)
        .send({
          patientName: "John Doe",
          patientDob: "1985-03-15",
        });

      expect(response.status).toBe(403);
    });
  });

  describe("GET /clinician/clinic/:clinicId/invites", () => {
    beforeEach(async () => {
      // Create some test invites
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await prisma.invite.createMany({
        data: [
          {
            code: "A".repeat(40),
            clinicId,
            createdById: clinicianId,
            patientName: "Patient One",
            patientDob: new Date("1985-01-01"),
            status: "PENDING",
            expiresAt,
          },
          {
            code: "B".repeat(40),
            clinicId,
            createdById: clinicianId,
            patientName: "Patient Two",
            patientDob: new Date("1990-06-15"),
            status: "PENDING",
            expiresAt,
          },
          {
            code: "C".repeat(40),
            clinicId,
            createdById: clinicianId,
            patientName: "Patient Three",
            patientDob: new Date("1980-12-25"),
            status: "CLAIMED",
            expiresAt,
          },
        ],
      });
    });

    it("lists pending invites", async () => {
      const response = await request(testApp)
        .get(`/clinician/clinic/${clinicId}/invites`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.invites).toHaveLength(2); // Only PENDING
      expect(response.body.invites[0].patientName).toBeDefined();
      expect(response.body.invites[0].code).toBeDefined();
    });

    it("supports pagination", async () => {
      const response = await request(testApp)
        .get(`/clinician/clinic/${clinicId}/invites?limit=1&offset=0`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.invites).toHaveLength(1);
      expect(response.body.pagination.hasMore).toBe(true);
    });
  });

  describe("DELETE /clinician/clinic/:clinicId/invites/:inviteId", () => {
    let inviteId: string;

    beforeEach(async () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invite = await prisma.invite.create({
        data: {
          code: "D".repeat(40),
          clinicId,
          createdById: clinicianId,
          patientName: "Test Patient",
          patientDob: new Date("1985-01-01"),
          status: "PENDING",
          expiresAt,
        },
      });
      inviteId = invite.id;
    });

    it("revokes a pending invite", async () => {
      const response = await request(testApp)
        .delete(`/clinician/clinic/${clinicId}/invites/${inviteId}`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify in database
      const invite = await prisma.invite.findUnique({ where: { id: inviteId } });
      expect(invite?.status).toBe("REVOKED");
    });

    it("cannot revoke already claimed invite", async () => {
      // Mark as claimed first
      await prisma.invite.update({
        where: { id: inviteId },
        data: { status: "CLAIMED" },
      });

      const response = await request(testApp)
        .delete(`/clinician/clinic/${clinicId}/invites/${inviteId}`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("CLAIMED");
    });
  });

  describe("GET /auth/invite/:code (public)", () => {
    let inviteCode: string;

    beforeEach(async () => {
      inviteCode = "E".repeat(40);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await prisma.invite.create({
        data: {
          code: inviteCode,
          clinicId,
          createdById: clinicianId,
          patientName: "Test Patient",
          patientDob: new Date("1985-01-01"),
          status: "PENDING",
          expiresAt,
        },
      });
    });

    it("validates a pending invite code", async () => {
      const response = await request(testApp).get(`/auth/invite/${inviteCode}`);

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
      expect(response.body.clinicName).toBe("Test Clinic");
      expect(response.body.expiresAt).toBeDefined();
    });

    it("returns 404 for non-existent code", async () => {
      const response = await request(testApp).get(`/auth/invite/${"Z".repeat(40)}`);

      expect(response.status).toBe(404);
    });

    it("returns 410 for expired invite", async () => {
      // Create expired invite
      const expiredCode = "F".repeat(40);
      const expiredAt = new Date();
      expiredAt.setDate(expiredAt.getDate() - 1);

      await prisma.invite.create({
        data: {
          code: expiredCode,
          clinicId,
          createdById: clinicianId,
          patientName: "Expired Patient",
          patientDob: new Date("1985-01-01"),
          status: "PENDING",
          expiresAt: expiredAt,
        },
      });

      const response = await request(testApp).get(`/auth/invite/${expiredCode}`);

      expect(response.status).toBe(410);
      expect(response.body.reason).toBe("expired");
    });

    it("returns 410 for claimed invite", async () => {
      await prisma.invite.update({
        where: { code: inviteCode },
        data: { status: "CLAIMED" },
      });

      const response = await request(testApp).get(`/auth/invite/${inviteCode}`);

      expect(response.status).toBe(410);
      expect(response.body.reason).toBe("claimed");
    });

    it("rejects invalid code format", async () => {
      const response = await request(testApp).get("/auth/invite/tooshort");

      expect(response.status).toBe(400);
    });
  });

  describe("POST /auth/invite/:code/claim (new patient)", () => {
    let inviteCode: string;
    const patientDob = "1985-01-01";

    beforeEach(async () => {
      inviteCode = "G".repeat(40);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await prisma.invite.create({
        data: {
          code: inviteCode,
          clinicId,
          createdById: clinicianId,
          patientName: "New Patient",
          patientDob: new Date(patientDob),
          status: "PENDING",
          expiresAt,
        },
      });
    });

    it("claims invite and creates new patient", async () => {
      const response = await request(testApp)
        .post(`/auth/invite/${inviteCode}/claim`)
        .send({
          dateOfBirth: patientDob,
          email: "newpatient@example.com",
          password: "SecurePass123",
          name: "New Patient",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.patient).toBeDefined();
      expect(response.body.patient.email).toBe("newpatient@example.com");
      expect(response.body.clinic.name).toBe("Test Clinic");
      expect(response.body.token).toBeDefined();
      expect(response.body.isNewPatient).toBe(true);

      // Verify invite is claimed
      const invite = await prisma.invite.findUnique({ where: { code: inviteCode } });
      expect(invite?.status).toBe("CLAIMED");
      expect(invite?.claimedById).toBe(response.body.patient.id);

      // Verify enrollment exists
      const enrollment = await prisma.enrollment.findFirst({
        where: { patientId: response.body.patient.id, clinicId },
      });
      expect(enrollment).toBeDefined();
      expect(enrollment?.enrolledVia).toBe("INVITE");
    });

    it("rejects claim with wrong DOB", async () => {
      const response = await request(testApp)
        .post(`/auth/invite/${inviteCode}/claim`)
        .send({
          dateOfBirth: "1990-06-15", // Wrong DOB
          email: "wrongdob@example.com",
          password: "SecurePass123",
          name: "Wrong DOB",
        });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("DOB_MISMATCH");
    });

    it("rejects claim with existing email", async () => {
      // Create a patient first
      await prisma.patient.create({
        data: {
          email: "existing@example.com",
          passwordHash: "hash",
          name: "Existing",
          dateOfBirth: new Date(patientDob),
        },
      });

      const response = await request(testApp)
        .post(`/auth/invite/${inviteCode}/claim`)
        .send({
          dateOfBirth: patientDob,
          email: "existing@example.com",
          password: "SecurePass123",
          name: "New Patient",
        });

      expect(response.status).toBe(409);
      expect(response.body.code).toBe("EMAIL_EXISTS");
    });

    it("rejects claim on already claimed invite", async () => {
      // First claim
      await request(testApp).post(`/auth/invite/${inviteCode}/claim`).send({
        dateOfBirth: patientDob,
        email: "first@example.com",
        password: "SecurePass123",
        name: "First Patient",
      });

      // Second claim attempt
      const response = await request(testApp)
        .post(`/auth/invite/${inviteCode}/claim`)
        .send({
          dateOfBirth: patientDob,
          email: "second@example.com",
          password: "SecurePass123",
          name: "Second Patient",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("no longer valid");
    });

    it("rejects claim with weak password", async () => {
      const response = await request(testApp)
        .post(`/auth/invite/${inviteCode}/claim`)
        .send({
          dateOfBirth: patientDob,
          email: "weak@example.com",
          password: "short",
          name: "Weak Password",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("8 characters");
    });

    it("rejects claim without required fields", async () => {
      const response = await request(testApp)
        .post(`/auth/invite/${inviteCode}/claim`)
        .send({
          dateOfBirth: patientDob,
          // Missing email, password, name
        });

      expect(response.status).toBe(400);
    });
  });

  describe("POST /auth/invite/:code/claim-existing (authenticated patient)", () => {
    let inviteCode: string;
    let patientId: string;
    let patientToken: string;
    const patientDob = "1990-01-15";

    beforeEach(async () => {
      // Create existing patient
      const patient = await createTestPatient();
      patientId = patient.id;
      patientToken = getPatientToken(patient.id);

      // Create invite matching patient's DOB
      inviteCode = "H".repeat(40);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await prisma.invite.create({
        data: {
          code: inviteCode,
          clinicId,
          createdById: clinicianId,
          patientName: "Test Patient",
          patientDob: new Date(patientDob), // Matches testPatient DOB
          status: "PENDING",
          expiresAt,
        },
      });
    });

    it("allows existing patient to claim invite", async () => {
      const response = await request(testApp)
        .post(`/auth/invite/${inviteCode}/claim-existing`)
        .set("Authorization", `Bearer ${patientToken}`)
        .send({
          dateOfBirth: patientDob,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.clinic.name).toBe("Test Clinic");

      // Verify enrollment
      const enrollment = await prisma.enrollment.findFirst({
        where: { patientId, clinicId },
      });
      expect(enrollment).toBeDefined();
    });

    it("rejects claim with mismatched DOB", async () => {
      const response = await request(testApp)
        .post(`/auth/invite/${inviteCode}/claim-existing`)
        .set("Authorization", `Bearer ${patientToken}`)
        .send({
          dateOfBirth: "1985-06-20", // Wrong DOB
        });

      expect(response.status).toBe(403);
    });

    it("rejects unauthenticated request", async () => {
      const response = await request(testApp)
        .post(`/auth/invite/${inviteCode}/claim-existing`)
        .send({
          dateOfBirth: patientDob,
        });

      expect(response.status).toBe(401);
    });
  });

  describe("GET /clinician/clinics", () => {
    it("lists clinician's clinic memberships", async () => {
      const response = await request(testApp)
        .get("/clinician/clinics")
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.clinics).toHaveLength(1);
      expect(response.body.clinics[0].name).toBe("Test Clinic");
      expect(response.body.clinics[0].role).toBe("OWNER");
    });

    it("returns empty list for clinician with no memberships", async () => {
      const otherClinician = await createTestClinician({
        email: "nomemberships@example.com",
      });
      const otherToken = getClinicianToken(otherClinician.id);

      const response = await request(testApp)
        .get("/clinician/clinics")
        .set("Authorization", `Bearer ${otherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.clinics).toHaveLength(0);
    });
  });
});
