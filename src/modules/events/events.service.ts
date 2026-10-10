import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { BadRequestError, ConflictError, NotFoundError } from "@/lib/errors.js";
import { eventBus, DomainEvents } from "@/lib/eventBus.js";
import * as productsService from "@/modules/products/products.service.js";
import * as repo from "./events.repository.js";
import { toEntryDTO, toEventDTO, toHallOfFameDTO, toModerationEntryDTO } from "./events.mappers.js";
import type { CreateEventInput, SubmitEntryInput } from "./events.schemas.js";

function slugify(title: string) {
  return `${title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${crypto.randomBytes(2).toString("hex")}`;
}

async function withCounts(event: Awaited<ReturnType<typeof repo.findById>>) {
  if (!event) return null;
  const [totalEntries, retailers] = await Promise.all([repo.countEntries(event.id), repo.countDistinctRetailers(event.id)]);
  return toEventDTO(event, retailers.length, totalEntries);
}

export async function listEvents() {
  const events = await repo.findAll();
  return Promise.all(events.map((e) => withCounts(e)));
}

export async function getBySlug(slug: string) {
  const event = await repo.findBySlug(slug);
  return withCounts(event);
}

export async function getById(id: string) {
  const event = await repo.findById(id);
  return withCounts(event);
}

export async function createEvent(input: CreateEventInput) {
  const event = await repo.create({ ...input, slug: slugify(input.title), config: input.config as Prisma.InputJsonValue | undefined });
  return withCounts(event);
}

/** Entries are returned votes-desc with a 1-based rank — the same ordering the leaderboard/entry pages read. */
export async function getEntries(eventId: string) {
  const entries = await repo.findEntries(eventId);
  return entries.map((entry, i) => toEntryDTO(entry, i + 1));
}

export async function getEntry(entryId: string) {
  const entry = await repo.findEntryById(entryId);
  if (!entry) throw new NotFoundError("Entry not found");
  const ranked = await repo.findEntries(entry.eventId);
  const rank = ranked.findIndex((e) => e.id === entryId) + 1;
  return toEntryDTO(entry, rank || undefined);
}

export async function submitEntry(retailerId: string, eventId: string, input: SubmitEntryInput) {
  const event = await repo.findById(eventId);
  if (!event) throw new NotFoundError("Event not found");
  if (event.status === "ENDED") throw new BadRequestError("This event is no longer accepting entries");

  if (event.maxEntriesPerRetailer) {
    const count = await repo.countEntriesByRetailer(eventId, retailerId);
    if (count >= event.maxEntriesPerRetailer) {
      throw new BadRequestError(`You've reached the maximum of ${event.maxEntriesPerRetailer} entries for this event`);
    }
  }

  const entry = await repo.createEntry({ eventId, retailerId, productId: input.productId, title: input.title, imageUrl: input.imageUrl, videoUrl: input.videoUrl });
  return toEntryDTO(entry);
}

export async function listMyEntries(retailerId: string) {
  const entries = await repo.findEntriesByRetailer(retailerId);
  return entries.map((e) => toEntryDTO(e));
}

export async function listForModeration() {
  const entries = await repo.findEntriesForModeration();
  return entries.map(toModerationEntryDTO);
}

export async function moderateEntry(entryId: string, action: "approve" | "reject") {
  const entry = await repo.moderateEntry(entryId, action === "approve" ? "APPROVED" : "REJECTED");
  return toEntryDTO(entry);
}

export async function vote(entryId: string, userId: string) {
  const entry = await repo.findEntryById(entryId);
  if (!entry) throw new NotFoundError("Entry not found");

  const existing = await repo.hasVoted(entryId, userId);
  if (existing) throw new ConflictError("You've already voted for this entry");

  const updated = await repo.castVote(entryId, userId);
  eventBus.publish(DomainEvents.EventVoteCast, { entryId, userId, votes: updated.votes });
  return toEntryDTO(updated);
}

export async function getHasVoted(entryId: string, userId: string) {
  return Boolean(await repo.hasVoted(entryId, userId));
}

export async function getHallOfFame() {
  const entries = await repo.findHallOfFame();
  return entries.map(toHallOfFameDTO);
}

/** Real, DB-derived analytics for one event — everything here comes from actual entries/votes, no hand-authored numbers. */
export async function getEventAnalytics(eventId: string) {
  const event = await repo.findById(eventId);
  if (!event) throw new NotFoundError("Event not found");

  const [totalEntries, votesAgg, uniqueVoters, votingTrend, topEntries, participation] = await Promise.all([
    repo.countEntries(eventId),
    repo.sumEntryVotes(eventId),
    repo.countUniqueVoters(eventId),
    repo.getVotingTrend(eventId),
    repo.findEntries(eventId),
    repo.retailerParticipation(eventId),
  ]);

  return {
    totalEntries,
    totalVotes: votesAgg._sum.votes ?? 0,
    uniqueVoters,
    votingTrend,
    topEntries: topEntries.slice(0, 5).map((e) => ({ title: e.title, votes: e.votes })),
    retailerParticipation: participation.sort((a, b) => b.votes - a.votes),
  };
}

