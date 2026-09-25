import type { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "@/utils/errors.js";

export const errorHandler: ErrorRequestHandler = (
  err: Error | AppError | ZodError | unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // 1. AppError (operational business errors)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.errors && err.errors.length > 0 ? { errors: err.errors } : {}),
    });
    return;
  }

  // 2. Zod validation error
  if (err instanceof ZodError) {
    const formattedIssues = err.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));

    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: formattedIssues,
    });
    return;
  }

  // 3. Express JSON parse error (e.g. malformed body)
  if (err instanceof SyntaxError && "status" in err && err.status === 400 && "body" in err) {
    res.status(400).json({
      success: false,
      message: "Malformed JSON payload",
    });
    return;
  }

  // 4. Log unexpected server errors
  console.error("[Unhandled Error]:", err);

  // 5. Internal Server Error fallback
  const isProd = process.env.NODE_ENV === "production";
  const message = isProd
    ? "Internal server error"
    : err instanceof Error
    ? err.message
    : "Internal server error";

  res.status(500).json({
    success: false,
    message,
  });
};

export default errorHandler;
