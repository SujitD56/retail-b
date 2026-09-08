import { prisma } from "@/lib/prisma.js";
import type { Prisma } from "@prisma/client";

export function findManyForRetailer(retailerId: string) {
  return prisma.retailerCollection.findMany({ where: { retailerId }, orderBy: { createdAt: "desc" } });
}

export function findOwnedById(retailerId: string, id: string) {
  return prisma.retailerCollection.findFirst({ where: { id, retailerId } });
}

export function create(retailerId: string, data: Omit<Prisma.RetailerCollectionUncheckedCreateInput, "retailerId">) {
  return prisma.retailerCollection.create({ data: { ...data, retailerId } });
}

// Ownership is checked by the caller (findOwnedById) before this runs —
// updating by id alone here, not id+retailerId together, sidesteps
// Prisma's `where` requiring only unique fields for update()/delete().
export function updateById(id: string, data: Prisma.RetailerCollectionUpdateInput) {
  return prisma.retailerCollection.update({ where: { id }, data });
}

export function deleteById(id: string) {
  return prisma.retailerCollection.delete({ where: { id } });
}

/** Product count + price range for a retailer collection's productIds, scoped defensively to the owning retailer's own products. */
export function priceSummaryForProducts(retailerId: string, productIds: string[]) {
  if (productIds.length === 0) return Promise.resolve({ count: 0, minPrice: null, maxPrice: null });
  return prisma.product
    .aggregate({
      where: { id: { in: productIds }, retailerId },
      _count: { _all: true },
      _min: { price: true },
      _max: { price: true },
    })
    .then((r) => ({ count: r._count._all, minPrice: r._min.price, maxPrice: r._max.price }));
}
