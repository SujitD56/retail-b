import Razorpay from "razorpay";
// Deep import: this SDK version only exposes `validateWebhookSignature` as a
// static on the Razorpay class itself — `validatePaymentVerification` (used
// to check a Checkout.js success callback) is only reachable via this utils
// module, not via the class.
import { validatePaymentVerification, validateWebhookSignature } from "razorpay/dist/utils/razorpay-utils.js";
import { env } from "@/config/env.js";

// Single shared client. `key_secret` never leaves this process — it's only
// used here (to create orders) and in payment/webhook signature verification
// below, both server-side.
export const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID,
  key_secret: env.RAZORPAY_KEY_SECRET,
});

/**
 * Verifies the `razorpay_order_id` / `razorpay_payment_id` / `razorpay_signature`
 * trio a client hands back after Checkout.js completes. Razorpay signs
 * `order_id|payment_id` with HMAC-SHA256 using the key secret — this is the
 * only thing that proves a payment actually happened; nothing about the
 * client's request body itself is trustworthy on its own.
 */
export function verifyPaymentSignature(params: { orderId: string; paymentId: string; signature: string }): boolean {
  return validatePaymentVerification(
    { order_id: params.orderId, payment_id: params.paymentId },
    params.signature,
    env.RAZORPAY_KEY_SECRET,
  );
}

/**
 * Verifies the `X-Razorpay-Signature` header on an incoming webhook against
 * the *raw* request body (see app.ts's `verify` hook on express.json — this
 * MUST run against the exact bytes Razorpay signed, not a re-serialized
 * JSON.parse of them, or valid webhooks fail verification). Uses the
 * separate webhook secret, never the key secret.
 */
export function verifyWebhookSignature(rawBody: string, signature: string, webhookSecret: string): boolean {
  return validateWebhookSignature(rawBody, signature, webhookSecret);
}
