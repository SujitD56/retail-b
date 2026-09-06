import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { verifyAccessToken } from "@/lib/jwt.js";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors.js";
import { ACCESS_TOKEN_COOKIE } from "@/modules/auth/auth.constants.js";

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  const cookieToken = req.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined;
  return cookieToken ?? null;
}

/** Populates req.auth if a valid access token is present; never rejects. Use for endpoints with optional personalization (e.g. "have I voted"). */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    req.auth = { userId: payload.sub, role: payload.role, email: payload.email };
  } catch {
    // Ignore invalid/expired token — treat as anonymous rather than erroring.
  }
  next();
}

/** Rejects the request unless a valid access token is present. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return next(new UnauthorizedError("Authentication required"));
  try {
    const payload = verifyAccessToken(token);
    req.auth = { userId: payload.sub, role: payload.role, email: payload.email };
    next();
  } catch {
    next(new UnauthorizedError("Invalid or expired session"));
  }
}

/** Must follow requireAuth. Rejects unless the caller's role is in `roles`. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(new UnauthorizedError("Authentication required"));
    if (!roles.includes(req.auth.role)) return next(new ForbiddenError("You don't have access to this resource"));
    next();
  };
}
