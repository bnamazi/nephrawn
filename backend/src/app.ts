import express from "express";
import cors from "cors";
import { config } from "./lib/config.js";
import { prisma } from "./lib/prisma.js";
import { requestIdMiddleware } from "./middleware/requestId.middleware.js";
import { httpLogger } from "./middleware/httpLogger.middleware.js";
import {
  authRateLimiter,
  apiRateLimiter,
} from "./middleware/rateLimit.middleware.js";
import {
  errorHandler,
  notFoundHandler,
} from "./middleware/errorHandler.middleware.js";
import authRoutes from "./routes/auth.routes.js";
import clinicianRoutes from "./routes/clinician.routes.js";
import patientRoutes from "./routes/patient.routes.js";
import inviteRoutes from "./routes/invite.routes.js";
import clinicRoutes from "./routes/clinic.routes.js";
import filesRoutes from "./routes/files.routes.js";

export function createApp(options: { skipRateLimiting?: boolean; skipHttpLogging?: boolean } = {}) {
  const app = express();

  // Request ID middleware (first, for log correlation)
  app.use(requestIdMiddleware);

  // HTTP request/response logging (after request ID, before other middleware)
  if (!options.skipHttpLogging) {
    app.use(httpLogger);
  }

  // Middleware
  app.use(
    cors({
      origin: config.cors.origins,
      credentials: true,
    })
  );
  app.use(express.json());

  // General rate limiting for all API routes (skip in tests)
  if (!options.skipRateLimiting) {
    app.use(apiRateLimiter);
  }

  // Health check (not rate limited, includes request ID)
  // Supports ?deep=true for database connectivity check
  app.get("/health", async (req, res) => {
    const deep = req.query.deep === "true";
    const startTime = Date.now();

    const health: {
      status: "ok" | "degraded" | "error";
      timestamp: string;
      requestId: string | undefined;
      version: string;
      uptime: number;
      database?: { status: "connected" | "error"; latencyMs?: number; error?: string };
    } = {
      status: "ok",
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
      version: process.env.npm_package_version || "unknown",
      uptime: process.uptime(),
    };

    // Deep health check includes database connectivity
    if (deep) {
      try {
        const dbStart = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        health.database = {
          status: "connected",
          latencyMs: Date.now() - dbStart,
        };
      } catch (error) {
        health.status = "degraded";
        health.database = {
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }

    const statusCode = health.status === "ok" ? 200 : 503;
    res.status(statusCode).json(health);
  });

  // Routes with auth-specific rate limiting
  if (!options.skipRateLimiting) {
    app.use("/auth", authRateLimiter, authRoutes);
  } else {
    app.use("/auth", authRoutes);
  }
  app.use("/clinician", clinicianRoutes);
  app.use("/patient", patientRoutes);

  // Invite routes (includes both /clinician/* and /auth/* endpoints)
  app.use(inviteRoutes);

  // Clinic management routes (includes /admin/* and /clinician/clinic/* endpoints)
  app.use(clinicRoutes);

  // File serving routes for local dev (document uploads/downloads)
  app.use("/files", filesRoutes);

  // 404 handler
  app.use(notFoundHandler);

  // Central error handler (must be last)
  app.use(errorHandler);

  return app;
}

// Default export for convenience
export const app = createApp();
