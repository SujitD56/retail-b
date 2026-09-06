import crypto from "node:crypto";
import { prisma } from "@/lib/prisma.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/lib/errors.js";
import { eventBus, DomainEvents } from "@/lib/eventBus.js";
import { ORDER_STATUS_FROM_LABEL } from "@/lib/enumLabels.js";
import * as productsService from "@/modules/products/products.service.js";
import * as repo from "./orders.repository.js";
import { toAdminOrderRow, toOrderDTO, toRetailerOrderRow } from "./orders.mappers.js";
import type { CheckoutInput } from "./orders.schemas.js";

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

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId: requester?.userId,
        guestEmail: requester?.userId ? undefined : input.guestEmail,
        paymentMethod: input.paymentMethod.toUpperCase() as never,
        paymentStatus: input.paymentMethod === "cod" ? "PENDING" : "PAID",
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
  return toOrderDTO(order);
}

export async function getByOrderNumber(orderNumber: string, requester: { userId?: string; role?: string }) {
  const order = await repo.findByOrderNumber(orderNumber);
  if (!order) throw new NotFoundError("Order not found");
  if (requester.role !== "ADMIN" && order.userId && order.userId !== requester.userId) {
    throw new ForbiddenError("You don't have access to this order");
  }
  return toOrderDTO(order);
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
