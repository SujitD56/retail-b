import { Router } from "express";
import * as controller from "./webhooks.controller.js";

export const webhooksRouter = Router();

// No auth middleware — Razorpay calls this directly and can't send our JWT.
// The signature check inside the controller (verified against the webhook
// secret, not the API key secret) is the actual security boundary here.
webhooksRouter.post("/razorpay", controller.handleRazorpayWebhook);
