import type { EventEntry, HallOfFameEntry, MarketplaceEvent } from "@prisma/client";

/** Maps a DB row to exactly the `MarketplaceEvent` shape `types/index.ts` defines on the frontend. */
export function toEventDTO(event: MarketplaceEvent, participatingRetailers: number, totalEntries: number) {
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    tagline: event.tagline,
    bannerUrl: event.bannerUrl,
    status: event.status.toLowerCase() as "live" | "upcoming" | "ended",
    startsAt: event.startsAt.toISOString().slice(0, 10),
    endsAt: event.endsAt.toISOString().slice(0, 10),
    participatingRetailers,
    totalEntries,
    prizePool: event.prizePool,
    description: event.description,
  };
}

/** Maps a DB row to exactly the `EventEntry` shape `types/index.ts` defines on the frontend. `rank` is 1-based position in the votes-desc list the caller already sorted. */
export function toEntryDTO(entry: EventEntry, rank?: number) {
  return {
    id: entry.id,
    eventId: entry.eventId,
    retailerId: entry.retailerId,
    productId: entry.productId,
    title: entry.title,
    imageUrl: entry.imageUrl,
    votes: entry.votes,
    rank,
    submittedAt: entry.submittedAt.toISOString().slice(0, 10),
  };
}

export function toHallOfFameDTO(entry: HallOfFameEntry) {
  return { year: entry.year, entryTitle: entry.entryTitle, retailerId: entry.retailerId, imageUrl: entry.imageUrl, votes: entry.votes };
}
