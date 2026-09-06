import { z } from "zod";

export const presignSchema = z.object({
  purpose: z.enum([
    "PRODUCT_IMAGE",
    "RETAILER_LOGO",
    "RETAILER_COVER",
    "RETAILER_DOCUMENT",
    "EVENT_BANNER",
    "EVENT_ENTRY",
    "AVATAR",
  ]),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/avif"]),
});
export type PresignInput = z.infer<typeof presignSchema>;
