import type { Order, OrderItem, OrderTrackingStep } from "@prisma/client";
import { ORDER_STATUS_LABEL, TRACKING_STATUS_LABEL } from "@/lib/enumLabels.js";

type OrderWithRelations = Order & { items: OrderItem[]; tracking: OrderTrackingStep[] };

/** Maps a DB row to exactly the `Order` shape `types/index.ts` defines on the frontend. */
export function toOrderDTO(order: OrderWithRelations) {
  return {
    id: order.orderNumber,
    userId: order.userId ?? "guest",
    items: order.items
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((i) => ({ productId: i.productId, quantity: i.quantity, priceAtPurchase: Number(i.priceAtPurchase) })),
    status: ORDER_STATUS_LABEL[order.status],
    placedAt: order.placedAt.toISOString(),
    estimatedDelivery: order.estimatedDelivery.toISOString().slice(0, 10),
    subtotal: Number(order.subtotal),
    shipping: Number(order.shipping),
    tax: Number(order.tax),
    total: Number(order.total),
    shippingAddress: order.shippingAddress,
    tracking: order.tracking
      .sort((a, b) => a.position - b.position)
      .map((t) => ({
        status: TRACKING_STATUS_LABEL[t.status],
        label: t.label,
        timestamp: t.timestamp?.toISOString() ?? "",
        complete: t.complete,
      })),
  };
}

const ADMIN_PAYMENT_STATUS = { PAID: "Paid", PENDING: "COD", FAILED: "Failed" } as const;
const ADMIN_FULFILLMENT_STATUS = {
  PROCESSING: "Confirmed",
  SHIPPED: "Shipped",
  IN_TRANSIT: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
} as const;

export function toAdminOrderRow(
  order: Order & { items: (OrderItem & { retailer: { name: string } })[]; user: { name: string } | null },
) {
  const retailerNames = [...new Set(order.items.map((i) => i.retailer.name))];
  return {
    id: order.id,
    orderId: `#${order.orderNumber}`,
    customer: order.user?.name ?? order.guestEmail ?? "Guest",
    retailer: retailerNames.length === 1 ? retailerNames[0] : `${retailerNames.length} retailers`,
    itemCount: order.items.reduce((sum, i) => sum + i.quantity, 0),
    total: Number(order.total),
    paymentStatus: ADMIN_PAYMENT_STATUS[order.paymentStatus],
    fulfillmentStatus: order.status === "CANCELLED" ? "Cancelled" : ADMIN_FULFILLMENT_STATUS[order.status],
    orderDate: order.placedAt.toISOString().slice(0, 10),
  };
}

export function toRetailerOrderRow(
  order: Order & { user: { name: string } | null },
  retailerItems: (OrderItem & { product: { name: string } })[],
) {
  const amount = retailerItems.reduce((sum, i) => sum + Number(i.priceAtPurchase) * i.quantity, 0);
  const productSummary = retailerItems.map((i) => `${i.product.name} (x${i.quantity})`).join(", ");
  return {
    id: order.orderNumber,
    customer: order.user?.name ?? order.guestEmail ?? "Guest",
    product: productSummary,
    amount,
    paymentStatus: ADMIN_PAYMENT_STATUS[order.paymentStatus] as "Paid" | "COD" | "Failed",
    shipStatus: (order.status === "CANCELLED" ? "Cancelled" : ADMIN_FULFILLMENT_STATUS[order.status]) as
      | "Processing"
      | "Confirmed"
      | "Shipped"
      | "Delivered"
      | "Cancelled",
    date: order.placedAt.toISOString().slice(0, 10),
  };
}
