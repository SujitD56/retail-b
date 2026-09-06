import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { BadRequestError, ConflictError, NotFoundError } from "@/lib/errors.js";
import { eventBus, DomainEvents } from "@/lib/eventBus.js";
import * as repo from "./events.repository.js";
import { toEntryDTO, toEventDTO, toHallOfFameDTO } from "./events.mappers.js";
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
  return entries.map((e) => toEntryDTO(e));
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
