import { prisma } from "@/lib/prisma.js";
import type { Prisma, ProductLifecycle, WeaveType } from "@prisma/client";

const withImages = { images: { orderBy: { position: "asc" as const } } };

export function findMany(where: Prisma.ProductWhereInput, opts?: { skip?: number; take?: number }) {
  return prisma.product.findMany({ where, include: withImages, orderBy: { createdAt: "desc" }, ...opts });
}

export function findManyWithRetailer(where: Prisma.ProductWhereInput, opts?: { skip?: number; take?: number }) {
  return prisma.product.findMany({
    where,
    include: { ...withImages, retailer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    ...opts,
  });
}

export function count(where: Prisma.ProductWhereInput) {
  return prisma.product.count({ where });
}

export function findBySlug(slug: string) {
  return prisma.product.findUnique({ where: { slug }, include: withImages });
}

export function findById(id: string) {
  return prisma.product.findUnique({ where: { id }, include: withImages });
}

export function findManyByIds(ids: string[]) {
  return prisma.product.findMany({ where: { id: { in: ids } }, include: withImages });
}

export function findTrending(limit: number) {
  return prisma.product.findMany({
    where: { tags: { has: "trending" }, status: "ACTIVE" },
    include: withImages,
    take: limit,
    orderBy: { createdAt: "desc" },
  });
}

export function findSameWeaveType(weaveType: WeaveType, excludeId: string, limit: number) {
  return prisma.product.findMany({
    where: { weaveType, id: { not: excludeId }, status: "ACTIVE" },
    include: withImages,
    take: limit,
  });
}

export function findFallback(excludeId: string, limit: number) {
  return prisma.product.findMany({ where: { id: { not: excludeId }, status: "ACTIVE" }, include: withImages, take: limit });
}

interface CreateProductData {
  retailerId: string;
  slug: string;
  name: string;
  description: string;
  weaveType: WeaveType;
  collectionLabel?: string;
  tags: string[];
  color: string;
  borderType: string;
  material: string;
  lengthWidth: string;
  price: number;
  compareAtPrice?: number;
  stockCount: number;
  status: ProductLifecycle;
  images: { url: string; alt: string }[];
}

export function create(data: CreateProductData) {
  const { images, ...rest } = data;
  return prisma.product.create({
    data: { ...rest, images: { create: images.map((img, i) => ({ ...img, position: i })) } },
    include: withImages,
  });
}

/** Ownership check — Prisma's unique `where` can't combine id+retailerId directly, so callers must verify with this before update()/remove(). */
export function findOwnedById(id: string, retailerId: string) {
  return prisma.product.findFirst({ where: { id, retailerId }, include: withImages });
}

export function update(id: string, data: Partial<CreateProductData>) {
  const { images, ...rest } = data;
  return prisma.product.update({
    where: { id },
    data: {
      ...rest,
      ...(images
        ? { images: { deleteMany: {}, create: images.map((img, i) => ({ ...img, position: i })) } }
        : {}),
    },
    include: withImages,
  });
}

export function remove(id: string) {
  return prisma.product.delete({ where: { id } });
}

export function countByRetailer(retailerId: string) {
  return prisma.product.count({ where: { retailerId } });
}

export function orderCountByProduct(productId: string) {
  return prisma.orderItem.count({ where: { productId } });
}