/** 1-based rank of `entryId` within its own event's approved, votes-desc leaderboard — null if it isn't in that list (e.g. not yet approved). */
async function rankWithinEvent(eventId: string, entryId: string) {
  const ranked = await repo.findEntries(eventId);
  const idx = ranked.findIndex((e) => e.id === entryId);
  return idx === -1 ? null : idx + 1;
}

/** A retailer's own events dashboard — stats, current live challenge, next upcoming event, past results, and rule-based achievements. All computed from their real entries/votes/hall-of-fame rows. */
export async function getMyEventStats(retailerId: string) {
  const entries = await repo.findEntriesByRetailerWithEvent(retailerId);
  const liveEntries = entries.filter((e) => e.event.status === "LIVE");
  const endedEntries = entries.filter((e) => e.event.status === "ENDED");
  const totalVotes = entries.reduce((sum, e) => sum + e.votes, 0);

  const eventIds = [...new Set(entries.map((e) => e.eventId))];
  const ranks = new Map<string, number | null>();
  await Promise.all(
    entries.map(async (e) => {
      ranks.set(e.id, await rankWithinEvent(e.eventId, e.id));
    }),
  );
  const allRanks = [...ranks.values()].filter((r): r is number => r !== null);
  const bestRank = allRanks.length ? Math.min(...allRanks) : null;

  const liveEvent = liveEntries[0]?.event ?? null;
  const liveEventEntries = liveEvent ? liveEntries.filter((e) => e.eventId === liveEvent.id) : [];
  const liveEventRanks = liveEventEntries.map((e) => ranks.get(e.id)).filter((r): r is number => r !== null && r !== undefined);
  const liveChallenge = liveEvent
    ? {
        title: liveEvent.title,
        endsAt: liveEvent.endsAt.toISOString().slice(0, 10),
        entries: liveEventEntries.length,
        bestRank: liveEventRanks.length ? Math.min(...liveEventRanks) : null,
        bestEntryVotes: liveEventEntries.length ? Math.max(...liveEventEntries.map((e) => e.votes)) : 0,
      }
    : null;

  const [upcoming] = await repo.findUpcomingEvents(1);
  const upcomingEvent = upcoming
    ? { title: upcoming.title, registrationStart: (upcoming.registrationStart ?? upcoming.startsAt).toISOString().slice(0, 10) }
    : null;

  const pastEventIds = [...new Set(endedEntries.map((e) => e.eventId))];
  const hallOfFame = await repo.findHallOfFameByRetailer(retailerId);
  const pastPerformance = pastEventIds.map((eventId) => {
    const myEntries = endedEntries.filter((e) => e.eventId === eventId);
    const event = myEntries[0]!.event;
    const eventRanks = myEntries.map((e) => ranks.get(e.id)).filter((r): r is number => r !== null && r !== undefined);
    const won = hallOfFame.find((h) => h.eventId === eventId);
    return {
      event: event.title,
      entries: myEntries.length,
      bestRank: eventRanks.length ? `#${Math.min(...eventRanks)}` : "—",
      votes: myEntries.reduce((s, e) => s + e.votes, 0),
      prize: won ? event.prizePool : "—",
    };
  });

  const achievements: { title: string; subtitle: string; icon: string }[] = hallOfFame.map((h) => ({
    title: "Event Winner",
    subtitle: h.event?.title ?? h.entryTitle,
    icon: "trophy",
  }));
  if (allRanks.some((r) => r <= 5)) {
    achievements.push({ title: "Top 5 Finalist", subtitle: "Ranked in the top 5 of a style challenge", icon: "star" });
  }
  if (entries.length >= 10) {
    achievements.push({ title: "Prolific Creator", subtitle: `${entries.length}+ entries submitted`, icon: "film" });
  }
  const bigEntry = entries.find((e) => e.votes >= 5000);
  if (bigEntry) {
    achievements.push({ title: "Vote Magnet", subtitle: `5K+ votes on "${bigEntry.title}"`, icon: "thumbs-up" });
  }

  return {
    activeEvents: new Set(liveEntries.map((e) => e.eventId)).size,
    totalEntries: entries.length,
    totalVotes,
    bestRank: bestRank ? `#${bestRank}` : "—",
    liveChallenge,
    upcomingEvent,
    pastPerformance,
    achievements,
  };
}

/** Per-entry performance for the retailer that owns it — votes, leaderboard rank, a 7-day vote trend, and the tagged product's real catalog info. */
export async function getMyEntryAnalytics(retailerId: string, entryId: string) {
  const entry = await repo.findEntryById(entryId);
  if (!entry || entry.retailerId !== retailerId) throw new NotFoundError("Entry not found");

  const [rank, voteTrend, product] = await Promise.all([
    rankWithinEvent(entry.eventId, entry.id),
    repo.getVotingTrendForEntry(entry.id),
    productsService.getById(entry.productId),
  ]);

  return {
    entryId: entry.id,
    entryTitle: entry.title,
    votes: entry.votes,
    rank,
    voteTrend,
    taggedProduct: product ? { name: product.name, price: product.price, image: product.images[0]?.url ?? "", slug: product.slug } : null,
  };
}
