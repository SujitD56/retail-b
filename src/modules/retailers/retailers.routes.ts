import { Router } from "express";
import { requireAuth, requireRole } from "@/middleware/auth.js";
import { validate } from "@/middleware/validate.js";
import { authRateLimiter } from "@/middleware/rateLimit.js";
import * as controller from "./retailers.controller.js";
import { moderateRetailerSchema, registerRetailerSchema, updateRetailerSettingsSchema } from "./retailers.schemas.js";

export const retailersRouter = Router();

retailersRouter.post("/register", authRateLimiter, validate(registerRetailerSchema), controller.register);

retailersRouter.get("/me", requireAuth, requireRole("RETAILER"), controller.me);
retailersRouter.patch("/me", requireAuth, requireRole("RETAILER"), validate(updateRetailerSettingsSchema), controller.updateSettings);

retailersRouter.get("/admin", requireAuth, requireRole("ADMIN"), controller.listAdmin);
retailersRouter.patch(
  "/admin/:id/moderate",
  requireAuth,
  requireRole("ADMIN"),
  validate(moderateRetailerSchema),
  controller.moderate,
);

retailersRouter.get("/", controller.list);
retailersRouter.get("/slug/:slug", controller.getBySlug);
retailersRouter.get("/:id", controller.getById);
