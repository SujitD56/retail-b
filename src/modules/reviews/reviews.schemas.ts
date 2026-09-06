import { z } from "zod";

export const createProductReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().optional(),
  body: z.string().min(10, "Tell other shoppers a bit more"),
});
export type CreateProductReviewInput = z.infer<typeof createProductReviewSchema>;
