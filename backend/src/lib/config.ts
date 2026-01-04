import "dotenv/config";

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

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  jwt: {
    secret: getJwtSecret(),
    expiresIn: process.env.JWT_EXPIRES_IN || "1h",
  },
  cors: {
    origins: getCorsOrigins(),
  },
  nodeEnv,
  isProduction,
};
