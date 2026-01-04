import pinoHttp from "pino-http";
import { Request } from "express";
import { logger } from "../lib/logger.js";
import { config } from "../lib/config.js";

/**
 * HTTP request/response logging middleware
 *
 * Logs all HTTP requests with:
 * - Request ID (correlation)
 * - Method, URL, status code
 * - Response time
 * - User info (if authenticated)
 */
export const httpLogger = pinoHttp({
  logger,
  // Use existing request ID from requestIdMiddleware
  genReqId: (req) => (req as Request).requestId ?? crypto.randomUUID(),
  // Custom log level based on status code
  customLogLevel: (_req, res, error) => {
    if (error || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  // Don't log health checks in production (noisy)
  autoLogging: {
    ignore: (req) => {
      if (config.isProduction && req.url === "/health") {
        return true;
      }
      return false;
    },
  },
  // Custom serializers
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      // Include user info if available
      ...(req.raw?.user && {
        userId: req.raw.user.sub,
        userRole: req.raw.user.role,
      }),
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
    // Don't log error stack in response (handled by error handler)
    err: (err) => ({
      type: err.constructor.name,
      message: err.message,
    }),
  },
  // Custom success message
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  // Custom error message
  customErrorMessage: (req, res, error) => {
    return `${req.method} ${req.url} ${res.statusCode} - ${error.message}`;
  },
});
