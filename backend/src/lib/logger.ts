import pino from "pino";
import { config } from "./config.js";

/**
 * Structured logger for the Nephrawn backend
 *
 * Uses pino for high-performance JSON logging.
 * In development, logs are pretty-printed for readability.
 * In production, logs are JSON for machine parsing.
 */
export const logger = pino({
  level: config.isProduction ? "info" : "debug",
  // Base fields included in every log
  base: {
    env: config.isProduction ? "production" : "development",
  },
  // Format timestamps as ISO strings
  timestamp: pino.stdTimeFunctions.isoTime,
  // Pretty print in development
  transport: config.isProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      },
  // Redact sensitive fields
  redact: {
    paths: [
      "password",
      "passwordHash",
      "token",
      "authorization",
      "req.headers.authorization",
      "*.password",
      "*.passwordHash",
      "*.token",
    ],
    censor: "[REDACTED]",
  },
});

/**
 * Create a child logger with additional context
 * Useful for request-scoped logging
 */
export function createChildLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}

/**
 * Log levels:
 * - fatal: System is unusable
 * - error: Error conditions
 * - warn: Warning conditions
 * - info: Informational messages (default in production)
 * - debug: Debug messages (default in development)
 * - trace: Very detailed trace logging
 */
export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace";
