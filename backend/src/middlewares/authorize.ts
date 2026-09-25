import type { Request, Response, NextFunction } from "express";
import { UnauthorizedError, ForbiddenError } from "@/utils/errors.js";

/**
 * Middleware factory to enforce Role-Based Access Control (RBAC).
 * Requires authenticate middleware to have run beforehand.
 */
export const requireRoles = (...allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required");
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError(
        `Access denied. Allowed role(s): ${allowedRoles.join(", ")}`
      );
    }

    next();
  };
};

export const requireTeacher = requireRoles("TEACHER");

export default requireRoles;
