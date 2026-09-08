import { NotFoundError } from "@/lib/errors.js";
import * as repo from "./retailer-collections.repository.js";
import { toRetailerCollectionDTO, type RetailerCollectionDTO } from "./retailer-collections.mappers.js";
import type { z } from "zod";
import type { createRetailerCollectionSchema, updateRetailerCollectionSchema } from "./retailer-collections.schemas.js";

async function withPriceSummary(retailerId: string, collection: Awaited<ReturnType<typeof repo.findManyForRetailer>>[number]) {
  const summary = await repo.priceSummaryForProducts(retailerId, collection.productIds);
  return toRetailerCollectionDTO(collection, summary);
}

export async function listForRetailer(retailerId: string): Promise<RetailerCollectionDTO[]> {
  const collections = await repo.findManyForRetailer(retailerId);
  return Promise.all(collections.map((c) => withPriceSummary(retailerId, c)));
}

export async function createForRetailer(
  retailerId: string,
  input: z.infer<typeof createRetailerCollectionSchema>,
): Promise<RetailerCollectionDTO> {
  const created = await repo.create(retailerId, {
    name: input.name,
    description: input.description,
    status: input.status.toUpperCase() as "DRAFT" | "ACTIVE",
    coverImageUrl: input.coverImageUrl,
    productIds: input.productIds,
  });
  return withPriceSummary(retailerId, created);
}

export async function updateForRetailer(
  retailerId: string,
  id: string,
  input: z.infer<typeof updateRetailerCollectionSchema>,
): Promise<RetailerCollectionDTO> {
  const owned = await repo.findOwnedById(retailerId, id);
  if (!owned) throw new NotFoundError("Collection not found");

  const updated = await repo.updateById(id, {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.status !== undefined && { status: input.status.toUpperCase() as "DRAFT" | "ACTIVE" }),
    ...(input.coverImageUrl !== undefined && { coverImageUrl: input.coverImageUrl }),
    ...(input.productIds !== undefined && { productIds: input.productIds }),
  });
  return withPriceSummary(retailerId, updated);
}

export async function deleteForRetailer(retailerId: string, id: string): Promise<void> {
  const owned = await repo.findOwnedById(retailerId, id);
  if (!owned) throw new NotFoundError("Collection not found");
  await repo.deleteById(id);
}
