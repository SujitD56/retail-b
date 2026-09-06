import { z } from "zod";

const weaveTypeEnum = z.enum([
  "Cotton Ilkal",
  "Silk Cotton",
  "Traditional Ilkal",
  "Contemporary Ilkal",
  "Wedding Saree",
  "Festive Saree",
]);

export const listProductsQuerySchema = z.object({
  weaveType: weaveTypeEnum.optional(),
  retailerId: z.string().optional(),
  tag: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(24),
});

const imageSchema = z.object({ url: z.string().url(), alt: z.string().min(1) });

export const createProductSchema = z.object({
  name: z.string().min(3),
  description: z.string().min(10),
  weaveType: weaveTypeEnum,
  collectionLabel: z.string().optional(),
  tags: z.array(z.string()).default([]),
  color: z.string().min(1),
  borderType: z.string().min(1),
  material: z.string().min(1),
  lengthWidth: z.string().min(1),
  price: z.number().positive(),
  compareAtPrice: z.number().positive().optional(),
  stockCount: z.number().int().min(0),
  images: z.array(imageSchema).min(1, "At least one image is required"),
  status: z.enum(["DRAFT", "ACTIVE"]).default("ACTIVE"),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial().extend({
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED", "UNDER_REVIEW"]).optional(),
});
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
