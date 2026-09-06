import { Router } from "express";
import { asyncHandler } from "@/lib/asyncHandler.js";
import { requireAuth, requireRole } from "@/middleware/auth.js";
import { UnauthorizedError } from "@/lib/errors.js";
import { getRetailerIdForUser } from "./retailers.service.js";
import * as stats from "./retailer-stats.service.js";

export const retailerStatsRouter = Router();
retailerStatsRouter.use(requireAuth, requireRole("RETAILER"));

async function ownRetailerId(req: import("express").Request) {
  if (!req.auth) throw new UnauthorizedError();
  const id = await getRetailerIdForUser(req.auth.userId);
  if (!id) throw new UnauthorizedError("No retailer profile for this account");
  return id;
}

retailerStatsRouter.get(
  "/dashboard",
  asyncHandler(async (req, res) => res.status(200).json(await stats.getDashboardStats(await ownRetailerId(req)))),
);

retailerStatsRouter.get(
  "/sales-trend",
  asyncHandler(async (req, res) => res.status(200).json({ items: await stats.getSalesTrend(await ownRetailerId(req)) })),
);

retailerStatsRouter.get(
  "/low-stock",
  asyncHandler(async (req, res) => res.status(200).json({ items: await stats.getLowStockAlerts(await ownRetailerId(req)) })),
);

retailerStatsRouter.get(
  "/top-products",
  asyncHandler(async (req, res) => res.status(200).json({ items: await stats.getTopPerformingProducts(await ownRetailerId(req)) })),
);

retailerStatsRouter.get(
  "/recent-reviews",
  asyncHandler(async (req, res) => res.status(200).json({ items: await stats.getRecentVerifiedReviews(await ownRetailerId(req)) })),
);
