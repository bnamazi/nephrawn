import { Request, Response, NextFunction } from "express";
import * as z from "zod";
import { Prisma } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";

interface ErrorResponse {
  error: string;
  message: string;
  requestId?: string;
  details?: unknown;
  stack?: string;
}

/**
 * Central error handler middleware.
 * Categorizes errors and returns appropriate HTTP responses.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.requestId;

  // Log the error with context using structured logger
  logger.error(
    {
      requestId,
      err: {
        name: err.name,
        message: err.message,
        stack: err.stack,
      },
      path: req.path,
      method: req.method,
      userId: (req as any).user?.sub,
    },
    `Error handling request: ${err.message}`
  );

  // Build error response
  const response: ErrorResponse = {
    error: "Error",
    message: "An unexpected error occurred",
    requestId,
  };

  let statusCode = 500;

  // Handle our custom AppError
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    response.error = getErrorName(statusCode);
    response.message = err.message;
    if (err.details) {
      response.details = err.details;
    }
  }
  // Handle Zod validation errors (Zod 4.x)
  else if (err instanceof z.ZodError) {
    statusCode = 400;
    response.error = "Validation Error";
    response.message = "Invalid request data";
    // Zod 4 uses .issues instead of .errors
    response.details = err.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
  }
  // Handle Prisma errors
  else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const prismaError = handlePrismaError(err);
    statusCode = prismaError.statusCode;
    response.error = prismaError.error;
    response.message = prismaError.message;
  }
  // Handle Prisma validation errors
  else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    response.error = "Validation Error";
    response.message = "Invalid data format";
  }
  // Handle JSON parse errors
  else if (err instanceof SyntaxError && "body" in err) {
    statusCode = 400;
    response.error = "Bad Request";
    response.message = "Invalid JSON in request body";
  }
  // Generic error - don't expose internal details in production
  else {
    response.message = config.isProduction
      ? "An unexpected error occurred"
      : err.message;
  }

  // Include stack trace in development only
  if (!config.isProduction && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

function getErrorName(statusCode: number): string {
  const names: Record<number, string> = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    409: "Conflict",
    422: "Unprocessable Entity",
    429: "Too Many Requests",
    500: "Internal Server Error",
  };
  return names[statusCode] || "Error";
}

function handlePrismaError(
  err: Prisma.PrismaClientKnownRequestError
): { statusCode: number; error: string; message: string } {
  switch (err.code) {
    case "P2002":
      // Unique constraint violation
      return {
        statusCode: 409,
        error: "Conflict",
        message: "A record with this value already exists",
      };
    case "P2025":
      // Record not found
      return {
        statusCode: 404,
        error: "Not Found",
        message: "The requested record was not found",
      };
    case "P2003":
      // Foreign key constraint violation
      return {
        statusCode: 400,
        error: "Bad Request",
        message: "Referenced record does not exist",
      };
    case "P2014":
      // Required relation violation
      return {
        statusCode: 400,
        error: "Bad Request",
        message: "Required related record is missing",
      };
    default:
      return {
        statusCode: 500,
        error: "Database Error",
        message: "A database error occurred",
      };
  }
}

/**
 * 404 handler for undefined routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  const requestId = req.requestId;
  res.status(404).json({
    error: "Not Found",
    message: `Cannot ${req.method} ${req.path}`,
    requestId,
  });
}
