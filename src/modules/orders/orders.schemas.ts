import { z } from "zod";

export const addressSchema = z.object({
  fullName: z.string().min(2),
  line1: z.string().min(4),
  city: z.string().min(2),
  state: z.string().min(2),
  postalCode: z.string().regex(/^\d{6}$/),
  phone: z.string().regex(/^\+?\d[\d\s-]{7,}$/),
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
