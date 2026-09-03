import type { Request, Response, NextFunction } from "express";
import { ZodError, type ZodSchema } from "zod";
import { pdfImportFormSchema } from "@/schemas/index.js";

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function formatZodErrors(error: ZodError) {
  return error.issues.map((err) => ({
    field: err.path.join("."),
    message: err.message,
  }));
}

/**
 * Middleware factory for validating req.body against a Zod schema
 */
export const validateBody = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: "Validation failed",
          errors: formatZodErrors(error),
        });
      }
      return res.status(400).json({
        message: "Invalid request payload",
      });
    }
  };
};

/**
 * Middleware factory for validating req.query against a Zod schema
 */
export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req.query);
      Object.defineProperty(req, "query", {
        value: parsed,
        writable: true,
        configurable: true,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: "Invalid query parameters",
          errors: formatZodErrors(error),
        });
      }
      return res.status(400).json({
        message: "Invalid query parameters",
      });
    }
  };
};

/**
 * Middleware factory for validating req.params against a Zod schema
 */
export const validateParams = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req.params);
      Object.defineProperty(req, "params", {
        value: parsed,
        writable: true,
        configurable: true,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: "Invalid route parameters",
          errors: formatZodErrors(error),
        });
      }
      return res.status(400).json({
        message: "Invalid route parameters",
      });
    }
  };
};

/**
 * Specialized middleware for validating PDF files and form body for POST /api/pdf/import
 */
export const validatePdfUpload = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const files = req.files as Express.Multer.File[] | undefined;

  // 1. Check if files exist
  if (!files || files.length === 0) {
    return res.status(400).json({
      message: "Vui lòng tải lên ít nhất 1 file PDF",
    });
  }

  // 2. Check maximum file count limit
  if (files.length > MAX_FILES) {
    return res.status(400).json({
      message: `Chỉ được tải lên tối đa ${MAX_FILES} file PDF`,
    });
  }

  // 3. Inspect each file (empty file, file size, MIME type, magic bytes)
  for (const file of files) {
    if (!file.buffer || file.buffer.length === 0) {
      return res.status(400).json({
        message: `File "${file.originalname}" rỗng (0 bytes)`,
      });
    }

    if (file.size > MAX_FILE_SIZE) {
      return res.status(400).json({
        message: `File "${file.originalname}" vượt quá giới hạn 10MB`,
      });
    }

    if (file.mimetype !== "application/pdf") {
      return res.status(400).json({
        message: `File "${file.originalname}" không phải là PDF`,
      });
    }

    // Verify PDF Magic Bytes (%PDF-)
    const header = file.buffer.subarray(0, 4).toString("utf-8");
    if (header !== "%PDF") {
      return res.status(400).json({
        message: `File "${file.originalname}" không phải là PDF hợp lệ (Invalid file signature)`,
      });
    }
  }

  // 4. Validate body text fields if present
  try {
    if (req.body) {
      req.body = pdfImportFormSchema.parse(req.body);
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        message: "Validation failed for form fields",
        errors: formatZodErrors(error),
      });
    }
    return res.status(400).json({
      message: "Invalid form fields",
    });
  }

  next();
};
