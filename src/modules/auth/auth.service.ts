import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import type { Role, User } from "@prisma/client";
import { env } from "@/config/env.js";
import { hashPassword, verifyPassword } from "@/lib/password.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "@/lib/jwt.js";
import { ConflictError, UnauthorizedError } from "@/lib/errors.js";
import { eventBus, DomainEvents } from "@/lib/eventBus.js";
import { logger } from "@/lib/logger.js";
import * as authRepo from "./auth.repository.js";

function toPublicUser(user: User) {
  // Prisma returns the enum identifier ("CUSTOMER"); the frontend `User.role`
  // contract is the lowercase string ("customer") — see lib/enumLabels.ts
  // for why this needs an explicit conversion rather than relying on @map.
  return { id: user.id, name: user.name, email: user.email, role: user.role.toLowerCase(), avatarUrl: user.avatarUrl ?? undefined };
}

function issueSessionTokens(user: User) {
  const accessToken = signAccessToken({ sub: user.id, role: user.role, email: user.email });
  const refreshToken = signRefreshToken({ sub: user.id, jti: crypto.randomUUID() });
  return { accessToken, refreshToken };
}

async function persistRefreshToken(userId: string, refreshToken: string) {
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  await authRepo.storeRefreshToken(userId, refreshToken, expiresAt);
}

export async function signup(input: { fullName: string; email: string; password: string }) {
  const existing = await authRepo.findUserByEmail(input.email);
  if (existing) throw new ConflictError("An account with this email already exists");

  const passwordHash = await hashPassword(input.password);
  const user = await authRepo.createUser({ name: input.fullName, email: input.email, passwordHash, role: "CUSTOMER" });

  eventBus.publish(DomainEvents.UserRegistered, { userId: user.id, role: user.role });

  const tokens = issueSessionTokens(user);
  await persistRefreshToken(user.id, tokens.refreshToken);
  return { user: toPublicUser(user), ...tokens };
}

/**
 * Generic credential login, scoped to an expected role so /login,
 * /retailer/login and /admin/login each only accept accounts of their own
 * kind — a retailer account can't sign in through the customer form, etc.
 */
export async function login(input: { email: string; password: string }, expectedRole: Role) {
  const user = await authRepo.findUserByEmail(input.email);
  if (!user) throw new UnauthorizedError("Invalid email or password");

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) throw new UnauthorizedError("Invalid email or password");

  if (user.role !== expectedRole) {
    throw new UnauthorizedError(`No ${expectedRole.toLowerCase()} account found for this email`);
  }

  if (expectedRole === "ADMIN" && user.mfaEnabled) {
    const mfaToken = jwt.sign({ sub: user.id, purpose: "mfa_pending" }, env.JWT_ACCESS_SECRET, { expiresIn: "5m" });
    return { mfaRequired: true as const, mfaToken };
  }

  const tokens = issueSessionTokens(user);
  await persistRefreshToken(user.id, tokens.refreshToken);
  return { mfaRequired: false as const, user: toPublicUser(user), ...tokens };
}

export async function verifyAdminMfa(input: { mfaToken: string; code: string }) {
  let payload: { sub: string; purpose: string };
  try {
    payload = jwt.verify(input.mfaToken, env.JWT_ACCESS_SECRET) as typeof payload;
  } catch {
    throw new UnauthorizedError("MFA session expired — please log in again");
  }
  if (payload.purpose !== "mfa_pending") throw new UnauthorizedError("Invalid MFA session");

  const user = await authRepo.findUserById(payload.sub);
  if (!user || !user.mfaSecret) throw new UnauthorizedError("Invalid MFA session");

  const valid = authenticator.check(input.code, user.mfaSecret);
  if (!valid) throw new UnauthorizedError("Invalid authentication code");

  const tokens = issueSessionTokens(user);
  await persistRefreshToken(user.id, tokens.refreshToken);
  return { user: toPublicUser(user), ...tokens };
}

/** One-time TOTP enrollment for an admin account — returns an otpauth:// QR code to scan in an authenticator app. */
export async function setupAdminMfa(userId: string) {
  const user = await authRepo.findUserById(userId);
  if (!user) throw new UnauthorizedError();
  const secret = authenticator.generateSecret();
  await authRepo.setMfaSecret(userId, secret);
  const otpauthUrl = authenticator.keyuri(user.email, "Ilkal Threads Admin", secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
  return { secret, otpauthUrl, qrCodeDataUrl };
}

export async function confirmAdminMfa(userId: string, code: string) {
  const user = await authRepo.findUserById(userId);
  if (!user?.mfaSecret) throw new ConflictError("Run MFA setup first");
  const valid = authenticator.check(code, user.mfaSecret);
  if (!valid) throw new UnauthorizedError("Invalid authentication code");
  await authRepo.enableMfa(userId);
}

export async function refreshSession(refreshToken: string) {
  let payload: { sub: string; jti: string };
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new UnauthorizedError("Session expired — please log in again");
  }

  const stored = await authRepo.findValidRefreshToken(refreshToken);
  if (!stored) throw new UnauthorizedError("Session expired — please log in again");

  const user = await authRepo.findUserById(payload.sub);
  if (!user) throw new UnauthorizedError("Session expired — please log in again");

  // Rotate: revoke the presented token, issue a fresh pair. Limits the blast
  // radius of a leaked refresh token to a single use.
  await authRepo.revokeRefreshToken(refreshToken);
  const tokens = issueSessionTokens(user);
  await persistRefreshToken(user.id, tokens.refreshToken);
  return { user: toPublicUser(user), ...tokens };
}

export async function logout(refreshToken: string | undefined) {
  if (refreshToken) await authRepo.revokeRefreshToken(refreshToken).catch((err) => logger.warn({ err }, "revoke on logout failed"));
}

export async function forgotPassword(email: string) {
  const user = await authRepo.findUserByEmail(email);
  // Always resolve — don't leak whether an email is registered.
  if (!user) return;

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await authRepo.createPasswordResetToken(user.id, token, expiresAt);

  // No transactional email provider wired up yet — log the reset link so
  // this is exercisable end-to-end in dev. Swap for a real mailer (SES, in
  // keeping with the AWS stack already in use) before shipping.
  logger.info({ email: user.email, resetToken: token }, "Password reset requested — token logged (no email provider configured)");
}

export async function resetPassword(token: string, newPassword: string) {
  const record = await authRepo.findValidPasswordResetToken(token);
  if (!record) throw new UnauthorizedError("This reset link is invalid or has expired");

  const passwordHash = await hashPassword(newPassword);
  await authRepo.updatePasswordHash(record.userId, passwordHash);
  await authRepo.markPasswordResetTokenUsed(record.id);
  await authRepo.revokeAllRefreshTokensForUser(record.userId);
}

/** Issues a fresh session for an already-authenticated-by-other-means user (e.g. right after retailer registration creates the account). */
export async function createSessionForUserId(userId: string) {
  const user = await authRepo.findUserById(userId);
  if (!user) throw new UnauthorizedError("Account not found");
  const tokens = issueSessionTokens(user);
  await persistRefreshToken(user.id, tokens.refreshToken);
  return { user: toPublicUser(user), ...tokens };
}

export async function getUserName(userId: string): Promise<string> {
  const user = await authRepo.findUserById(userId);
  return user?.name ?? "Anonymous";
}

export { toPublicUser };
