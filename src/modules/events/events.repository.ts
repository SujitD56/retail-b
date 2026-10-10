import { prisma } from "@/lib/prisma.js";
import type { Prisma } from "@prisma/client";

export function findAll() {
  return prisma.marketplaceEvent.findMany({ orderBy: { startsAt: "desc" } });
}

export function findBySlug(slug: string) {
  return prisma.marketplaceEvent.findUnique({ where: { slug } });
}

export function findById(id: string) {
  return prisma.marketplaceEvent.findUnique({ where: { id } });
}

export function create(data: Prisma.MarketplaceEventCreateInput) {
  return prisma.marketplaceEvent.create({ data });
}

export function countEntries(eventId: string) {
  return prisma.eventEntry.count({ where: { eventId } });
}

export function countDistinctRetailers(eventId: string) {
  return prisma.eventEntry.findMany({ where: { eventId }, distinct: ["retailerId"], select: { retailerId: true } });
}

export function findEntries(eventId: string) {
  return prisma.eventEntry.findMany({ where: { eventId, status: "APPROVED" }, orderBy: { votes: "desc" } });
}

export function findEntryById(entryId: string) {
  return prisma.eventEntry.findUnique({ where: { id: entryId } });
}

export function countEntriesByRetailer(eventId: string, retailerId: string) {
  return prisma.eventEntry.count({ where: { eventId, retailerId } });
}

export function createEntry(data: { eventId: string; retailerId: string; productId: string; title: string; imageUrl: string; videoUrl?: string }) {
  return prisma.eventEntry.create({ data });
}

export function findEntriesByRetailer(retailerId: string) {
  return prisma.eventEntry.findMany({ where: { retailerId }, orderBy: { submittedAt: "desc" } });
}

export function findEntriesForModeration() {
  return prisma.eventEntry.findMany({
    where: { status: "PENDING" },
    orderBy: { submittedAt: "asc" },
    include: { retailer: { select: { name: true, verified: true } }, product: { select: { name: true } } },
  });
}

export function moderateEntry(entryId: string, status: "APPROVED" | "REJECTED") {
  return prisma.eventEntry.update({ where: { id: entryId }, data: { status } });
}

export async function castVote(entryId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.eventVote.create({ data: { entryId, userId } });
    return tx.eventEntry.update({ where: { id: entryId }, data: { votes: { increment: 1 } } });
  });
}

export function hasVoted(entryId: string, userId: string) {
  return prisma.eventVote.findUnique({ where: { entryId_userId: { entryId, userId } } });
}

export function findHallOfFame() {
  return prisma.hallOfFameEntry.findMany({ orderBy: { year: "desc" } });
}

export function sumEntryVotes(eventId: string) {
  return prisma.eventEntry.aggregate({ where: { eventId }, _sum: { votes: true } });
}

export async function countUniqueVoters(eventId: string) {
  const rows = await prisma.eventVote.findMany({ where: { entry: { eventId } }, distinct: ["userId"], select: { userId: true } });
  return rows.length;
}

function dayStart(daysAgo: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

/** Votes cast per day over the trailing `days` window — used for the admin event analytics chart. */
export async function getVotingTrend(eventId: string, days = 7) {
  const results = [];
  for (let i = days - 1; i >= 0; i--) {
    const start = dayStart(i);
    const end = dayStart(i - 1);
    const count = await prisma.eventVote.count({ where: { entry: { eventId }, createdAt: { gte: start, lt: end } } });
    results.push({ day: start.toLocaleDateString("en-US", { month: "short", day: "numeric" }), votes: count });
  }
  return results;
}

/** Same as getVotingTrend but scoped to one entry — powers a retailer's per-entry vote chart. */
export async function getVotingTrendForEntry(entryId: string, days = 7) {
  const results = [];
  for (let i = days - 1; i >= 0; i--) {
    const start = dayStart(i);
    const end = dayStart(i - 1);
    const count = await prisma.eventVote.count({ where: { entryId, createdAt: { gte: start, lt: end } } });
    results.push({ day: start.toLocaleDateString("en-US", { month: "short", day: "numeric" }), votes: count });
  }
  return results;
}

export async function retailerParticipation(eventId: string) {
  const grouped = await prisma.eventEntry.groupBy({ by: ["retailerId"], where: { eventId }, _count: { _all: true }, _sum: { votes: true } });
  const retailers = await prisma.retailer.findMany({
    where: { id: { in: grouped.map((g) => g.retailerId) } },
    select: { id: true, name: true, location: true },
  });
  return grouped.map((g) => {
    const retailer = retailers.find((r) => r.id === g.retailerId);
    return { retailerId: g.retailerId, name: retailer?.name ?? "Unknown", location: retailer?.location ?? "", entries: g._count._all, votes: g._sum.votes ?? 0 };
  });
}

export function findEntriesByRetailerWithEvent(retailerId: string) {
  return prisma.eventEntry.findMany({ where: { retailerId }, include: { event: true }, orderBy: { submittedAt: "desc" } });
}

export function findHallOfFameByRetailer(retailerId: string) {
  return prisma.hallOfFameEntry.findMany({ where: { retailerId }, include: { event: true }, orderBy: { year: "desc" } });
}

export function findUpcomingEvents(limit = 1) {
  return prisma.marketplaceEvent.findMany({ where: { status: "UPCOMING" }, orderBy: { startsAt: "asc" }, take: limit });
}
