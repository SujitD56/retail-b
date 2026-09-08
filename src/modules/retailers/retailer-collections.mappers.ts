import type { RetailerCollection } from "@prisma/client";

export interface RetailerCollectionDTO {
  id: string;
  name: string;
  description: string;
  status: "draft" | "active";
  coverImageUrl?: string;
  productIds: string[];
  productCount: number;
  priceRange: { min: number; max: number } | null;
  createdAt: string;
  updatedAt: string;
}

export function toRetailerCollectionDTO(
  collection: RetailerCollection,
  priceSummary: { count: number; minPrice: unknown; maxPrice: unknown },
): RetailerCollectionDTO {
  return {
    id: collection.id,
    name: collection.name,
    description: collection.description,
    // Single-word enum — lowercased inline rather than a lookup table, same
    // convention as Role/RetailerStatus/etc. in lib/enumLabels.ts.
    status: collection.status.toLowerCase() as "draft" | "active",
    coverImageUrl: collection.coverImageUrl ?? undefined,
    productIds: collection.productIds,
    productCount: priceSummary.count,
    priceRange:
      priceSummary.minPrice != null && priceSummary.maxPrice != null
        ? { min: Number(priceSummary.minPrice), max: Number(priceSummary.maxPrice) }
        : null,
    createdAt: collection.createdAt.toISOString(),
    updatedAt: collection.updatedAt.toISOString(),
  };
}
