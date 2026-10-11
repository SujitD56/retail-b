import { z } from "zod";

export const addressSchema = z.object({
  fullName: z.string().min(2),
  line1: z.string().min(4),
  city: z.string().min(2),
  state: z.string().min(2),
  postalCode: z
    .string()
    .regex(/^\d{6}$/)
    .refine((v) => !/^(\d)\1{5}$/.test(v), "Enter a valid 6-digit PIN code"),
  // Indian mobile number: 10 digits starting 6-9, with an optional +91/91/0
  // prefix — spaces/dashes anywhere are stripped before matching.
  phone: z.string().refine((v) => /^(?:\+?91|0)?[6-9]\d{9}$/.test(v.replace(/[\s-]/g, "")), "Enter a valid 10-digit mobile number"),
});

export const checkoutSchema = z.object({
  items: z.array(z.object({ productId: z.string(), quantity: z.number().int().positive() })).min(1),
  shippingAddress: addressSchema,
  deliveryMethod: z.enum(["standard", "express"]).default("standard"),
  paymentMethod: z.enum(["upi", "card", "netbanking", "cod"]),
  guestEmail: z.string().email().optional(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const updateOrderStatusSchema = z.object({
  status: z.enum(["processing", "shipped", "in transit", "delivered", "cancelled"]),
});

// Fields Razorpay Checkout.js hands back to the client on success — passed
// straight through to the server so it can verify the signature itself.
// Trusting these without verification is exactly the bug this replaces.
export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
