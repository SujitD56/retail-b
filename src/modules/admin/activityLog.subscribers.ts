// Wires the admin dashboard's activity feed to the SAME domain events other
// modules already publish for their own reasons (order confirmation,
// retailer onboarding, …). This module doesn't own those events — it just
// listens, which is exactly the point of the event bus: new consumers can
// be added (this one, a future email notifier, a future analytics service)
// without touching the modules that publish them.
import { prisma } from "@/lib/prisma.js";
import { eventBus, DomainEvents } from "@/lib/eventBus.js";
import { logger } from "@/lib/logger.js";

function log(type: string, message: string) {
  prisma.activityLogEntry.create({ data: { type, message } }).catch((err) => logger.error({ err }, "activity log write failed"));
}

export function registerActivityLogSubscribers() {
  eventBus.subscribe<{ orderNumber: string; total: number }>(DomainEvents.OrderPlaced, ({ orderNumber, total }) => {
    log("ORDER", `Order ${orderNumber} placed (₹${total.toLocaleString("en-IN")}).`);
  });

  eventBus.subscribe<{ retailerId: string }>(DomainEvents.RetailerRegistered, async ({ retailerId }) => {
    const retailer = await prisma.retailer.findUnique({ where: { id: retailerId } });
    log("RETAILER", `New retailer application: '${retailer?.name ?? retailerId}' submitted for review.`);
  });

  eventBus.subscribe<{ retailerId: string }>(DomainEvents.RetailerApproved, async ({ retailerId }) => {
    const retailer = await prisma.retailer.findUnique({ where: { id: retailerId } });
    log("RETAILER", `Retailer '${retailer?.name ?? retailerId}' approved and is now live.`);
  });

  eventBus.subscribe<{ productId: string; retailerId: string }>(DomainEvents.ProductCreated, async ({ productId }) => {
    const product = await prisma.product.findUnique({ where: { id: productId }, include: { retailer: { select: { name: true } } } });
    log("SYSTEM", `'${product?.retailer.name ?? "A retailer"}' listed a new product: ${product?.name ?? productId}.`);
  });

  eventBus.subscribe<{ entryId: string; votes: number }>(DomainEvents.EventVoteCast, ({ entryId, votes }) => {
    log("EVENT", `Entry ${entryId} received a new vote (${votes} total).`);
  });
}
