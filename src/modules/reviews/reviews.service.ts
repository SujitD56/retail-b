import { prisma } from "@/lib/prisma.js";
import { NotFoundError } from "@/lib/errors.js";
import type { CreateProductReviewInput } from "./reviews.schemas.js";

function toReviewDTO(review: { id: string; productId: string | null; authorName: string; verified: boolean; rating: number; title: string | null; body: string; createdAt: Date }) {
  return {
    id: review.id,
    productId: review.productId ?? undefined,
    author: review.authorName,
    verified: review.verified,
    rating: review.rating,
    title: review.title ?? undefined,
    body: review.body,
    createdAt: review.createdAt.toISOString(),
  };
}

function computeBreakdown(ratings: number[]) {
  const total = ratings.length;
  const average = total === 0 ? 0 : Math.round((ratings.reduce((s, r) => s + r, 0) / total) * 10) / 10;
  const distribution = ([5, 4, 3, 2, 1] as const).map((stars) => ({
    stars,
    percent: total === 0 ? 0 : Math.round((ratings.filter((r) => r === stars).length / total) * 100),
  }));
  return { average, total, distribution };
}

export async function getProductReviews(productId: string) {
  const reviews = await prisma.review.findMany({ where: { productId }, orderBy: { createdAt: "desc" } });
  return reviews.map(toReviewDTO);
}

export async function getProductRatingBreakdown(productId: string) {
  const reviews = await prisma.review.findMany({ where: { productId }, select: { rating: true } });
  return computeBreakdown(reviews.map((r) => r.rating));
}

export async function getRetailerReviews(retailerId: string) {
  const reviews = await prisma.review.findMany({ where: { retailerId }, orderBy: { createdAt: "desc" } });
  return reviews.map((r) => ({ id: r.id, retailerId: r.retailerId, author: r.authorName, rating: r.rating, body: r.body, createdAt: r.createdAt.toISOString() }));
}

export async function getRetailerRatingBreakdown(retailerId: string) {
  const reviews = await prisma.review.findMany({ where: { retailerId }, select: { rating: true } });
  return computeBreakdown(reviews.map((r) => r.rating));
}

/** verified=true iff the reviewer has a delivered order containing this product — the same "Verified Purchase" badge shown on the PDP. */
export async function createProductReview(userId: string, userName: string, productId: string, input: CreateProductReviewInput) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new NotFoundError("Product not found");

  const verifiedPurchase = await prisma.orderItem.findFirst({
    where: { productId, order: { userId, status: "DELIVERED" } },
  });

  const review = await prisma.review.create({
    data: { productId, authorId: userId, authorName: userName, rating: input.rating, title: input.title, body: input.body, verified: Boolean(verifiedPurchase) },
  });

  const agg = await prisma.review.aggregate({ where: { productId }, _avg: { rating: true }, _count: true });
  await prisma.product.update({
    where: { id: productId },
    data: { rating: Math.round((agg._avg.rating ?? 0) * 10) / 10, reviewCount: agg._count },
  });

  return toReviewDTO(review);
}
