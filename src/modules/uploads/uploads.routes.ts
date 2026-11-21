import { Router } from "express";
import { optionalAuth, requireAuth } from "@/middleware/auth.js";
import { validate } from "@/middleware/validate.js";
import * as controller from "./uploads.controller.js";
import { presignSchema } from "./uploads.schemas.js";

export const uploadsRouter = Router();

// Most roles may request an upload slot once authenticated — retailers
// upload product/store imagery, admins upload event banners, customers
// upload an avatar. What they're allowed to DO with the resulting URL (e.g.
// attach it to a product) is enforced by that resource's own module, not
// here. RETAILER_LOGO/COVER/DOCUMENT are the exception: the retailer
// registration wizard uploads these *before* the account (and its session)
// exists, so this route only optionally authenticates and the controller
// gates the auth-requiring purposes itself.
uploadsRouter.post("/presign", optionalAuth, validate(presignSchema), controller.presign);
uploadsRouter.delete("/:key(*)", requireAuth, controller.remove);
