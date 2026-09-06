import { Router } from "express";
import { requireAuth } from "@/middleware/auth.js";
import { validate } from "@/middleware/validate.js";
import * as controller from "./uploads.controller.js";
import { presignSchema } from "./uploads.schemas.js";

export const uploadsRouter = Router();

// Any authenticated role may request an upload slot — retailers upload
// product/store imagery, admins upload event banners, customers upload an
// avatar. What they're allowed to DO with the resulting URL (e.g. attach it
// to a product) is enforced by that resource's own module, not here.
uploadsRouter.post("/presign", requireAuth, validate(presignSchema), controller.presign);
uploadsRouter.delete("/:key(*)", requireAuth, controller.remove);
