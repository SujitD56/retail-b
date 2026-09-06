import { z } from "zod";

export const createEventSchema = z.object({
  title: z.string().min(3),
  tagline: z.string().min(3),
  bannerUrl: z.string().url(),
  description: z.string().min(10),
  category: z.string().optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  prizePool: z.string().min(1),
  registrationStart: z.coerce.date().optional(),
  registrationEnd: z.coerce.date().optional(),
  submissionStart: z.coerce.date().optional(),
  submissionEnd: z.coerce.date().optional(),
  votingStart: z.coerce.date().optional(),
  votingEnd: z.coerce.date().optional(),
  entryFormat: z.string().optional(),
  maxEntriesPerRetailer: z.number().int().positive().optional(),
  // Admin-authored presentation config (toggles/prize copy/jury panel) —
  // stored as-is in the JSONB `config` column, see schema.prisma.
  config: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(["UPCOMING", "LIVE", "ENDED"]).default("UPCOMING"),
});
export type CreateEventInput = z.infer<typeof createEventSchema>;

export const submitEntrySchema = z.object({
  productId: z.string(),
  title: z.string().min(3),
  imageUrl: z.string().url(),
  videoUrl: z.string().url().optional(),
});
export type SubmitEntryInput = z.infer<typeof submitEntrySchema>;

export const moderateEntrySchema = z.object({
  action: z.enum(["approve", "reject"]),
});
