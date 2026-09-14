import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "@/lib/asyncHandler.js";
import { env } from "@/config/env.js";
import { logger } from "@/lib/logger.js";
import { verifyWebhookSignature } from "@/lib/razorpay.js";
import * as ordersService from "@/modules/orders/orders.service.js";

// We only need enough of Razorpay's event envelope to route the two events
// we act on — see https://razorpay.com/docs/webhooks/payloads/payments/
const razorpayWebhookEventSchema = z.object({
  event: z.string(),
  payload: z.object({
    payment: z
      .object({
        entity: z.object({
          id: z.string(),
          order_id: z.string().optional(),
        }),
      })
      .optional(),
  }),
});

/**
 * Server-to-server notification from Razorpay — the authoritative source of
 * truth for payment status, independent of whether the customer's browser
 * ever makes it back to our verify-payment call (closed tab, crashed app,
 * flaky network after a successful payment). Must always ack with 2xx once
 * the signature is verified and the event is handled/ignored — Razorpay
 * retries on non-2xx and disables the webhook after enough failures, so a
 * shape we don't recognize is logged and acknowledged, not rejected.
 */
export const handleRazorpayWebhook = asyncHandler(async (req: Request, res: Response) => {
  if (!env.RAZORPAY_WEBHOOK_SECRET) {
    logger.error("razorpay webhook received but RAZORPAY_WEBHOOK_SECRET is not configured — refusing to process");
    res.status(501).json({ error: "Webhook not configured" });
    return;
  }

  const signature = req.headers["x-razorpay-signature"];
  if (typeof signature !== "string" || !req.rawBody) {
    res.status(400).json({ error: "Missing signature or body" });
    return;
  }

  // Verified against the raw bytes Razorpay actually signed — never against
  // a re-serialized req.body (see the `verify` hook in app.ts).
  const valid = verifyWebhookSignature(req.rawBody.toString("utf8"), signature, env.RAZORPAY_WEBHOOK_SECRET);
  if (!valid) {
    logger.warn("razorpay webhook: signature verification failed, rejecting");
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  const parsed = razorpayWebhookEventSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn({ body: req.body }, "razorpay webhook: unrecognized payload shape, acknowledging without action");
    res.status(200).json({ received: true });
    return;
  }

  const { event, payload } = parsed.data;
  const payment = payload.payment?.entity;

  if (event === "payment.captured" && payment?.order_id) {
    await ordersService.markPaidFromWebhook(payment.order_id, payment.id);
  } else if (event === "payment.failed" && payment?.order_id) {
    await ordersService.markFailedFromWebhook(payment.order_id);
  } else {
    logger.debug({ event }, "razorpay webhook: event not handled, ignoring");
  }

  res.status(200).json({ received: true });
});
