import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import type { Express } from "express";

const hashPassword = (password: string) => bcrypt.hash(password, 10);

describe("Clinic Management API", () => {
  let app: Express;
  let adminToken: string;
  let clinicianToken: string;
  let adminId: string;
  let clinicianId: string;
  let testClinicId: string;

  beforeAll(async () => {
    app = createApp({ skipRateLimiting: true, skipHttpLogging: true });

    // Clean up any existing test data
    await prisma.clinicMembership.deleteMany({
      where: { clinician: { email: { contains: "clinic.test" } } },
    });
    await prisma.clinic.deleteMany({
      where: { slug: { startsWith: "test-clinic-" } },
    });
    await prisma.clinician.deleteMany({
      where: { email: { contains: "clinic.test" } },
    });

    // Create admin clinician
    const admin = await prisma.clinician.create({
      data: {
        email: "admin.clinic.test@example.com",
        passwordHash: await hashPassword("AdminPass123"),
        name: "Admin Clinician",
        role: "ADMIN",
      },
    });
    adminId = admin.id;

    // Create regular clinician
    const clinician = await prisma.clinician.create({
      data: {
        email: "regular.clinic.test@example.com",
        passwordHash: await hashPassword("ClinicianPass123"),
        name: "Regular Clinician",
        role: "CLINICIAN",
      },
    });
    clinicianId = clinician.id;

    // Login as admin
    const adminLogin = await request(app)
      .post("/auth/clinician/login")
      .send({ email: "admin.clinic.test@example.com", password: "AdminPass123" });
    adminToken = adminLogin.body.token;

    // Login as clinician
    const clinicianLogin = await request(app)
      .post("/auth/clinician/login")
      .send({ email: "regular.clinic.test@example.com", password: "ClinicianPass123" });
    clinicianToken = clinicianLogin.body.token;
  });

  afterAll(async () => {
    // Clean up
    await prisma.clinicMembership.deleteMany({
      where: { clinician: { email: { contains: "clinic.test" } } },
    });
    await prisma.clinic.deleteMany({
      where: { slug: { startsWith: "test-clinic-" } },
    });
    await prisma.clinician.deleteMany({
      where: { email: { contains: "clinic.test" } },
    });
  });

  describe("POST /admin/clinics", () => {
    it("should create a clinic when admin", async () => {
      const res = await request(app)
        .post("/admin/clinics")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Test Clinic One",
          slug: "test-clinic-one",
          npi: "1234567890",
          phone: "555-0100",
          timezone: "America/Los_Angeles",
        });

      expect(res.status).toBe(201);
      expect(res.body.clinic).toBeDefined();
      expect(res.body.clinic.name).toBe("Test Clinic One");
      expect(res.body.clinic.slug).toBe("test-clinic-one");
      expect(res.body.clinic.npi).toBe("1234567890");
      expect(res.body.clinic.timezone).toBe("America/Los_Angeles");
      testClinicId = res.body.clinic.id;

      // Verify owner membership was created
      const membership = await prisma.clinicMembership.findUnique({
        where: { clinicId_clinicianId: { clinicId: testClinicId, clinicianId: adminId } },
      });
      expect(membership).toBeDefined();
      expect(membership!.role).toBe("OWNER");
    });

    it("should reject non-admin users", async () => {
      const res = await request(app)
        .post("/admin/clinics")
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({
          name: "Another Clinic",
          slug: "test-clinic-another",
        });

      expect(res.status).toBe(403);
    });

    it("should reject duplicate slug", async () => {
      const res = await request(app)
        .post("/admin/clinics")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Duplicate Slug Clinic",
          slug: "test-clinic-one", // Already exists
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("SLUG_EXISTS");
    });

    it("should reject duplicate NPI", async () => {
      const res = await request(app)
        .post("/admin/clinics")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Duplicate NPI Clinic",
          slug: "test-clinic-npi-dup",
          npi: "1234567890", // Already exists
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("NPI_EXISTS");
    });

    it("should reject invalid slug format", async () => {
      const res = await request(app)
        .post("/admin/clinics")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Bad Slug Clinic",
          slug: "Test Clinic!", // Invalid characters
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_SLUG");
    });

    it("should require name and slug", async () => {
      const res = await request(app)
        .post("/admin/clinics")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe("GET /clinician/clinic/:clinicId", () => {
    it("should return clinic details for members", async () => {
      const res = await request(app)
        .get(`/clinician/clinic/${testClinicId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.clinic).toBeDefined();
      expect(res.body.clinic.name).toBe("Test Clinic One");
      expect(res.body.clinic._count).toBeDefined();
    });

    it("should reject non-members", async () => {
      const res = await request(app)
        .get(`/clinician/clinic/${testClinicId}`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe("PUT /clinician/clinic/:clinicId", () => {
    it("should update clinic as owner", async () => {
      const res = await request(app)
        .put(`/clinician/clinic/${testClinicId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Test Clinic One Updated",
          phone: "555-0101",
          email: "clinic@example.com",
        });

      expect(res.status).toBe(200);
      expect(res.body.clinic.name).toBe("Test Clinic One Updated");
      expect(res.body.clinic.phone).toBe("555-0101");
      expect(res.body.clinic.email).toBe("clinic@example.com");
    });

    it("should reject non-admin members", async () => {
      // First add clinician as STAFF
      await prisma.clinicMembership.create({
        data: {
          clinicId: testClinicId,
          clinicianId: clinicianId,
          role: "STAFF",
          status: "ACTIVE",
        },
      });

      const res = await request(app)
        .put(`/clinician/clinic/${testClinicId}`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({ name: "Unauthorized Update" });

      expect(res.status).toBe(403);
    });
  });

  describe("GET /clinician/clinic/:clinicId/members", () => {
    it("should list clinic members", async () => {
      const res = await request(app)
        .get(`/clinician/clinic/${testClinicId}/members`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.members).toBeDefined();
      expect(Array.isArray(res.body.members)).toBe(true);
      expect(res.body.members.length).toBeGreaterThanOrEqual(1);

      const owner = res.body.members.find((m: any) => m.role === "OWNER");
      expect(owner).toBeDefined();
    });

    it("should allow any member to view members", async () => {
      const res = await request(app)
        .get(`/clinician/clinic/${testClinicId}/members`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(res.status).toBe(200);
      expect(res.body.members).toBeDefined();
    });
  });

  describe("POST /clinician/clinic/:clinicId/members", () => {
    let newClinicianId: string;
    let newClinicianToken: string;

    beforeAll(async () => {
      // Create a new clinician to add
      const newClinician = await prisma.clinician.create({
        data: {
          email: "new.clinic.test@example.com",
          passwordHash: await hashPassword("NewPass123"),
          name: "New Clinician",
          role: "CLINICIAN",
        },
      });
      newClinicianId = newClinician.id;

      const login = await request(app)
        .post("/auth/clinician/login")
        .send({ email: "new.clinic.test@example.com", password: "NewPass123" });
      newClinicianToken = login.body.token;
    });

    afterAll(async () => {
      await prisma.clinicMembership.deleteMany({
        where: { clinicianId: newClinicianId },
      });
      await prisma.clinician.delete({ where: { id: newClinicianId } });
    });

    it("should add a clinician to the clinic", async () => {
      const res = await request(app)
        .post(`/clinician/clinic/${testClinicId}/members`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          email: "new.clinic.test@example.com",
          role: "CLINICIAN",
        });

      expect(res.status).toBe(201);
      expect(res.body.member).toBeDefined();
      expect(res.body.member.role).toBe("CLINICIAN");
    });

    it("should reject duplicate membership", async () => {
      const res = await request(app)
        .post(`/clinician/clinic/${testClinicId}/members`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          email: "new.clinic.test@example.com",
          role: "CLINICIAN",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("already a member");
    });

    it("should reject non-owner adding admin role", async () => {
      // First, promote clinician to ADMIN so they can try to add another admin
      await prisma.clinicMembership.update({
        where: { clinicId_clinicianId: { clinicId: testClinicId, clinicianId: clinicianId } },
        data: { role: "ADMIN" },
      });

      // Create another clinician to try to add as admin
      const anotherClinician = await prisma.clinician.create({
        data: {
          email: "another.clinic.test@example.com",
          passwordHash: await hashPassword("AnotherPass123"),
          name: "Another Clinician",
          role: "CLINICIAN",
        },
      });

      const res = await request(app)
        .post(`/clinician/clinic/${testClinicId}/members`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({
          email: "another.clinic.test@example.com",
          role: "ADMIN",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Only owner");

      // Clean up
      await prisma.clinician.delete({ where: { id: anotherClinician.id } });
    });
  });

  describe("PUT /clinician/clinic/:clinicId/members/:clinicianId/role", () => {
    it("should update member role as owner", async () => {
      const res = await request(app)
        .put(`/clinician/clinic/${testClinicId}/members/${clinicianId}/role`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ role: "STAFF" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify role was updated
      const membership = await prisma.clinicMembership.findUnique({
        where: { clinicId_clinicianId: { clinicId: testClinicId, clinicianId: clinicianId } },
      });
      expect(membership!.role).toBe("STAFF");
    });

    it("should reject non-owner updating roles", async () => {
      const res = await request(app)
        .put(`/clinician/clinic/${testClinicId}/members/${adminId}/role`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({ role: "STAFF" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Only owners");
    });

    it("should prevent demoting last owner", async () => {
      const res = await request(app)
        .put(`/clinician/clinic/${testClinicId}/members/${adminId}/role`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ role: "ADMIN" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("last owner");
    });
  });

  describe("DELETE /clinician/clinic/:clinicId/members/:clinicianId", () => {
    it("should remove a member as owner", async () => {
      // First verify clinicianId is a member
      const membershipBefore = await prisma.clinicMembership.findUnique({
        where: { clinicId_clinicianId: { clinicId: testClinicId, clinicianId: clinicianId } },
      });
      expect(membershipBefore).toBeDefined();

      const res = await request(app)
        .delete(`/clinician/clinic/${testClinicId}/members/${clinicianId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify membership is now inactive
      const membershipAfter = await prisma.clinicMembership.findUnique({
        where: { clinicId_clinicianId: { clinicId: testClinicId, clinicianId: clinicianId } },
      });
      expect(membershipAfter!.status).toBe("INACTIVE");
    });

    it("should prevent removing last owner", async () => {
      const res = await request(app)
        .delete(`/clinician/clinic/${testClinicId}/members/${adminId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("last owner");
    });
  });
});
