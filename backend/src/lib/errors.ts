/**
 * Custom error classes for proper HTTP error categorization
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number,
    details?: unknown,
    isOperational = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

// 400 - Bad Request (validation errors, malformed input)
export class BadRequestError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, details);
  }
}

// 401 - Unauthorized (missing or invalid authentication)
export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401);
  }
}

// 403 - Forbidden (authenticated but not allowed)
export class ForbiddenError extends AppError {
  constructor(message = "Access denied") {
    super(message, 403);
  }
}

// 404 - Not Found
export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, 404);
  }
}

// 409 - Conflict (duplicate resource, etc.)
export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 409, details);
  }
}

// 422 - Unprocessable Entity (validation passed but business logic failed)
export class UnprocessableError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 422, details);
  }
}

// 429 - Too Many Requests (rate limiting)
export class TooManyRequestsError extends AppError {
  constructor(message = "Too many requests, please try again later") {
    super(message, 429);
  }
}

// 500 - Internal Server Error
export class InternalError extends AppError {
  constructor(message = "An unexpected error occurred") {
    super(message, 500, undefined, false);
  }
}
