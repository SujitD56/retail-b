import type { Request, Response } from "express";
import { asyncHandler } from "@/lib/asyncHandler.js";
import { NotFoundError, UnauthorizedError } from "@/lib/errors.js";
import { getRetailerIdForUser } from "@/modules/retailers/retailers.service.js";
import * as service from "./products.service.js";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { weaveType, retailerId, tag, q, page, pageSize } = req.query as unknown as {
    weaveType?: string;
    retailerId?: string;
    tag?: string;
    q?: string;
    page: number;
    pageSize: number;
  };
  const result = await service.listProducts({ weaveType, retailerId, tag, q, page, pageSize });
  res.status(200).json(result);
});

export const getBySlug = asyncHandler(async (req: Request, res: Response) => {
  const product = await service.getBySlug(req.params.slug as string);
  if (!product) throw new NotFoundError("Product not found");
  res.status(200).json({ product });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const product = await service.getById(req.params.id as string);
  if (!product) throw new NotFoundError("Product not found");
  res.status(200).json({ product });
});

export const byIds = asyncHandler(async (req: Request, res: Response) => {
  const raw = req.query.ids;
  const ids = typeof raw === "string" ? raw.split(",").filter(Boolean) : [];
  res.status(200).json({ items: await service.getByIds(ids) });
});

export const trending = asyncHandler(async (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 4;
  res.status(200).json({ items: await service.getTrending(limit) });
});

export const related = asyncHandler(async (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 4;
  res.status(200).json({ items: await service.getRelated(req.params.id as string, limit) });
});

async function requireOwnRetailerId(req: Request) {
  if (!req.auth) throw new UnauthorizedError();
  const retailerId = await getRetailerIdForUser(req.auth.userId);
  if (!retailerId) throw new UnauthorizedError("No retailer profile for this account");
  return retailerId;
}

export const createMine = asyncHandler(async (req: Request, res: Response) => {
  const retailerId = await requireOwnRetailerId(req);
  const product = await service.createForRetailer(retailerId, req.body);
  res.status(201).json({ product });
});

export const updateMine = asyncHandler(async (req: Request, res: Response) => {
  const retailerId = await requireOwnRetailerId(req);
  const product = await service.updateForRetailer(retailerId, req.params.id as string, req.body);
  res.status(200).json({ product });
});

export const deleteMine = asyncHandler(async (req: Request, res: Response) => {
  const retailerId = await requireOwnRetailerId(req);
  await service.deleteForRetailer(retailerId, req.params.id as string);
  res.status(204).send();
});

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  const retailerId = await requireOwnRetailerId(req);
  res.status(200).json(await service.listForRetailer(retailerId));
});

export const listAdmin = asyncHandler(async (req: Request, res: Response) => {
  const page = req.query.page ? Number(req.query.page) : 1;
  const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 50;
  res.status(200).json(await service.listForAdmin({ page, pageSize }));
});

export const setStatusAdmin = asyncHandler(async (req: Request, res: Response) => {
  const product = await service.setStatusAdmin(req.params.id as string, req.body.status);
  res.status(200).json({ product });
});
