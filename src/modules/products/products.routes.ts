import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "@/middleware/auth.js";
import { validate } from "@/middleware/validate.js";
import * as controller from "./products.controller.js";
import { createProductSchema, listProductsQuerySchema, updateProductSchema } from "./products.schemas.js";

export const productsRouter = Router();

// Retailer self-service — mounted before the public `/:id`-shaped routes so
// "mine" isn't swallowed as a param.
productsRouter.get("/mine", requireAuth, requireRole("RETAILER"), controller.listMine);
productsRouter.post("/mine", requireAuth, requireRole("RETAILER"), validate(createProductSchema), controller.createMine);
productsRouter.patch("/mine/:id", requireAuth, requireRole("RETAILER"), validate(updateProductSchema), controller.updateMine);
productsRouter.delete("/mine/:id", requireAuth, requireRole("RETAILER"), controller.deleteMine);

// Admin moderation
productsRouter.get("/admin", requireAuth, requireRole("ADMIN"), controller.listAdmin);
productsRouter.patch(
  "/admin/:id/status",
  requireAuth,
  requireRole("ADMIN"),
  validate(z.object({ status: z.enum(["DRAFT", "ACTIVE", "UNDER_REVIEW", "ARCHIVED"]) })),
  controller.setStatusAdmin,
);

// Public catalog
productsRouter.get("/", validate(listProductsQuerySchema, "query"), controller.list);
productsRouter.get("/trending", controller.trending);
// Bulk lookup for client-side pages that only persist productIds (cart,
// wishlist, checkout, order line items) and need the full Product[] to render.
productsRouter.get("/by-ids", controller.byIds);
productsRouter.get("/slug/:slug", controller.getBySlug);
productsRouter.get("/:id/related", controller.related);
productsRouter.get("/:id", controller.getById);
