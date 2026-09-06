import { Router } from "express";
import { asyncHandler } from "@/lib/asyncHandler.js";
import { requireAuth, requireRole } from "@/middleware/auth.js";
import * as service from "./admin.service.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("ADMIN"));

adminRouter.get("/stats", asyncHandler(async (_req, res) => res.status(200).json(await service.getStats())));
adminRouter.get("/overview", asyncHandler(async (_req, res) => res.status(200).json({ items: await service.getOverview() })));
adminRouter.get("/pending-actions", asyncHandler(async (_req, res) => res.status(200).json({ items: await service.getPendingActions() })));
adminRouter.get("/activity", asyncHandler(async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 10;
  res.status(200).json({ items: await service.getActivityLog(limit) });
}));
