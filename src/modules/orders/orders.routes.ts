import { Router } from "express";
import { optionalAuth, requireAuth, requireRole } from "@/middleware/auth.js";
import { validate } from "@/middleware/validate.js";
import * as controller from "./orders.controller.js";
import { checkoutSchema, updateOrderStatusSchema } from "./orders.schemas.js";

export const ordersRouter = Router();

ordersRouter.post("/checkout", optionalAuth, validate(checkoutSchema), controller.checkout);

ordersRouter.get("/mine", requireAuth, controller.listMine);
ordersRouter.get("/retailer/mine", requireAuth, requireRole("RETAILER"), controller.listForRetailer);
ordersRouter.get("/admin", requireAuth, requireRole("ADMIN"), controller.listForAdmin);
ordersRouter.patch("/admin/:id/status", requireAuth, requireRole("ADMIN"), validate(updateOrderStatusSchema), controller.updateStatusAdmin);

ordersRouter.get("/:orderNumber", optionalAuth, controller.getOne);
