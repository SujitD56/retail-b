import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "@/lib/asyncHandler.js";
import { requireAuth } from "@/middleware/auth.js";
import { validate } from "@/middleware/validate.js";
import { prisma } from "@/lib/prisma.js";
import { UnauthorizedError } from "@/lib/errors.js";

export const wishlistRouter = Router();
wishlistRouter.use(requireAuth);

wishlistRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new UnauthorizedError();
    const items = await prisma.wishlistItem.findMany({ where: { userId: req.auth.userId } });
    res.status(200).json({ productIds: items.map((i) => i.productId) });
  }),
);

wishlistRouter.post(
  "/toggle",
  validate(z.object({ productId: z.string() })),
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new UnauthorizedError();
    const { productId } = req.body;
    const existing = await prisma.wishlistItem.findUnique({ where: { userId_productId: { userId: req.auth.userId, productId } } });
    if (existing) {
      await prisma.wishlistItem.delete({ where: { id: existing.id } });
      res.status(200).json({ wishlisted: false });
      return;
    }
    await prisma.wishlistItem.create({ data: { userId: req.auth.userId, productId } });
    res.status(200).json({ wishlisted: true });
  }),
);

wishlistRouter.delete(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new UnauthorizedError();
    await prisma.wishlistItem.deleteMany({ where: { userId: req.auth.userId } });
    res.status(204).send();
  }),
);
