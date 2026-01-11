import "dotenv/config";
import crypto from "crypto";

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    if (isProduction) {
      throw new Error(
        "FATAL: JWT_SECRET environment variable is required in production"
      );
    }
    console.warn(
      "WARNING: JWT_SECRET not set. Using insecure default for development only."
    );
    return "dev-secret-DO-NOT-USE-IN-PRODUCTION";
  }

  if (secret.length < 32) {
    console.warn(
      "WARNING: JWT_SECRET should be at least 32 characters for security"
    );
  }

  return secret;
}

function getCorsOrigins(): string[] {
  const origins = process.env.CORS_ORIGINS;

  if (!origins) {
    if (isProduction) {
      console.warn(
        "WARNING: CORS_ORIGINS not set in production. Defaulting to no origins."
      );
      return [];
    }
    // Development defaults
    return ["http://localhost:3001", "http://127.0.0.1:3001"];
  }

  return origins.split(",").map((origin) => origin.trim());
}

function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    if (isProduction) {
      throw new Error(
        "FATAL: ENCRYPTION_KEY environment variable is required in production"
      );
    }
    // Generate a deterministic dev key for local development
    console.warn(
      "WARNING: ENCRYPTION_KEY not set. Using insecure default for development only."
    );
    return crypto.createHash("sha256").update("dev-encryption-key-DO-NOT-USE").digest("hex");
  }

  return key;
}

function getWithingsMock(): boolean {
  const mock = process.env.WITHINGS_MOCK;
  // Default to true if no credentials are provided
  if (!mock) {
    return !process.env.WITHINGS_CLIENT_ID || !process.env.WITHINGS_CLIENT_SECRET;
  }
  return mock === "true" || mock === "1";
}

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  jwt: {
    secret: getJwtSecret(),
    expiresIn: process.env.JWT_EXPIRES_IN || "1h",
  },
  cors: {
    origins: getCorsOrigins(),
  },
  encryption: {
    key: getEncryptionKey(),
  },
  withings: {
    clientId: process.env.WITHINGS_CLIENT_ID || "",
    clientSecret: process.env.WITHINGS_CLIENT_SECRET || "",
    redirectUri:
      process.env.WITHINGS_REDIRECT_URI ||
      "http://localhost:3000/patient/devices/withings/callback",
    scopes: "user.metrics", // Weight, BP, body composition
    mock: getWithingsMock(),
  },
  nodeEnv,
  isProduction,
};
