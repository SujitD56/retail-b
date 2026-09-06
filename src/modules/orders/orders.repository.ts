import { prisma } from "@/lib/prisma.js";
import type { OrderStatus, Prisma, TrackingStatus } from "@prisma/client";

const withRelations = { items: true, tracking: true } as const;

export function findByOrderNumber(orderNumber: string) {
  return prisma.order.findUnique({ where: { orderNumber }, include: withRelations });
}

export function findByUser(userId: string) {
  return prisma.order.findMany({ where: { userId }, include: withRelations, orderBy: { placedAt: "desc" } });
}

export function findManyAdmin(opts?: { skip?: number; take?: number }) {
  return prisma.order.findMany({
    include: { items: { include: { retailer: { select: { name: true } } } }, user: { select: { name: true } } },
    orderBy: { placedAt: "desc" },
    ...opts,
  });
}

export async function findForRetailer(retailerId: string) {
  const orders = await prisma.order.findMany({
    where: { items: { some: { retailerId } } },
    include: { items: { where: { retailerId }, include: { product: { select: { name: true } } } }, user: { select: { name: true } } },
    orderBy: { placedAt: "desc" },
  });
  return orders.map((order) => ({ order, retailerItems: order.items }));
}

interface CreateOrderData {
  orderNumber: string;
  userId?: string;
  guestEmail?: string;
  paymentMethod: Prisma.OrderCreateInput["paymentMethod"];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  shippingAddress: Prisma.InputJsonValue;
  estimatedDelivery: Date;
  items: { productId: string; retailerId: string; quantity: number; priceAtPurchase: number }[];
  tracking: { status: TrackingStatus; label: string; timestamp: Date | null; complete: boolean; position: number }[];
}

export function create(data: CreateOrderData) {
  return prisma.order.create({
    data: {
      orderNumber: data.orderNumber,
      userId: data.userId,
      guestEmail: data.guestEmail,
      paymentMethod: data.paymentMethod,
      subtotal: data.subtotal,
      shipping: data.shipping,
      tax: data.tax,
      total: data.total,
      shippingAddress: data.shippingAddress,
      estimatedDelivery: data.estimatedDelivery,
      items: { create: data.items },
      tracking: { create: data.tracking },
    },
    include: withRelations,
  });
}

export function decrementStock(productId: string, quantity: number) {
  return prisma.product.update({ where: { id: productId }, data: { stockCount: { decrement: quantity } } });
}

export function findTrackingSteps(orderId: string) {
  return prisma.orderTrackingStep.findMany({ where: { orderId }, orderBy: { position: "asc" } });
}

/** Marks every tracking step at or before `uptoPosition` complete (handles an admin jumping straight to e.g. "delivered", which implicitly means shipped/in-transit already happened). */
export async function updateStatus(orderId: string, status: OrderStatus, uptoPosition: number, timestamp: Date) {
  return prisma.$transaction([
    prisma.order.update({ where: { id: orderId }, data: { status } }),
    prisma.orderTrackingStep.updateMany({
      where: { orderId, position: { lte: uptoPosition }, complete: false },
      data: { complete: true, timestamp },
    }),
  ]);
}

export function findById(id: string) {
  return prisma.order.findUnique({ where: { id }, include: withRelations });
}
