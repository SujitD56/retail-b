import { Router } from "express";
import { asyncHandler } from "@/lib/asyncHandler.js";
import { requireAuth } from "@/middleware/auth.js";
import { validate } from "@/middleware/validate.js";
import { UnauthorizedError } from "@/lib/errors.js";
import { getUserName } from "@/modules/auth/auth.service.js";
import * as service from "./reviews.service.js";
import { createProductReviewSchema } from "./reviews.schemas.js";

export const reviewsRouter = Router();

reviewsRouter.get(
  "/product/:productId",
  asyncHandler(async (req, res) => res.status(200).json({ items: await service.getProductReviews(req.params.productId as string) })),
);

reviewsRouter.get(
  "/product/:productId/rating-breakdown",
  asyncHandler(async (req, res) => res.status(200).json(await service.getProductRatingBreakdown(req.params.productId as string))),
);

reviewsRouter.post(
  "/product/:productId",
  requireAuth,
  validate(createProductReviewSchema),
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new UnauthorizedError();
    const name = await getUserName(req.auth.userId);
    const review = await service.createProductReview(req.auth.userId, name, req.params.productId as string, req.body);
    res.status(201).json({ review });
  }),
);

reviewsRouter.get(
  "/retailer/:retailerId",
  asyncHandler(async (req, res) => res.status(200).json({ items: await service.getRetailerReviews(req.params.retailerId as string) })),
);

reviewsRouter.get(
  "/retailer/:retailerId/rating-breakdown",
  asyncHandler(async (req, res) => res.status(200).json(await service.getRetailerRatingBreakdown(req.params.retailerId as string))),
);
