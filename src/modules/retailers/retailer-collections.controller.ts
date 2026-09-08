import type { Request, Response } from "express";
import { asyncHandler } from "@/lib/asyncHandler.js";
import { UnauthorizedError } from "@/lib/errors.js";
import { getRetailerIdForUser } from "./retailers.service.js";
import * as service from "./retailer-collections.service.js";

async function requireOwnRetailerId(req: Request) {
  if (!req.auth) throw new UnauthorizedError();
  const retailerId = await getRetailerIdForUser(req.auth.userId);
  if (!retailerId) throw new UnauthorizedError("No retailer profile for this account");
  return retailerId;
}

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  const retailerId = await requireOwnRetailerId(req);
  res.status(200).json({ items: await service.listForRetailer(retailerId) });
});

export const createMine = asyncHandler(async (req: Request, res: Response) => {
  const retailerId = await requireOwnRetailerId(req);
  const collection = await service.createForRetailer(retailerId, req.body);
  res.status(201).json({ collection });
});

export const updateMine = asyncHandler(async (req: Request, res: Response) => {
  const retailerId = await requireOwnRetailerId(req);
  const collection = await service.updateForRetailer(retailerId, req.params.id as string, req.body);
  res.status(200).json({ collection });
});

export const deleteMine = asyncHandler(async (req: Request, res: Response) => {
  const retailerId = await requireOwnRetailerId(req);
  await service.deleteForRetailer(retailerId, req.params.id as string);
  res.status(204).send();
});
