import type { Request, Response } from "express";
import { asyncHandler } from "@/lib/asyncHandler.js";
import { env, isProd } from "@/config/env.js";
import { BadRequestError, UnauthorizedError } from "@/lib/errors.js";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "./auth.constants.js";
import * as authService from "./auth.service.js";
import { findUserById } from "./auth.repository.js";

const baseCookieOpts = { httpOnly: true, secure: isProd, sameSite: "lax" as const, path: "/" };

function setSessionCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
  res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, { ...baseCookieOpts, maxAge: 15 * 60 * 1000 });
  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, { ...baseCookieOpts, maxAge: env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000 });
}

function clearSessionCookies(res: Response) {
  res.clearCookie(ACCESS_TOKEN_COOKIE, baseCookieOpts);
  res.clearCookie(REFRESH_TOKEN_COOKIE, baseCookieOpts);
}

export const signup = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.signup(req.body);
  setSessionCookies(res, result);
  res.status(201).json({ user: result.user });
});

function loginHandler(expectedRole: "CUSTOMER" | "RETAILER" | "ADMIN") {
  return asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.login(req.body, expectedRole);
    if (result.mfaRequired) {
      res.status(200).json({ mfaRequired: true, mfaToken: result.mfaToken });
      return;
    }
    setSessionCookies(res, result);
    res.status(200).json({ user: result.user });
  });
}

export const loginCustomer = loginHandler("CUSTOMER");
export const loginRetailer = loginHandler("RETAILER");
export const loginAdmin = loginHandler("ADMIN");

export const verifyAdminMfa = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.verifyAdminMfa(req.body);
  setSessionCookies(res, result);
  res.status(200).json({ user: result.user });
});

export const setupAdminMfa = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw new UnauthorizedError();
  const result = await authService.setupAdminMfa(req.auth.userId);
  res.status(200).json(result);
});

export const confirmAdminMfa = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw new UnauthorizedError();
  await authService.confirmAdminMfa(req.auth.userId, req.body.code);
  res.status(200).json({ mfaEnabled: true });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
  if (!token) throw new BadRequestError("No session to refresh");
  const result = await authService.refreshSession(token);
  setSessionCookies(res, result);
  res.status(200).json({ user: result.user });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
  await authService.logout(token);
  clearSessionCookies(res);
  res.status(204).send();
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw new UnauthorizedError();
  const user = await findUserById(req.auth.userId);
  if (!user) throw new UnauthorizedError();
  res.status(200).json({ user: authService.toPublicUser(user) });
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.forgotPassword(req.body.email);
  res.status(200).json({ message: "If an account exists for this email, a reset link has been sent." });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.resetPassword(req.body.token, req.body.password);
  res.status(200).json({ message: "Password updated. Please log in again." });
});
