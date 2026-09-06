import type { Request, Response } from "express";
import { asyncHandler } from "@/lib/asyncHandler.js";
import { NotFoundError, UnauthorizedError } from "@/lib/errors.js";
import { getRetailerIdForUser } from "@/modules/retailers/retailers.service.js";
import * as service from "./events.service.js";

export const list = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json({ items: await service.listEvents() });
});

export const getBySlug = asyncHandler(async (req: Request, res: Response) => {
  const event = await service.getBySlug(req.params.slug as string);
  if (!event) throw new NotFoundError("Event not found");
  res.status(200).json({ event });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const event = await service.createEvent(req.body);
  res.status(201).json({ event });
});

export const getEntries = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json({ items: await service.getEntries(req.params.id as string) });
});

export const getEntry = asyncHandler(async (req: Request, res: Response) => {
  const entry = await service.getEntry(req.params.entryId as string);
  const hasVoted = req.auth ? await service.getHasVoted(entry.id, req.auth.userId) : false;
  res.status(200).json({ entry, hasVoted });
});

async function requireOwnRetailerId(req: Request) {
  if (!req.auth) throw new UnauthorizedError();
  const retailerId = await getRetailerIdForUser(req.auth.userId);
  if (!retailerId) throw new UnauthorizedError("No retailer profile for this account");
  return retailerId;
}

export const submitEntry = asyncHandler(async (req: Request, res: Response) => {
  const retailerId = await requireOwnRetailerId(req);
  const entry = await service.submitEntry(retailerId, req.params.id as string, req.body);
  res.status(201).json({ entry });
});

export const listMyEntries = asyncHandler(async (req: Request, res: Response) => {
  const retailerId = await requireOwnRetailerId(req);
  res.status(200).json({ items: await service.listMyEntries(retailerId) });
});

export const listForModeration = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json({ items: await service.listForModeration() });
});

export const moderateEntry = asyncHandler(async (req: Request, res: Response) => {
  const entry = await service.moderateEntry(req.params.entryId as string, req.body.action);
  res.status(200).json({ entry });
});

export const vote = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw new UnauthorizedError();
  const entry = await service.vote(req.params.entryId as string, req.auth.userId);
  res.status(200).json({ entry });
});

export const hallOfFame = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json({ items: await service.getHallOfFame() });
});
