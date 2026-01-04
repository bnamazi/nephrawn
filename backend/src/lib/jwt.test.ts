import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";

// Mock the config module before importing jwt functions
vi.mock("./config.js", () => ({
  config: {
    jwt: {
      secret: "test-secret-key-for-testing-only",
      expiresIn: "1h",
    },
  },
}));

// Import after mocking
import { signToken, verifyToken, TokenPayload } from "./jwt.js";

describe("jwt", () => {
  const testPayload: TokenPayload = {
    sub: "user-123",
    email: "test@example.com",
    role: "patient",
  };

  describe("signToken", () => {
    it("returns a valid JWT string", () => {
      const token = signToken(testPayload);
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3); // JWT has 3 parts
    });

    it("encodes payload correctly", () => {
      const token = signToken(testPayload);
      const decoded = jwt.decode(token) as TokenPayload & { exp: number; iat: number };

      expect(decoded.sub).toBe(testPayload.sub);
      expect(decoded.email).toBe(testPayload.email);
      expect(decoded.role).toBe(testPayload.role);
    });

    it("includes expiration time", () => {
      const token = signToken(testPayload);
      const decoded = jwt.decode(token) as { exp: number; iat: number };

      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });

    it("creates different tokens for different payloads", () => {
      const token1 = signToken(testPayload);
      const token2 = signToken({ ...testPayload, sub: "user-456" });

      expect(token1).not.toBe(token2);
    });

    it("works with clinician role", () => {
      const clinicianPayload: TokenPayload = {
        sub: "clinician-123",
        email: "doctor@example.com",
        role: "clinician",
      };

      const token = signToken(clinicianPayload);
      const decoded = jwt.decode(token) as TokenPayload;

      expect(decoded.role).toBe("clinician");
    });

    it("works with admin role", () => {
      const adminPayload: TokenPayload = {
        sub: "admin-123",
        email: "admin@example.com",
        role: "admin",
      };

      const token = signToken(adminPayload);
      const decoded = jwt.decode(token) as TokenPayload;

      expect(decoded.role).toBe("admin");
    });
  });

  describe("verifyToken", () => {
    it("verifies and decodes a valid token", () => {
      const token = signToken(testPayload);
      const decoded = verifyToken(token);

      expect(decoded.sub).toBe(testPayload.sub);
      expect(decoded.email).toBe(testPayload.email);
      expect(decoded.role).toBe(testPayload.role);
    });

    it("throws on invalid token", () => {
      expect(() => verifyToken("invalid-token")).toThrow();
    });

    it("throws on tampered token", () => {
      const token = signToken(testPayload);
      // Tamper with the token by modifying a character
      const tamperedToken = token.slice(0, -5) + "xxxxx";

      expect(() => verifyToken(tamperedToken)).toThrow();
    });

    it("throws on token signed with different secret", () => {
      // Create a token with a different secret
      const differentSecretToken = jwt.sign(testPayload, "different-secret", {
        expiresIn: "1h",
      });

      expect(() => verifyToken(differentSecretToken)).toThrow();
    });
  });

  describe("round-trip", () => {
    it("sign and verify preserves all payload fields", () => {
      const payload: TokenPayload = {
        sub: "test-user-id",
        email: "roundtrip@test.com",
        role: "patient",
      };

      const token = signToken(payload);
      const decoded = verifyToken(token);

      expect(decoded.sub).toBe(payload.sub);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
    });
  });
});
