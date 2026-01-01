import "dotenv/config";

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  jwt: {
    secret: process.env.JWT_SECRET || "dev-secret-change-in-production",
    expiresIn: process.env.JWT_EXPIRES_IN || "1h",
  },
  nodeEnv: process.env.NODE_ENV || "development",
};
