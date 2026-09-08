import { z } from "zod";

export const createRetailerCollectionSchema = z.object({
  name: z.string().min(3).max(120),
  description: z.string().min(10),
  status: z.enum(["draft", "active"]).default("draft"),
  coverImageUrl: z.string().url().optional(),
  productIds: z.array(z.string()).default([]),
});

export const updateRetailerCollectionSchema = createRetailerCollectionSchema.partial();
