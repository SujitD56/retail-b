import { Router } from "express";
import { asyncHandler } from "@/lib/asyncHandler.js";
import { prisma } from "@/lib/prisma.js";
import { NotFoundError } from "@/lib/errors.js";

export const collectionsRouter = Router();

function toDTO(collection: { id: string; slug: string; title: string; eyebrow: string | null; description: string; coverUrl: string; heroImageUrl: string | null; products: { productId: string }[] }) {
  return {
    id: collection.id,
    slug: collection.slug,
    title: collection.title,
    eyebrow: collection.eyebrow ?? undefined,
    description: collection.description,
    coverUrl: collection.coverUrl,
    heroImageUrl: collection.heroImageUrl ?? undefined,
    productIds: collection.products.map((p) => p.productId),
  };
}

collectionsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const collections = await prisma.collection.findMany({
      include: { products: { orderBy: { position: "asc" }, select: { productId: true } } },
      orderBy: { createdAt: "asc" },
    });
    res.status(200).json({ items: collections.map(toDTO) });
  }),
);

collectionsRouter.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const collection = await prisma.collection.findUnique({
      where: { slug: req.params.slug as string },
      include: { products: { orderBy: { position: "asc" }, select: { productId: true } } },
    });
    if (!collection) throw new NotFoundError("Collection not found");
    res.status(200).json({ collection: toDTO(collection) });
  }),
);
