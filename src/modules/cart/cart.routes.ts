import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "@/lib/asyncHandler.js";
import { requireAuth } from "@/middleware/auth.js";
import { validate } from "@/middleware/validate.js";
import { prisma } from "@/lib/prisma.js";
import { UnauthorizedError } from "@/lib/errors.js";

export const cartRouter = Router();
cartRouter.use(requireAuth);

function toDTO(items: { productId: string; quantity: number }[]) {
  return items.map((i) => ({ productId: i.productId, quantity: i.quantity }));
}

cartRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new UnauthorizedError();
    const items = await prisma.cartItem.findMany({ where: { userId: req.auth.userId } });
    res.status(200).json({ items: toDTO(items) });
  }),
);

cartRouter.post(
  "/items",
  validate(z.object({ productId: z.string(), quantity: z.number().int().positive().default(1) })),
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new UnauthorizedError();
    const { productId, quantity } = req.body;
    const item = await prisma.cartItem.upsert({
      where: { userId_productId: { userId: req.auth.userId, productId } },
      update: { quantity: { increment: quantity } },
      create: { userId: req.auth.userId, productId, quantity },
    });
    res.status(200).json({ item: { productId: item.productId, quantity: item.quantity } });
  }),
);

cartRouter.put(
  "/items/:productId",
  validate(z.object({ quantity: z.number().int().min(0) })),
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new UnauthorizedError();
    const productId = req.params.productId as string;
    if (req.body.quantity <= 0) {
      await prisma.cartItem.deleteMany({ where: { userId: req.auth.userId, productId } });
      res.status(204).send();
      return;
    }
    const item = await prisma.cartItem.upsert({
      where: { userId_productId: { userId: req.auth.userId, productId } },
      update: { quantity: req.body.quantity },
      create: { userId: req.auth.userId, productId, quantity: req.body.quantity },
    });
    res.status(200).json({ item: { productId: item.productId, quantity: item.quantity } });
  }),
);

cartRouter.delete(
  "/items/:productId",
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new UnauthorizedError();
    await prisma.cartItem.deleteMany({ where: { userId: req.auth.userId, productId: req.params.productId as string } });
    res.status(204).send();
  }),
);

cartRouter.delete(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new UnauthorizedError();
    await prisma.cartItem.deleteMany({ where: { userId: req.auth.userId } });
    res.status(204).send();
  }),
);

/** Merges a locally-persisted guest cart into the server cart right after login — see lib/store/cart.ts on the frontend. */
cartRouter.post(
  "/merge",
  validate(z.object({ items: z.array(z.object({ productId: z.string(), quantity: z.number().int().positive() })) })),
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new UnauthorizedError();
    const userId = req.auth.userId;
    await prisma.$transaction(
      req.body.items.map((item: { productId: string; quantity: number }) =>
        prisma.cartItem.upsert({
          where: { userId_productId: { userId, productId: item.productId } },
          update: { quantity: { increment: item.quantity } },
          create: { userId, productId: item.productId, quantity: item.quantity },
        }),
      ),
    );
    const items = await prisma.cartItem.findMany({ where: { userId } });
    res.status(200).json({ items: toDTO(items) });
  }),
);
