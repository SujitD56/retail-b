import crypto from "node:crypto";
import { prisma } from "@/lib/prisma.js";
import { env } from "@/config/env.js";
import { logger } from "@/lib/logger.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/lib/errors.js";
import { eventBus, DomainEvents } from "@/lib/eventBus.js";
import { ORDER_STATUS_FROM_LABEL } from "@/lib/enumLabels.js";
import { razorpay, verifyPaymentSignature } from "@/lib/razorpay.js";
import * as productsService from "@/modules/products/products.service.js";
import * as repo from "./orders.repository.js";
import { toAdminOrderRow, toOrderDTO, toRetailerOrderRow } from "./orders.mappers.js";
import type { CheckoutInput, VerifyPaymentInput } from "./orders.schemas.js";
import type { Order, OrderItem, OrderTrackingStep } from "@prisma/client";

const SHIPPING_PER_RETAILER = 150;
const EXPRESS_SURCHARGE = 250;
const TAX_RATE = 0.18;

// Position in the tracking timeline — used to bulk-complete earlier steps
// when an admin jumps straight to a later status (see orders.repository.ts).
const TRACKING_POSITION = { PLACED: 0, PROCESSING: 1, SHIPPED: 2, IN_TRANSIT: 3, DELIVERED: 4 } as const;

function generateOrderNumber() {
  return `ORD-${crypto.randomInt(10000, 99999)}`;
}

export async function checkout(requester: { userId?: string; role?: string } | null, input: CheckoutInput) {
  if (!requester?.userId && !input.guestEmail) {
    throw new BadRequestError("A guest email is required to check out without an account");
  }

  const productIds = input.items.map((i) => i.productId);
  const products = await productsService.getManyRaw(productIds);

  // Prices/stock are ALWAYS recomputed server-side from the DB — the client
  // total is display-only and never trusted for the charge.
  const lineItems = input.items.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    if (!product) throw new NotFoundError(`Product ${item.productId} not found`);
    if (product.status !== "ACTIVE" || product.stockCount < item.quantity) {
      throw new BadRequestError(`"${product.name}" doesn't have enough stock`);
    }
    return { productId: product.id, retailerId: product.retailerId, quantity: item.quantity, priceAtPurchase: product.price };
  });

  const subtotal = lineItems.reduce((sum, i) => sum + i.priceAtPurchase * i.quantity, 0);
  const retailerCount = new Set(lineItems.map((i) => i.retailerId)).size;
  const shipping = retailerCount * SHIPPING_PER_RETAILER + (input.deliveryMethod === "express" ? EXPRESS_SURCHARGE : 0);
  const tax = Math.round(subtotal * TAX_RATE);
  const total = subtotal + shipping + tax;

  const now = new Date();
  const estimatedDelivery = new Date(now.getTime() + (input.deliveryMethod === "express" ? 3 : 7) * 24 * 60 * 60 * 1000);
  const orderNumber = generateOrderNumber();

  // For every online method, open a Razorpay order BEFORE touching our own
  // DB. If this call fails, checkout fails cleanly with nothing committed —
  // no stock decremented, no dangling order — instead of leaving a PENDING
  // order in our DB that Razorpay never heard of. COD never talks to
  // Razorpay at all; there's no online payment leg to verify.
  let razorpayOrderId: string | undefined;
  if (input.paymentMethod !== "cod") {
    const rpOrder = await razorpay.orders.create({
      amount: Math.round(total * 100), // paise
      currency: "INR",
      receipt: orderNumber,
    });
    razorpayOrderId = rpOrder.id;
  }

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber,
        userId: requester?.userId,
        guestEmail: requester?.userId ? undefined : input.guestEmail,
        paymentMethod: input.paymentMethod.toUpperCase() as never,
        // Always PENDING at creation, online methods included — this only
        // ever flips to PAID from verifyPayment()/markPaidFromWebhook()
        // below, once Razorpay has actually confirmed a payment. Never set
        // it from the checkout request itself; the client hasn't paid
        // anything yet at this point, it's just told us how it intends to.
        paymentStatus: "PENDING",
        razorpayOrderId,
        subtotal,
        shipping,
        tax,
        total,
        shippingAddress: input.shippingAddress,
        estimatedDelivery,
        items: { create: lineItems },
        tracking: {
          create: [
            { status: "PLACED", label: "Order Placed", timestamp: now, complete: true, position: 0 },
            { status: "PROCESSING", label: "Handloom Verified & Processing", timestamp: now, complete: true, position: 1 },
            { status: "SHIPPED", label: "Shipped from Ilkal", timestamp: null, complete: false, position: 2 },
            { status: "IN_TRANSIT", label: "In Transit", timestamp: null, complete: false, position: 3 },
            { status: "DELIVERED", label: "Delivered", timestamp: null, complete: false, position: 4 },
          ],
        },
      },
      include: { items: true, tracking: true },
    });

    for (const item of lineItems) {
      await tx.product.update({ where: { id: item.productId }, data: { stockCount: { decrement: item.quantity } } });
    }

    return created;
  });

  eventBus.publish(DomainEvents.OrderPlaced, { orderId: order.id, orderNumber: order.orderNumber, total });

  return {
    order: toOrderDTO(order),
    // Everything the frontend needs to open Razorpay Checkout.js — null for
    // COD, which has nothing to collect online. `keyId` is the public half
    // of the credential pair and is meant to ship to the client; the secret
    // never appears in any response.
    payment: razorpayOrderId
      ? { provider: "razorpay" as const, keyId: env.RAZORPAY_KEY_ID, orderId: razorpayOrderId, amount: Math.round(total * 100), currency: "INR" }
      : null,
  };
}

