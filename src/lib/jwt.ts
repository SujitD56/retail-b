import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "@/config/env.js";
import type { Role } from "@prisma/client";

export interface AccessTokenPayload {
  sub: string; // user id
  role: Role;
  email: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  // env.JWT_ACCESS_TTL is a validated-at-boot string (e.g. "15m") but typed
  // as plain `string`, not jsonwebtoken's `ms`-flavored template-literal
  // type — the cast is safe because env.ts already validated the format.
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_TTL as SignOptions["expiresIn"] });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string; // maps to a RefreshToken row so it can be revoked/rotated
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: `${env.JWT_REFRESH_TTL_DAYS}d` as SignOptions["expiresIn"] });
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}
