import type { Request, Response } from "express";
import { asyncHandler } from "@/lib/asyncHandler.js";
import { UnauthorizedError } from "@/lib/errors.js";
import * as uploadsService from "./uploads.service.js";

export const presign = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw new UnauthorizedError();
  const result = await uploadsService.presignUpload(req.auth.userId, req.body);
  res.status(200).json(result);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw new UnauthorizedError();
  await uploadsService.deleteAsset(req.auth.userId, req.params.key as string);
  res.status(204).send();
});
