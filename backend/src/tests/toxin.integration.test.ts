import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import {
  testApp,
  prisma,
  createTestPatient,
  createTestClinician,
  createTestClinic,
  createClinicMembership,
  getClinicianToken,
  cleanupTestData,
  disconnectPrisma,
} from "./setup.js";

describe("Toxin Tracking Integration Tests", () => {
  let patientId: string;
  let clinicianId: string;
  let clinicId: string;
  let clinicianToken: string;
  let toxinCategoryId: string;

  beforeEach(async () => {
    await cleanupTestData();

    // Create test clinic, patient and clinician
    const clinic = await createTestClinic();
    clinicId = clinic.id;

    const patient = await createTestPatient();
    patientId = patient.id;

    const clinician = await createTestClinician();
    clinicianId = clinician.id;
    clinicianToken = getClinicianToken(clinician.id);

    // Create clinic membership
    await createClinicMembership(clinic.id, clinician.id);

    // Create enrollment
    await prisma.enrollment.create({
      data: {
        patientId: patient.id,
        clinicianId: clinician.id,
        clinicId: clinic.id,
      },
    });

    // Create a test toxin category
    const category = await prisma.kidneyToxinCategory.create({
      data: {
        name: "Test Toxin",
        description: "Test toxin description",
        examples: "Example A, Example B",
        riskLevel: "HIGH",
        sortOrder: 1,
      },
    });
    toxinCategoryId = category.id;
  });

  afterAll(async () => {
    await cleanupTestData();
    await disconnectPrisma();
  });

  describe("GET /clinician/toxin-categories", () => {
    it("returns all active toxin categories", async () => {
      const response = await request(testApp)
        .get("/clinician/toxin-categories")
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.categories).toBeDefined();
      expect(Array.isArray(response.body.categories)).toBe(true);
      expect(response.body.categories.length).toBeGreaterThan(0);

      const category = response.body.categories.find(
        (c: { id: string }) => c.id === toxinCategoryId
      );
      expect(category).toBeDefined();
      expect(category.name).toBe("Test Toxin");
      expect(category.riskLevel).toBe("HIGH");
    });

    it("does not return inactive categories", async () => {
      // Create an inactive category
      await prisma.kidneyToxinCategory.create({
        data: {
          name: "Inactive Toxin",
          description: "Should not appear",
          riskLevel: "LOW",
          isActive: false,
          sortOrder: 99,
        },
      });

      const response = await request(testApp)
        .get("/clinician/toxin-categories")
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      const inactiveCategory = response.body.categories.find(
        (c: { name: string }) => c.name === "Inactive Toxin"
      );
      expect(inactiveCategory).toBeUndefined();
    });

    it("requires authentication", async () => {
      const response = await request(testApp).get("/clinician/toxin-categories");

      expect(response.status).toBe(401);
    });
  });

  describe("GET /clinician/patients/:patientId/toxins", () => {
    it("returns patient toxin records with categories", async () => {
      // Create a toxin record for the patient
      await prisma.patientToxinRecord.create({
        data: {
          patientId,
          toxinCategoryId,
          isEducated: true,
          educatedAt: new Date(),
          educatedById: clinicianId,
          notes: "Test notes",
        },
      });

      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/toxins`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.records).toBeDefined();
      expect(response.body.categories).toBeDefined();
      expect(response.body.records.length).toBe(1);
      expect(response.body.records[0].isEducated).toBe(true);
      expect(response.body.records[0].toxinCategory.name).toBe("Test Toxin");
    });

    it("returns 404 for unenrolled patient", async () => {
      const otherPatient = await createTestPatient({
        email: "other.patient@example.com",
      });

      const response = await request(testApp)
        .get(`/clinician/patients/${otherPatient.id}/toxins`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Patient not found or not enrolled");
    });

    it("returns empty records array if no toxin records exist", async () => {
      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/toxins`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.records).toEqual([]);
      expect(response.body.categories.length).toBeGreaterThan(0);
    });
  });

  describe("PUT /clinician/patients/:patientId/toxins/:categoryId", () => {
    it("creates a new toxin record", async () => {
      const response = await request(testApp)
        .put(`/clinician/patients/${patientId}/toxins/${toxinCategoryId}`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({
          isEducated: true,
          notes: "Patient understands the risks",
        });

      expect(response.status).toBe(200);
      expect(response.body.record).toBeDefined();
      expect(response.body.record.isEducated).toBe(true);
      expect(response.body.record.educatedAt).toBeDefined();
      expect(response.body.record.educatedBy.id).toBe(clinicianId);
      expect(response.body.record.notes).toBe("Patient understands the risks");
    });

    it("updates an existing toxin record", async () => {
      // Create initial record
      await prisma.patientToxinRecord.create({
        data: {
          patientId,
          toxinCategoryId,
          isEducated: false,
        },
      });

      const response = await request(testApp)
        .put(`/clinician/patients/${patientId}/toxins/${toxinCategoryId}`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({
          isEducated: true,
          lastExposureDate: "2025-12-15",
          exposureNotes: "CT scan performed",
          riskOverride: "HIGH",
        });

      expect(response.status).toBe(200);
      expect(response.body.record.isEducated).toBe(true);
      expect(response.body.record.exposureNotes).toBe("CT scan performed");
      expect(response.body.record.riskOverride).toBe("HIGH");
    });

    it("clears educated status when set to false", async () => {
      // Create a record that is marked educated
      await prisma.patientToxinRecord.create({
        data: {
          patientId,
          toxinCategoryId,
          isEducated: true,
          educatedAt: new Date(),
          educatedById: clinicianId,
        },
      });

      const response = await request(testApp)
        .put(`/clinician/patients/${patientId}/toxins/${toxinCategoryId}`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({
          isEducated: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.record.isEducated).toBe(false);
      expect(response.body.record.educatedAt).toBeNull();
      expect(response.body.record.educatedBy).toBeNull();
    });

    it("rejects invalid riskOverride value", async () => {
      const response = await request(testApp)
        .put(`/clinician/patients/${patientId}/toxins/${toxinCategoryId}`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({
          riskOverride: "INVALID",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid riskOverride");
    });

    it("rejects invalid lastExposureDate", async () => {
      const response = await request(testApp)
        .put(`/clinician/patients/${patientId}/toxins/${toxinCategoryId}`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({
          lastExposureDate: "not-a-date",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid lastExposureDate");
    });

    it("allows clearing lastExposureDate by passing null", async () => {
      // Create a record with exposure date
      await prisma.patientToxinRecord.create({
        data: {
          patientId,
          toxinCategoryId,
          lastExposureDate: new Date("2025-12-01"),
        },
      });

      const response = await request(testApp)
        .put(`/clinician/patients/${patientId}/toxins/${toxinCategoryId}`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({
          lastExposureDate: null,
        });

      expect(response.status).toBe(200);
      expect(response.body.record.lastExposureDate).toBeNull();
    });

    it("returns 404 for unenrolled patient", async () => {
      const otherPatient = await createTestPatient({
        email: "other2.patient@example.com",
      });

      const response = await request(testApp)
        .put(`/clinician/patients/${otherPatient.id}/toxins/${toxinCategoryId}`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({
          isEducated: true,
        });

      expect(response.status).toBe(404);
    });

    it("returns 404 for invalid toxin category", async () => {
      const response = await request(testApp)
        .put(`/clinician/patients/${patientId}/toxins/invalid-category-id`)
        .set("Authorization", `Bearer ${clinicianToken}`)
        .send({
          isEducated: true,
        });

      expect(response.status).toBe(404);
    });
  });

  describe("POST /clinician/patients/:patientId/toxins/:categoryId/educate", () => {
    it("marks patient as educated on a toxin category", async () => {
      const response = await request(testApp)
        .post(`/clinician/patients/${patientId}/toxins/${toxinCategoryId}/educate`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.record).toBeDefined();
      expect(response.body.record.isEducated).toBe(true);
      expect(response.body.record.educatedAt).toBeDefined();
      expect(response.body.record.educatedBy.id).toBe(clinicianId);
    });

    it("creates a new record if none exists", async () => {
      const response = await request(testApp)
        .post(`/clinician/patients/${patientId}/toxins/${toxinCategoryId}/educate`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);

      // Verify the record was created
      const record = await prisma.patientToxinRecord.findUnique({
        where: {
          patientId_toxinCategoryId: {
            patientId,
            toxinCategoryId,
          },
        },
      });
      expect(record).toBeDefined();
      expect(record?.isEducated).toBe(true);
    });

    it("updates existing record to educated", async () => {
      // Create uneducated record
      await prisma.patientToxinRecord.create({
        data: {
          patientId,
          toxinCategoryId,
          isEducated: false,
          notes: "Existing notes",
        },
      });

      const response = await request(testApp)
        .post(`/clinician/patients/${patientId}/toxins/${toxinCategoryId}/educate`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(200);
      expect(response.body.record.isEducated).toBe(true);
      expect(response.body.record.notes).toBe("Existing notes"); // Preserved
    });

    it("returns 404 for unenrolled patient", async () => {
      const otherPatient = await createTestPatient({
        email: "other3.patient@example.com",
      });

      const response = await request(testApp)
        .post(`/clinician/patients/${otherPatient.id}/toxins/${toxinCategoryId}/educate`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(404);
    });

    it("returns 404 for invalid toxin category", async () => {
      const response = await request(testApp)
        .post(`/clinician/patients/${patientId}/toxins/invalid-id/educate`)
        .set("Authorization", `Bearer ${clinicianToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe("Authorization checks", () => {
    it("different clinician cannot access patient toxins", async () => {
      // Create another clinician not enrolled with this patient
      const otherClinician = await createTestClinician({
        email: "other.clinician@example.com",
      });
      const otherToken = getClinicianToken(otherClinician.id);

      const response = await request(testApp)
        .get(`/clinician/patients/${patientId}/toxins`)
        .set("Authorization", `Bearer ${otherToken}`);

      expect(response.status).toBe(404);
    });

    it("different clinician cannot update patient toxins", async () => {
      const otherClinician = await createTestClinician({
        email: "other2.clinician@example.com",
      });
      const otherToken = getClinicianToken(otherClinician.id);

      const response = await request(testApp)
        .put(`/clinician/patients/${patientId}/toxins/${toxinCategoryId}`)
        .set("Authorization", `Bearer ${otherToken}`)
        .send({
          isEducated: true,
        });

      expect(response.status).toBe(404);
    });
  });
});
