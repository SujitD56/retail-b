import { Router } from "express";
import { asyncHandler } from "@/lib/asyncHandler.js";
import { prisma } from "@/lib/prisma.js";
import { WEAVE_TYPE_LABEL } from "@/lib/enumLabels.js";

export const categoriesRouter = Router();

categoriesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
    res.status(200).json({
      items: categories.map((c) => ({ slug: c.slug, name: WEAVE_TYPE_LABEL[c.name], description: c.description, imageUrl: c.imageUrl })),
    });
  }),
);
