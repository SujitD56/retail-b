import type { Request, Response } from "express";
import { asyncHandler } from "@/lib/asyncHandler.js";
import { NotFoundError, UnauthorizedError } from "@/lib/errors.js";
import { env, isProd } from "@/config/env.js";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/modules/auth/auth.constants.js";
import { createSessionForUserId } from "@/modules/auth/auth.service.js";
import * as service from "./retailers.service.js";

export const list = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json({ items: await service.listApproved() });
});

export const getBySlug = asyncHandler(async (req: Request, res: Response) => {
  const retailer = await service.getBySlug(req.params.slug as string);
  if (!retailer) throw new NotFoundError("Retailer not found");
  res.status(200).json({ retailer });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const retailer = await service.getById(req.params.id as string);
  if (!retailer) throw new NotFoundError("Retailer not found");
  res.status(200).json({ retailer });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw new UnauthorizedError();
  const retailer = await service.getMyProfile(req.auth.userId);
  if (!retailer) throw new NotFoundError("No retailer profile for this account");
  res.status(200).json({ retailer });
});

const baseCookieOpts = { httpOnly: true, secure: isProd, sameSite: "lax" as const, path: "/" };

// Registration logs the new retailer straight in (matches the frontend's
// existing "submitted -> under review" flow, just now backed by a real
// pending account instead of a mock cookie stamp).
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { userId, retailer } = await service.register(req.body);
  const session = await createSessionForUserId(userId);
  res.cookie(ACCESS_TOKEN_COOKIE, session.accessToken, { ...baseCookieOpts, maxAge: 15 * 60 * 1000 });
  res.cookie(REFRESH_TOKEN_COOKIE, session.refreshToken, { ...baseCookieOpts, maxAge: env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000 });
  res.status(201).json({ retailer });
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw new UnauthorizedError();
  const retailer = await service.updateSettings(req.auth.userId, req.body);
  res.status(200).json({ retailer });
});

export const listAdmin = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json(await service.listForAdmin());
});

export const moderate = asyncHandler(async (req: Request, res: Response) => {
  const retailer = await service.moderate(req.params.id as string, req.body.action, req.body.reason);
  res.status(200).json({ retailer });
});
