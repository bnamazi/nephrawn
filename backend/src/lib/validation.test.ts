import { describe, it, expect } from "vitest";
import {
  patientRegisterSchema,
  loginSchema,
  measurementSchema,
  bloodPressureSchema,
  symptomCheckinSchema,
} from "./validation.js";

describe("validation schemas", () => {
  describe("patientRegisterSchema", () => {
    describe("password validation", () => {
      it("accepts valid password with uppercase, lowercase, and number", () => {
        const result = patientRegisterSchema.safeParse({
          email: "test@example.com",
          password: "Password1",
          name: "Test User",
          dateOfBirth: "1990-01-15",
        });
        expect(result.success).toBe(true);
      });

      it("rejects password without uppercase", () => {
        const result = patientRegisterSchema.safeParse({
          email: "test@example.com",
          password: "password1",
          name: "Test User",
          dateOfBirth: "1990-01-15",
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some((i) => i.message.includes("uppercase"))).toBe(true);
        }
      });

      it("rejects password without lowercase", () => {
        const result = patientRegisterSchema.safeParse({
          email: "test@example.com",
          password: "PASSWORD1",
          name: "Test User",
          dateOfBirth: "1990-01-15",
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some((i) => i.message.includes("lowercase"))).toBe(true);
        }
      });

      it("rejects password without number", () => {
        const result = patientRegisterSchema.safeParse({
          email: "test@example.com",
          password: "Passwordd",
          name: "Test User",
          dateOfBirth: "1990-01-15",
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some((i) => i.message.includes("number"))).toBe(true);
        }
      });

      it("rejects password shorter than 8 characters", () => {
        const result = patientRegisterSchema.safeParse({
          email: "test@example.com",
          password: "Pass1",
          name: "Test User",
          dateOfBirth: "1990-01-15",
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some((i) => i.message.includes("8 characters"))).toBe(true);
        }
      });
    });

    describe("dateOfBirth validation", () => {
      it("accepts valid date of birth", () => {
        const result = patientRegisterSchema.safeParse({
          email: "test@example.com",
          password: "Password1",
          name: "Test User",
          dateOfBirth: "1990-01-15",
        });
        expect(result.success).toBe(true);
      });

      it("rejects future date of birth", () => {
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);
        const result = patientRegisterSchema.safeParse({
          email: "test@example.com",
          password: "Password1",
          name: "Test User",
          dateOfBirth: futureDate.toISOString().split("T")[0],
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some((i) => i.message.includes("future"))).toBe(true);
        }
      });

      it("rejects age over 120 years", () => {
        const result = patientRegisterSchema.safeParse({
          email: "test@example.com",
          password: "Password1",
          name: "Test User",
          dateOfBirth: "1880-01-15",
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some((i) => i.message.includes("120"))).toBe(true);
        }
      });

      it("rejects invalid date format", () => {
        const result = patientRegisterSchema.safeParse({
          email: "test@example.com",
          password: "Password1",
          name: "Test User",
          dateOfBirth: "not-a-date",
        });
        expect(result.success).toBe(false);
      });
    });

    describe("email validation", () => {
      it("accepts valid email", () => {
        const result = patientRegisterSchema.safeParse({
          email: "test@example.com",
          password: "Password1",
          name: "Test User",
          dateOfBirth: "1990-01-15",
        });
        expect(result.success).toBe(true);
      });

      it("rejects invalid email", () => {
        const result = patientRegisterSchema.safeParse({
          email: "not-an-email",
          password: "Password1",
          name: "Test User",
          dateOfBirth: "1990-01-15",
        });
        expect(result.success).toBe(false);
      });
    });

    describe("name validation", () => {
      it("accepts valid name", () => {
        const result = patientRegisterSchema.safeParse({
          email: "test@example.com",
          password: "Password1",
          name: "Test User",
          dateOfBirth: "1990-01-15",
        });
        expect(result.success).toBe(true);
      });

      it("rejects empty name", () => {
        const result = patientRegisterSchema.safeParse({
          email: "test@example.com",
          password: "Password1",
          name: "",
          dateOfBirth: "1990-01-15",
        });
        expect(result.success).toBe(false);
      });

      it("rejects name over 100 characters", () => {
        const result = patientRegisterSchema.safeParse({
          email: "test@example.com",
          password: "Password1",
          name: "A".repeat(101),
          dateOfBirth: "1990-01-15",
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some((i) => i.message.includes("too long"))).toBe(true);
        }
      });
    });
  });

  describe("loginSchema", () => {
    it("accepts valid login credentials", () => {
      const result = loginSchema.safeParse({
        email: "test@example.com",
        password: "anypassword",
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing email", () => {
      const result = loginSchema.safeParse({
        password: "anypassword",
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty password", () => {
      const result = loginSchema.safeParse({
        email: "test@example.com",
        password: "",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("measurementSchema", () => {
    describe("WEIGHT measurements", () => {
      it("accepts valid weight in kg", () => {
        const result = measurementSchema.safeParse({
          type: "WEIGHT",
          value: 70,
          unit: "kg",
        });
        expect(result.success).toBe(true);
      });

      it("accepts valid weight in lbs", () => {
        const result = measurementSchema.safeParse({
          type: "WEIGHT",
          value: 150,
          unit: "lbs",
        });
        expect(result.success).toBe(true);
      });

      it("rejects weight below minimum (20 kg)", () => {
        const result = measurementSchema.safeParse({
          type: "WEIGHT",
          value: 10,
          unit: "kg",
        });
        expect(result.success).toBe(false);
      });

      it("rejects weight above maximum (500 kg)", () => {
        const result = measurementSchema.safeParse({
          type: "WEIGHT",
          value: 600,
          unit: "kg",
        });
        expect(result.success).toBe(false);
      });

      it("validates weight in lbs converted to kg range", () => {
        // 50 lbs = ~22.7 kg - should be valid
        const validResult = measurementSchema.safeParse({
          type: "WEIGHT",
          value: 50,
          unit: "lbs",
        });
        expect(validResult.success).toBe(true);

        // 30 lbs = ~13.6 kg - below 20 kg minimum
        const invalidResult = measurementSchema.safeParse({
          type: "WEIGHT",
          value: 30,
          unit: "lbs",
        });
        expect(invalidResult.success).toBe(false);
      });
    });

    describe("BP measurements", () => {
      it("accepts valid BP_SYSTOLIC", () => {
        const result = measurementSchema.safeParse({
          type: "BP_SYSTOLIC",
          value: 120,
          unit: "mmHg",
        });
        expect(result.success).toBe(true);
      });

      it("accepts valid BP_DIASTOLIC", () => {
        const result = measurementSchema.safeParse({
          type: "BP_DIASTOLIC",
          value: 80,
          unit: "mmHg",
        });
        expect(result.success).toBe(true);
      });

      it("rejects BP_SYSTOLIC below minimum (40)", () => {
        const result = measurementSchema.safeParse({
          type: "BP_SYSTOLIC",
          value: 30,
          unit: "mmHg",
        });
        expect(result.success).toBe(false);
      });

      it("rejects BP_SYSTOLIC above maximum (300)", () => {
        const result = measurementSchema.safeParse({
          type: "BP_SYSTOLIC",
          value: 350,
          unit: "mmHg",
        });
        expect(result.success).toBe(false);
      });
    });

    describe("SPO2 measurements", () => {
      it("accepts valid SpO2", () => {
        const result = measurementSchema.safeParse({
          type: "SPO2",
          value: 98,
          unit: "%",
        });
        expect(result.success).toBe(true);
      });

      it("rejects SpO2 below minimum (50)", () => {
        const result = measurementSchema.safeParse({
          type: "SPO2",
          value: 40,
          unit: "%",
        });
        expect(result.success).toBe(false);
      });

      it("rejects SpO2 above maximum (100)", () => {
        const result = measurementSchema.safeParse({
          type: "SPO2",
          value: 105,
          unit: "%",
        });
        expect(result.success).toBe(false);
      });
    });

    describe("HEART_RATE measurements", () => {
      it("accepts valid heart rate", () => {
        const result = measurementSchema.safeParse({
          type: "HEART_RATE",
          value: 72,
          unit: "bpm",
        });
        expect(result.success).toBe(true);
      });

      it("rejects heart rate below minimum (20)", () => {
        const result = measurementSchema.safeParse({
          type: "HEART_RATE",
          value: 10,
          unit: "bpm",
        });
        expect(result.success).toBe(false);
      });

      it("rejects heart rate above maximum (300)", () => {
        const result = measurementSchema.safeParse({
          type: "HEART_RATE",
          value: 350,
          unit: "bpm",
        });
        expect(result.success).toBe(false);
      });
    });

    it("rejects negative values", () => {
      const result = measurementSchema.safeParse({
        type: "WEIGHT",
        value: -10,
        unit: "kg",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid measurement type", () => {
      const result = measurementSchema.safeParse({
        type: "INVALID_TYPE",
        value: 100,
        unit: "kg",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("bloodPressureSchema", () => {
    it("accepts valid blood pressure", () => {
      const result = bloodPressureSchema.safeParse({
        systolic: 120,
        diastolic: 80,
      });
      expect(result.success).toBe(true);
    });

    it("accepts blood pressure with timestamp", () => {
      const result = bloodPressureSchema.safeParse({
        systolic: 120,
        diastolic: 80,
        timestamp: "2024-01-15T10:30:00Z",
      });
      expect(result.success).toBe(true);
    });

    it("rejects systolic below 40", () => {
      const result = bloodPressureSchema.safeParse({
        systolic: 30,
        diastolic: 80,
      });
      expect(result.success).toBe(false);
    });

    it("rejects systolic above 300", () => {
      const result = bloodPressureSchema.safeParse({
        systolic: 350,
        diastolic: 80,
      });
      expect(result.success).toBe(false);
    });

    it("rejects diastolic below 20", () => {
      const result = bloodPressureSchema.safeParse({
        systolic: 120,
        diastolic: 15,
      });
      expect(result.success).toBe(false);
    });

    it("rejects diastolic above 200", () => {
      const result = bloodPressureSchema.safeParse({
        systolic: 120,
        diastolic: 250,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("symptomCheckinSchema", () => {
    it("accepts valid symptom checkin with all fields", () => {
      const result = symptomCheckinSchema.safeParse({
        symptoms: {
          edema: { severity: 2, location: "ankles" },
          fatigue: { severity: 1 },
          shortnessOfBreath: { severity: 0, atRest: false },
          nausea: { severity: 0 },
          appetite: { level: 2 },
          pain: { severity: 1, location: "lower back" },
        },
        notes: "Feeling a bit tired today",
      });
      expect(result.success).toBe(true);
    });

    it("accepts minimal symptom checkin", () => {
      const result = symptomCheckinSchema.safeParse({
        symptoms: {},
      });
      expect(result.success).toBe(true);
    });

    it("rejects severity outside 0-3 range", () => {
      const result = symptomCheckinSchema.safeParse({
        symptoms: {
          fatigue: { severity: 5 },
        },
      });
      expect(result.success).toBe(false);
    });

    it("rejects appetite level outside 0-3 range", () => {
      const result = symptomCheckinSchema.safeParse({
        symptoms: {
          appetite: { level: -1 },
        },
      });
      expect(result.success).toBe(false);
    });
  });
});
