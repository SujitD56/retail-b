import type { Request, Response } from "express";
import { asyncHandler } from "@/lib/asyncHandler.js";
import { UnauthorizedError } from "@/lib/errors.js";
import * as uploadsService from "./uploads.service.js";

// Uploaded ahead of account creation by the retailer registration wizard,
// so these purposes are allowed without a session. Everything else (product
// images, event banners, avatars, …) is only ever uploaded by an
// already-authenticated user and still requires one.
const PURPOSES_ALLOWED_WITHOUT_AUTH = new Set(["RETAILER_LOGO", "RETAILER_COVER", "RETAILER_DOCUMENT"]);

export const presign = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth && !PURPOSES_ALLOWED_WITHOUT_AUTH.has(req.body?.purpose)) throw new UnauthorizedError();
  const result = await uploadsService.presignUpload(req.auth?.userId, req.body);
  res.status(200).json(result);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw new UnauthorizedError();
  await uploadsService.deleteAsset(req.auth.userId, req.params.key as string);
  res.status(204).send();
});
