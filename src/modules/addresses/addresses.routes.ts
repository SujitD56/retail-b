import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "@/lib/asyncHandler.js";
import { requireAuth } from "@/middleware/auth.js";
import { validate } from "@/middleware/validate.js";
import { prisma } from "@/lib/prisma.js";
import { NotFoundError, UnauthorizedError } from "@/lib/errors.js";

export const addressesRouter = Router();
addressesRouter.use(requireAuth);

const addressSchema = z.object({
  fullName: z.string().min(2),
  line1: z.string().min(4),
  city: z.string().min(2),
  state: z.string().min(2),
  postalCode: z
    .string()
    .regex(/^\d{6}$/)
    .refine((v) => !/^(\d)\1{5}$/.test(v), "Enter a valid 6-digit PIN code"),
  phone: z.string().refine((v) => /^(?:\+?91|0)?[6-9]\d{9}$/.test(v.replace(/[\s-]/g, "")), "Enter a valid 10-digit mobile number"),
  isDefault: z.boolean().optional(),
});

function toDTO(a: { id: string; fullName: string; line1: string; city: string; state: string; postalCode: string; phone: string; isDefault: boolean }) {
  return { id: a.id, fullName: a.fullName, line1: a.line1, city: a.city, state: a.state, postalCode: a.postalCode, phone: a.phone, isDefault: a.isDefault };
}

addressesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new UnauthorizedError();
    const items = await prisma.address.findMany({ where: { userId: req.auth.userId }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });
    res.status(200).json({ items: items.map(toDTO) });
  }),
);

addressesRouter.post(
  "/",
  validate(addressSchema),
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new UnauthorizedError();
    const userId = req.auth.userId;
    const existingCount = await prisma.address.count({ where: { userId } });
    // The very first address a customer saves becomes their default
    // automatically — there's otherwise no default at all until they
    // explicitly set one, which breaks checkout's "pre-select the default
    // address" behavior for everyone's first saved address.
    const isDefault = req.body.isDefault === true || existingCount === 0;
    if (isDefault) await prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    const created = await prisma.address.create({ data: { ...req.body, userId, isDefault } });
    res.status(201).json({ address: toDTO(created) });
  }),
);

addressesRouter.patch(
  "/:id/default",
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new UnauthorizedError();
    const userId = req.auth.userId;
    const address = await prisma.address.findUnique({ where: { id: req.params.id as string } });
    if (!address || address.userId !== userId) throw new NotFoundError("Address not found");
    await prisma.$transaction([
      prisma.address.updateMany({ where: { userId }, data: { isDefault: false } }),
      prisma.address.update({ where: { id: address.id }, data: { isDefault: true } }),
    ]);
    res.status(200).json({ ok: true });
  }),
);

addressesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new UnauthorizedError();
    await prisma.address.deleteMany({ where: { id: req.params.id as string, userId: req.auth.userId } });
    res.status(204).send();
  }),
);
