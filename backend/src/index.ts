import "dotenv/config";
import { app } from "./app.js";
import { config } from "./lib/config.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { startBackgroundJobs, stopBackgroundJobs } from "./jobs/index.js";

/**
 * Startup diagnostics - verify critical dependencies
 */
async function startupDiagnostics(): Promise<boolean> {
  logger.info("Running startup diagnostics...");

  // Check database connectivity
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    logger.info(
      { latencyMs: Date.now() - dbStart },
      "Database connection verified"
    );
  } catch (error) {
    logger.fatal(
      { err: error },
      "Failed to connect to database - server cannot start"
    );
    return false;
  }

  // Log configuration (non-sensitive)
  logger.info(
    {
      port: config.port,
      environment: config.isProduction ? "production" : "development",
      corsOrigins: config.cors.origins,
    },
    "Configuration loaded"
  );

  return true;
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal: string) {
  logger.info({ signal }, "Shutdown signal received, closing connections...");

  // Stop background jobs
  stopBackgroundJobs();

  try {
    await prisma.$disconnect();
    logger.info("Database connection closed");
  } catch (error) {
    logger.error({ err: error }, "Error during database disconnect");
  }

  process.exit(0);
}

// Handle shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "Uncaught exception - shutting down");
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error(
    { reason, promise },
    "Unhandled promise rejection"
  );
});

// Start server
async function main() {
  const diagnosticsOk = await startupDiagnostics();

  if (!diagnosticsOk) {
    process.exit(1);
  }

  app.listen(config.port, () => {
    logger.info(
      { port: config.port, url: `http://localhost:${config.port}` },
      "Server started"
    );

    // Start background jobs after server is ready
    startBackgroundJobs();
  });
}

main().catch((error) => {
  logger.fatal({ err: error }, "Failed to start server");
  process.exit(1);
});
