import { Router } from "express";
import { optionalAuth, requireAuth, requireRole } from "@/middleware/auth.js";
import { validate } from "@/middleware/validate.js";
import * as controller from "./events.controller.js";
import { createEventSchema, moderateEntrySchema, submitEntrySchema } from "./events.schemas.js";

export const eventsRouter = Router();

eventsRouter.get("/hall-of-fame", controller.hallOfFame);

eventsRouter.get("/retailer/mine", requireAuth, requireRole("RETAILER"), controller.listMyEntries);
eventsRouter.get("/admin/moderation", requireAuth, requireRole("ADMIN"), controller.listForModeration);
eventsRouter.patch(
  "/admin/entries/:entryId/moderate",
  requireAuth,
  requireRole("ADMIN"),
  validate(moderateEntrySchema),
  controller.moderateEntry,
);
eventsRouter.post("/admin", requireAuth, requireRole("ADMIN"), validate(createEventSchema), controller.create);

eventsRouter.get("/entries/:entryId", optionalAuth, controller.getEntry);
eventsRouter.post("/entries/:entryId/vote", requireAuth, controller.vote);

eventsRouter.get("/", controller.list);
eventsRouter.get("/slug/:slug", controller.getBySlug);
eventsRouter.get("/:id/entries", controller.getEntries);
eventsRouter.post("/:id/entries", requireAuth, requireRole("RETAILER"), validate(submitEntrySchema), controller.submitEntry);
