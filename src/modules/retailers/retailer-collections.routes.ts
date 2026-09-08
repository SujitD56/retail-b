import { Router } from "express";
import { requireAuth, requireRole } from "@/middleware/auth.js";
import { validate } from "@/middleware/validate.js";
import * as controller from "./retailer-collections.controller.js";
import { createRetailerCollectionSchema, updateRetailerCollectionSchema } from "./retailer-collections.schemas.js";

// Mounted at /retailers/collections — a retailer's own named product
// groupings, distinct from the global admin-curated Collection model
// exposed under /collections. All routes are self-service ("mine"), scoped
// to the authenticated retailer's own records.
export const retailerCollectionsRouter = Router();

retailerCollectionsRouter.get("/mine", requireAuth, requireRole("RETAILER"), controller.listMine);
retailerCollectionsRouter.post(
  "/mine",
  requireAuth,
  requireRole("RETAILER"),
  validate(createRetailerCollectionSchema),
  controller.createMine,
);
retailerCollectionsRouter.patch(
  "/mine/:id",
  requireAuth,
  requireRole("RETAILER"),
  validate(updateRetailerCollectionSchema),
  controller.updateMine,
);
retailerCollectionsRouter.delete("/mine/:id", requireAuth, requireRole("RETAILER"), controller.deleteMine);
