import { prisma } from "@/lib/prisma.js";
import { WEAVE_TYPE_LABEL } from "@/lib/enumLabels.js";

function startOfWeeksAgo(weeks: number) {
  return new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000);
}

/** Computed retailer analytics — everything here is derived from real orders/products/reviews for that retailer, no hand-authored numbers. */
export async function getDashboardStats(retailerId: string) {
  const [revenueAgg, orderItemCount, activeProducts, customerCount, ratingAgg] = await Promise.all([
    prisma.orderItem.aggregate({ where: { retailerId }, _sum: { priceAtPurchase: true } }),
    prisma.orderItem.count({ where: { retailerId } }),
    prisma.product.count({ where: { retailerId, status: "ACTIVE" } }),
    prisma.order.findMany({ where: { items: { some: { retailerId } } }, distinct: ["userId"], select: { userId: true } }),
    prisma.product.aggregate({ where: { retailerId }, _avg: { rating: true } }),
  ]);

  return {
    totalSales: Number(revenueAgg._sum.priceAtPurchase ?? 0),
    orders: orderItemCount,
    activeProducts,
    customers: customerCount.filter((c) => c.userId).length,
    avgRating: Math.round((ratingAgg._avg.rating ?? 0) * 10) / 10,
  };
}

export async function getSalesTrend(retailerId: string, weeks = 12) {
  const buckets = Array.from({ length: weeks }, (_, i) => ({
    start: startOfWeeksAgo(weeks - i),
    end: startOfWeeksAgo(weeks - i - 1),
  }));

  return Promise.all(
    buckets.map(async ({ start, end }, i) => {
      const agg = await prisma.orderItem.aggregate({
        where: { retailerId, order: { placedAt: { gte: start, lt: end } } },
        _sum: { priceAtPurchase: true },
      });
      return { label: `Week ${i + 1}`, value: Number(agg._sum.priceAtPurchase ?? 0) };
    }),
  );
}

export async function getLowStockAlerts(retailerId: string) {
  const products = await prisma.product.findMany({
    where: { retailerId, status: "ACTIVE", stockCount: { lte: 3 } },
    orderBy: { stockCount: "asc" },
    take: 10,
  });
  return products.map((p) => ({ category: WEAVE_TYPE_LABEL[p.weaveType], product: p.name, unitsLeft: p.stockCount }));
}

export async function getTopPerformingProducts(retailerId: string, limit = 5) {
  const grouped = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: { retailerId },
    _sum: { priceAtPurchase: true },
    orderBy: { _sum: { priceAtPurchase: "desc" } },
    take: limit,
  });
  const products = await prisma.product.findMany({ where: { id: { in: grouped.map((g) => g.productId) } } });
  return grouped.map((g) => ({
    name: products.find((p) => p.id === g.productId)?.name ?? "Unknown product",
    revenue: Number(g._sum.priceAtPurchase ?? 0),
  }));
}

export async function getRecentVerifiedReviews(retailerId: string, limit = 5) {
  const reviews = await prisma.review.findMany({
    where: { product: { retailerId }, verified: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return reviews.map((r) => ({ author: r.authorName, date: r.createdAt.toISOString().slice(0, 10), rating: r.rating, title: r.title ?? "", body: r.body }));
}