type OrderWithRelations = Order & { items: OrderItem[]; tracking: OrderTrackingStep[] };

function assertCanAccessOrder(order: OrderWithRelations, requester: { userId?: string; role?: string }) {
  if (requester.role !== "ADMIN" && order.userId && order.userId !== requester.userId) {
    throw new ForbiddenError("You don't have access to this order");
  }
}

export async function getByOrderNumber(orderNumber: string, requester: { userId?: string; role?: string }) {
  const order = await repo.findByOrderNumber(orderNumber);
  if (!order) throw new NotFoundError("Order not found");
  assertCanAccessOrder(order, requester);
  return toOrderDTO(order);
}

/** Verifies a Razorpay Checkout.js success callback and, only if the signature checks out, marks the order paid. This is the sole client-facing path that can flip paymentStatus to PAID. */
export async function verifyPayment(
  orderNumber: string,
  requester: { userId?: string; role?: string },
  payload: VerifyPaymentInput,
) {
  const order = await repo.findByOrderNumber(orderNumber);
  if (!order) throw new NotFoundError("Order not found");
  assertCanAccessOrder(order, requester);

  if (!order.razorpayOrderId) throw new BadRequestError("This order has no online payment to verify");
  // The signature alone doesn't name an order — it's only valid for the
  // exact order_id it was computed over. Pinning to the id we stored at
  // checkout (not just "any valid signature") stops a signature for one
  // order being replayed against a different one.
  if (order.razorpayOrderId !== payload.razorpay_order_id) {
    throw new BadRequestError("This payment doesn't belong to this order");
  }
  if (order.paymentStatus === "PAID") return toOrderDTO(order); // idempotent — client retry, or a race with the webhook

  const valid = verifyPaymentSignature({
    orderId: payload.razorpay_order_id,
    paymentId: payload.razorpay_payment_id,
    signature: payload.razorpay_signature,
  });
  if (!valid) {
    await repo.markPaymentFailed(order.id);
    throw new BadRequestError("Payment verification failed");
  }

  const updated = await repo.markPaid(order.id, payload.razorpay_payment_id);
  eventBus.publish(DomainEvents.OrderPaid, { orderId: order.id, orderNumber: order.orderNumber, total: Number(order.total) });
  return toOrderDTO(updated);
}

/** Server-to-server counterpart of verifyPayment(), driven by the Razorpay webhook (webhooks.controller.ts) rather than a client callback. This is the authoritative path — it doesn't depend on the customer's browser making it back to the success handler. */
export async function markPaidFromWebhook(razorpayOrderId: string, razorpayPaymentId: string) {
  const order = await repo.findByRazorpayOrderId(razorpayOrderId);
  if (!order) {
    logger.warn({ razorpayOrderId }, "razorpay webhook: payment.captured for an unknown order");
    return;
  }
  if (order.paymentStatus === "PAID") return; // idempotent — Razorpay retries webhook delivery
  await repo.markPaid(order.id, razorpayPaymentId);
  eventBus.publish(DomainEvents.OrderPaid, { orderId: order.id, orderNumber: order.orderNumber, total: Number(order.total) });
}

export async function markFailedFromWebhook(razorpayOrderId: string) {
  const order = await repo.findByRazorpayOrderId(razorpayOrderId);
  if (!order) {
    logger.warn({ razorpayOrderId }, "razorpay webhook: payment.failed for an unknown order");
    return;
  }
  if (order.paymentStatus === "PAID") return; // never downgrade a confirmed payment on a late/duplicate failure event
  await repo.markPaymentFailed(order.id);
}

export async function listMine(userId: string) {
  const orders = await repo.findByUser(userId);
  return orders.map(toOrderDTO);
}

export async function listForRetailer(retailerId: string) {
  const rows = await repo.findForRetailer(retailerId);
  return rows.map(({ order, retailerItems }) => toRetailerOrderRow(order, retailerItems));
}

export async function listForAdmin(page: number, pageSize: number) {
  const rows = await repo.findManyAdmin({ skip: (page - 1) * pageSize, take: pageSize });
  return rows.map(toAdminOrderRow);
}

export async function updateStatusAdmin(orderId: string, statusLabel: string) {
  const order = await repo.findById(orderId);
  if (!order) throw new NotFoundError("Order not found");

  const status = ORDER_STATUS_FROM_LABEL[statusLabel];
  if (!status) throw new BadRequestError("Invalid status");

  if (status === "CANCELLED") {
    await prisma.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } });
  } else {
    const position = TRACKING_POSITION[status as keyof typeof TRACKING_POSITION];
    await repo.updateStatus(orderId, status, position, new Date());
  }

  const updated = await repo.findById(orderId);
  return toOrderDTO(updated!);
}
