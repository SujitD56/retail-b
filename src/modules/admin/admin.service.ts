import { prisma } from "@/lib/prisma.js";
import { ORDER_STATUS_LABEL } from "@/lib/enumLabels.js";

function startOfMonth(offsetMonths = 0) {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCMonth(d.getUTCMonth() + offsetMonths);
  return d;
}

function percentChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? "+100%" : "0%";
  const pct = ((current - previous) / previous) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

/**
 * Cross-module read-side aggregation — the one deliberate exception to "a
 * module never reaches past another module's public service API" called
 * out in schema.prisma and server/README.md. This is a reporting/CQRS-style
 * read model, not a write path, so it's allowed to query other modules'
 * tables directly rather than round-tripping through half a dozen service
 * calls just to sum some columns.
 */
export async function getStats() {
  const [totalOrders, totalRetailers, totalProducts, revenueAgg, ordersByStatusRaw] = await Promise.all([
    prisma.order.count(),
    prisma.retailer.count({ where: { status: "APPROVED" } }),
    prisma.product.count(),
    prisma.order.aggregate({ _sum: { total: true } }),
    prisma.order.groupBy({ by: ["status"], _count: true }),
  ]);

  const months = Array.from({ length: 6 }, (_, i) => startOfMonth(i - 5));
  const revenueTrend = await Promise.all(
    months.map(async (start, i) => {
      const end = i === months.length - 1 ? new Date() : (months[i + 1] as Date);
      const agg = await prisma.order.aggregate({ _sum: { total: true }, where: { placedAt: { gte: start, lt: end } } });
      return { label: start.toLocaleString("en-US", { month: "short" }), value: Number(agg._sum.total ?? 0) };
    }),
  );

  return {
    totalRevenue: Number(revenueAgg._sum.total ?? 0),
    totalOrders,
    totalRetailers,
    totalProducts,
    revenueTrend,
    ordersByStatus: ordersByStatusRaw.map((row) => ({ status: ORDER_STATUS_LABEL[row.status], count: row._count })),
  };
}

export async function getOverview() {
  const thisMonth = startOfMonth(0);
  const lastMonth = startOfMonth(-1);

  const [
    totalRetailers,
    newRetailersThisMonth,
    verifiedRetailers,
    totalCustomers,
    totalProducts,
    newProductsThisWeek,
    totalOrders,
    ordersThisMonth,
    ordersLastMonth,
    gmvAgg,
  ] = await Promise.all([
    prisma.retailer.count(),
    prisma.retailer.count({ where: { createdAt: { gte: thisMonth } } }),
    prisma.retailer.count({ where: { status: "APPROVED" } }),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.product.count(),
    prisma.product.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
    prisma.order.count(),
    prisma.order.count({ where: { placedAt: { gte: thisMonth } } }),
    prisma.order.count({ where: { placedAt: { gte: lastMonth, lt: thisMonth } } }),
    prisma.order.aggregate({ _sum: { total: true } }),
  ]);

  const verificationRate = totalRetailers === 0 ? 0 : Math.round((verifiedRetailers / totalRetailers) * 100);

  return [
    { label: "Total Retailers", value: `${totalRetailers} Stores`, change: `+${newRetailersThisMonth} new`, note: "this month" },
    { label: "Verified Weavers", value: `${verifiedRetailers} Verified`, change: `${verificationRate}%`, note: "verification rate" },
    { label: "Total Customers", value: totalCustomers.toLocaleString("en-IN"), change: "", note: "registered accounts" },
    { label: "Total Products", value: totalProducts.toLocaleString("en-IN"), change: `+${newProductsThisWeek}`, note: "listed this week" },
    { label: "Total Orders", value: totalOrders.toLocaleString("en-IN"), change: percentChange(ordersThisMonth, ordersLastMonth), note: "vs last month" },
    { label: "Platform GMV", value: `₹${Number(gmvAgg._sum.total ?? 0).toLocaleString("en-IN")}`, change: "", note: "cumulative revenue" },
  ];
}

export async function getPendingActions() {
  const [pendingRetailerCount, latestPendingRetailer, underReviewCount, latestUnderReview] = await Promise.all([
    prisma.retailer.count({ where: { status: "PENDING" } }),
    prisma.retailer.findFirst({ where: { status: "PENDING" }, orderBy: { createdAt: "desc" } }),
    prisma.product.count({ where: { status: "UNDER_REVIEW" } }),
    prisma.product.findFirst({ where: { status: "UNDER_REVIEW" }, orderBy: { updatedAt: "desc" } }),
  ]);

  const actions = [];
  if (pendingRetailerCount > 0) {
    actions.push({
      title: `${pendingRetailerCount} Retailer Approval${pendingRetailerCount === 1 ? "" : "s"}`,
      action: "Review",
      detail: latestPendingRetailer?.name ?? "",
      href: "/admin/retailers",
    });
  }
  if (underReviewCount > 0) {
    actions.push({
      title: `${underReviewCount} Product Audit${underReviewCount === 1 ? "" : "s"}`,
      action: "Audit",
      detail: latestUnderReview?.name ?? "",
      href: "/admin/products",
    });
  }
  return actions;
}

const RELATIVE_UNITS: [number, Intl.RelativeTimeFormatUnit][] = [
  [60, "second"],
  [60, "minute"],
  [24, "hour"],
  [7, "day"],
];

function timeAgo(date: Date): string {
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "always" });
  let diff = (Date.now() - date.getTime()) / 1000;
  for (const [size, unit] of RELATIVE_UNITS) {
    if (Math.abs(diff) < size) return rtf.format(-Math.round(diff), unit);
    diff /= size;
  }
  return rtf.format(-Math.round(diff), "week");
}

export async function getActivityLog(limit = 10) {
  const entries = await prisma.activityLogEntry.findMany({ orderBy: { createdAt: "desc" }, take: limit });
  return entries.map((e) => ({ type: e.type, message: e.message, time: timeAgo(e.createdAt) }));
}
