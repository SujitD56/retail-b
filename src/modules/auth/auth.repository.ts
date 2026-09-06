import crypto from "node:crypto";
import { prisma } from "@/lib/prisma.js";
import type { Role } from "@prisma/client";

export function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
}

export function findUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export function createUser(data: { name: string; email: string; passwordHash: string; role: Role }) {
  return prisma.user.create({ data: { ...data, email: data.email.toLowerCase() } });
}

export function updatePasswordHash(userId: string, passwordHash: string) {
  return prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

export function setMfaSecret(userId: string, mfaSecret: string) {
  return prisma.user.update({ where: { id: userId }, data: { mfaSecret } });
}

export function enableMfa(userId: string) {
  return prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
}

// ---------- Refresh tokens (rotation + revocation) ----------

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function storeRefreshToken(userId: string, token: string, expiresAt: Date) {
  return prisma.refreshToken.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
}

export async function findValidRefreshToken(token: string) {
  const tokenHash = hashToken(token);
  return prisma.refreshToken.findFirst({ where: { tokenHash, revoked: false, expiresAt: { gt: new Date() } } });
}

export async function revokeRefreshToken(token: string) {
  const tokenHash = hashToken(token);
  await prisma.refreshToken.updateMany({ where: { tokenHash }, data: { revoked: true } });
}

export async function revokeAllRefreshTokensForUser(userId: string) {
  await prisma.refreshToken.updateMany({ where: { userId, revoked: false }, data: { revoked: true } });
}

// ---------- Password reset ----------

export async function createPasswordResetToken(userId: string, token: string, expiresAt: Date) {
  return prisma.passwordResetToken.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
}

export async function findValidPasswordResetToken(token: string) {
  const tokenHash = hashToken(token);
  return prisma.passwordResetToken.findFirst({ where: { tokenHash, used: false, expiresAt: { gt: new Date() } } });
}

export async function markPasswordResetTokenUsed(id: string) {
  await prisma.passwordResetToken.update({ where: { id }, data: { used: true } });
}
