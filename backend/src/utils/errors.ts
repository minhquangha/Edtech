export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errors?: Array<{ field?: string; message: string }> | undefined;

  constructor(
    message: string,
    statusCode = 500,
    errors?: Array<{ field?: string; message: string }> | undefined,
    isOperational = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad Request", errors?: Array<{ field?: string; message: string }> | undefined) {
    super(message, 400, errors);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404);
  }
}

export class InternalServerError extends AppError {
  constructor(message = "Internal Server Error") {
    super(message, 500);
  }
}
