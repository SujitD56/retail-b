import type { Request, Response } from "express";
import { asyncHandler } from "@/lib/asyncHandler.js";
import { UnauthorizedError } from "@/lib/errors.js";
import { getRetailerIdForUser } from "@/modules/retailers/retailers.service.js";
import * as service from "./orders.service.js";

export const checkout = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.checkout(req.auth ? { userId: req.auth.userId, role: req.auth.role } : null, req.body);
  res.status(201).json(result);
});

export const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.verifyPayment(req.params.orderNumber as string, { userId: req.auth?.userId, role: req.auth?.role }, req.body);
  res.status(200).json(result);
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.getByOrderNumber(req.params.orderNumber as string, {
    userId: req.auth?.userId,
    role: req.auth?.role,
  });
  res.status(200).json(result);
});

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw new UnauthorizedError();
  res.status(200).json({ items: await service.listMine(req.auth.userId) });
});

export const cancelMine = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw new UnauthorizedError();
  const result = await service.cancelMine(req.params.orderNumber as string, { userId: req.auth.userId, role: req.auth.role });
  res.status(200).json(result);
});

export const listForRetailer = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw new UnauthorizedError();
  const retailerId = await getRetailerIdForUser(req.auth.userId);
  if (!retailerId) throw new UnauthorizedError("No retailer profile for this account");
  res.status(200).json({ items: await service.listForRetailer(retailerId) });
});

export const listForAdmin = asyncHandler(async (req: Request, res: Response) => {
  const page = req.query.page ? Number(req.query.page) : 1;
  const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 50;
  res.status(200).json({ items: await service.listForAdmin(page, pageSize) });
});

export const updateStatusAdmin = asyncHandler(async (req: Request, res: Response) => {
  const order = await service.updateStatusAdmin(req.params.id as string, req.body.status);
  res.status(200).json({ order });
});
