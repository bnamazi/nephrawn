import { describe, it, expect } from "vitest";
import {
  toCanonical,
  fromCanonical,
  isValidUnit,
  getAcceptedUnits,
  CANONICAL_UNITS,
  ALERT_THRESHOLDS,
} from "./units.js";

describe("units", () => {
  describe("toCanonical", () => {
    describe("WEIGHT conversions", () => {
      it("converts lbs to kg correctly", () => {
        const result = toCanonical("WEIGHT", 100, "lbs");
        expect(result).not.toBeNull();
        expect(result!.value).toBeCloseTo(45.3592, 2);
        expect(result!.canonicalUnit).toBe("kg");
      });

      it("converts lb (singular) to kg", () => {
        const result = toCanonical("WEIGHT", 100, "lb");
        expect(result).not.toBeNull();
        expect(result!.value).toBeCloseTo(45.3592, 2);
      });

      it("converts pounds to kg", () => {
        const result = toCanonical("WEIGHT", 100, "pounds");
        expect(result).not.toBeNull();
        expect(result!.value).toBeCloseTo(45.3592, 2);
      });

      it("keeps kg as kg (identity conversion)", () => {
        const result = toCanonical("WEIGHT", 70, "kg");
        expect(result).not.toBeNull();
        expect(result!.value).toBe(70);
        expect(result!.canonicalUnit).toBe("kg");
      });

      it("returns null for unsupported unit", () => {
        const result = toCanonical("WEIGHT", 100, "stones");
        expect(result).toBeNull();
      });
    });

    describe("BP conversions", () => {
      it("converts BP_SYSTOLIC in mmHg (identity)", () => {
        const result = toCanonical("BP_SYSTOLIC", 120, "mmHg");
        expect(result).not.toBeNull();
        expect(result!.value).toBe(120);
        expect(result!.canonicalUnit).toBe("mmHg");
      });

      it("handles case-insensitive mmhg", () => {
        const result = toCanonical("BP_SYSTOLIC", 120, "mmhg");
        expect(result).not.toBeNull();
        expect(result!.value).toBe(120);
      });

      it("converts BP_DIASTOLIC in mmHg", () => {
        const result = toCanonical("BP_DIASTOLIC", 80, "mmHg");
        expect(result).not.toBeNull();
        expect(result!.value).toBe(80);
      });
    });

    describe("SPO2 conversions", () => {
      it("converts SpO2 percent", () => {
        const result = toCanonical("SPO2", 98, "%");
        expect(result).not.toBeNull();
        expect(result!.value).toBe(98);
        expect(result!.canonicalUnit).toBe("%");
      });

      it("converts SpO2 with percent word", () => {
        const result = toCanonical("SPO2", 95, "percent");
        expect(result).not.toBeNull();
        expect(result!.value).toBe(95);
      });
    });

    describe("HEART_RATE conversions", () => {
      it("converts bpm", () => {
        const result = toCanonical("HEART_RATE", 72, "bpm");
        expect(result).not.toBeNull();
        expect(result!.value).toBe(72);
        expect(result!.canonicalUnit).toBe("bpm");
      });

      it("converts beats/min", () => {
        const result = toCanonical("HEART_RATE", 80, "beats/min");
        expect(result).not.toBeNull();
        expect(result!.value).toBe(80);
      });
    });
  });

  describe("fromCanonical", () => {
    it("converts kg to lbs for display", () => {
      const result = fromCanonical("WEIGHT", 45.3592, "lbs");
      expect(result).toBeCloseTo(100, 0);
    });

    it("keeps kg as kg", () => {
      const result = fromCanonical("WEIGHT", 70, "kg");
      expect(result).toBe(70);
    });

    it("returns original value for unknown display unit", () => {
      const result = fromCanonical("WEIGHT", 70, "stones");
      expect(result).toBe(70);
    });

    it("converts BP (identity)", () => {
      const result = fromCanonical("BP_SYSTOLIC", 120, "mmHg");
      expect(result).toBe(120);
    });
  });

  describe("isValidUnit", () => {
    it("returns true for valid weight units", () => {
      expect(isValidUnit("WEIGHT", "kg")).toBe(true);
      expect(isValidUnit("WEIGHT", "lbs")).toBe(true);
      expect(isValidUnit("WEIGHT", "lb")).toBe(true);
      expect(isValidUnit("WEIGHT", "pounds")).toBe(true);
    });

    it("returns false for invalid weight units", () => {
      expect(isValidUnit("WEIGHT", "stones")).toBe(false);
      expect(isValidUnit("WEIGHT", "ounces")).toBe(false);
    });

    it("returns true for valid BP units", () => {
      expect(isValidUnit("BP_SYSTOLIC", "mmHg")).toBe(true);
      expect(isValidUnit("BP_DIASTOLIC", "mmhg")).toBe(true);
    });

    it("returns true for valid SpO2 units", () => {
      expect(isValidUnit("SPO2", "%")).toBe(true);
      expect(isValidUnit("SPO2", "percent")).toBe(true);
    });

    it("returns true for valid heart rate units", () => {
      expect(isValidUnit("HEART_RATE", "bpm")).toBe(true);
      expect(isValidUnit("HEART_RATE", "beats/min")).toBe(true);
    });
  });

  describe("getAcceptedUnits", () => {
    it("returns accepted units for WEIGHT", () => {
      const units = getAcceptedUnits("WEIGHT");
      expect(units).toContain("kg");
      expect(units).toContain("lbs");
      expect(units).toContain("lb");
      expect(units).toContain("pounds");
    });

    it("returns accepted units for BP_SYSTOLIC", () => {
      const units = getAcceptedUnits("BP_SYSTOLIC");
      expect(units).toContain("mmHg");
    });

    it("returns empty array for unknown type", () => {
      // @ts-expect-error - testing invalid input
      const units = getAcceptedUnits("UNKNOWN");
      expect(units).toEqual([]);
    });
  });

  describe("CANONICAL_UNITS", () => {
    it("has correct canonical units defined", () => {
      expect(CANONICAL_UNITS.WEIGHT).toBe("kg");
      expect(CANONICAL_UNITS.BP_SYSTOLIC).toBe("mmHg");
      expect(CANONICAL_UNITS.BP_DIASTOLIC).toBe("mmHg");
      expect(CANONICAL_UNITS.SPO2).toBe("%");
      expect(CANONICAL_UNITS.HEART_RATE).toBe("bpm");
    });
  });

  describe("ALERT_THRESHOLDS", () => {
    it("has clinically appropriate weight thresholds", () => {
      // ~3 lbs in 48h is concerning
      expect(ALERT_THRESHOLDS.WEIGHT_GAIN_48H).toBeCloseTo(1.36, 1);
      // ~5 lbs is critical
      expect(ALERT_THRESHOLDS.WEIGHT_GAIN_48H_CRITICAL).toBeCloseTo(2.27, 1);
    });

    it("has appropriate BP thresholds", () => {
      expect(ALERT_THRESHOLDS.BP_SYSTOLIC_HIGH).toBe(180);
      expect(ALERT_THRESHOLDS.BP_SYSTOLIC_CRITICAL).toBe(200);
      expect(ALERT_THRESHOLDS.BP_SYSTOLIC_LOW).toBe(90);
    });

    it("has appropriate SpO2 thresholds", () => {
      expect(ALERT_THRESHOLDS.SPO2_LOW).toBe(92);
      expect(ALERT_THRESHOLDS.SPO2_CRITICAL).toBe(88);
    });
  });
});
