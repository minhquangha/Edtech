import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UnauthorizedError } from "@/utils/errors.js";

interface JwtPayload {
  id: number;
  username: string;
  role: string;
}

export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedError("Authentication required");
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
      throw new UnauthorizedError("Invalid authorization format. Must be Bearer <token>");
    }

    const token = parts[1];
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET environment variable is missing");
    }

    const decoded = jwt.verify(token, secret) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError("Invalid or expired token"));
      return;
    }
    next(error);
  }
};

export default authenticate;