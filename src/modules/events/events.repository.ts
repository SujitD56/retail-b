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
  return prisma.eventEntry.findMany({ where: { status: "PENDING" }, orderBy: { submittedAt: "asc" } });
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
