import { Router } from "express";
import { validate } from "@/middleware/validate.js";
import { requireAuth, requireRole } from "@/middleware/auth.js";
import { authRateLimiter } from "@/middleware/rateLimit.js";
import * as controller from "./auth.controller.js";
import { adminMfaVerifySchema, forgotPasswordSchema, loginSchema, resetPasswordSchema, signupSchema } from "./auth.schemas.js";

export const authRouter = Router();

authRouter.post("/signup", authRateLimiter, validate(signupSchema), controller.signup);
authRouter.post("/login", authRateLimiter, validate(loginSchema), controller.loginCustomer);
authRouter.post("/retailer/login", authRateLimiter, validate(loginSchema), controller.loginRetailer);
authRouter.post("/admin/login", authRateLimiter, validate(loginSchema), controller.loginAdmin);
authRouter.post("/admin/mfa/verify", authRateLimiter, validate(adminMfaVerifySchema), controller.verifyAdminMfa);

authRouter.post("/admin/mfa/setup", requireAuth, requireRole("ADMIN"), controller.setupAdminMfa);
authRouter.post("/admin/mfa/confirm", requireAuth, requireRole("ADMIN"), controller.confirmAdminMfa);

authRouter.post("/refresh", controller.refresh);
authRouter.post("/logout", controller.logout);
authRouter.get("/me", requireAuth, controller.me);

authRouter.post("/forgot-password", authRateLimiter, validate(forgotPasswordSchema), controller.forgotPassword);
authRouter.post("/reset-password", authRateLimiter, validate(resetPasswordSchema), controller.resetPassword);
