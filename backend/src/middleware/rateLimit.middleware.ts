import rateLimit from "express-rate-limit";
import { config } from "../lib/config.js";

// Strict rate limiting for auth endpoints (login, register)
// Prevents brute-force attacks
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.isProduction ? 5 : 100, // 5 attempts in production, 100 in dev
  message: {
    error: "Too many authentication attempts. Please try again in 15 minutes.",
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
  skipFailedRequests: false, // Count failed requests (important for auth)
  keyGenerator: (req) => {
    // Use IP + email (if present) to prevent distributed attacks
    const bodyEmail = req.body?.email;
    const queryEmail = req.query?.email;
    const email =
      (typeof bodyEmail === "string" ? bodyEmail.toLowerCase() : "") ||
      (typeof queryEmail === "string" ? queryEmail.toLowerCase() : "");
    // Use the IP from express
    const ip = req.ip || "unknown";
    return `${ip}-${email}`;
  },
  // Disable validation to avoid IPv6 errors in test environment
  validate: false,
});

// General API rate limiting (less strict)
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: config.isProduction ? 100 : 1000, // 100 requests per minute in prod
  message: {
    error: "Too many requests. Please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
