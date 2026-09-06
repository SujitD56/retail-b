import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { NotFoundError } from "@/lib/errors.js";
import { eventBus, DomainEvents } from "@/lib/eventBus.js";
import { WEAVE_TYPE_FROM_LABEL } from "@/lib/enumLabels.js";
import * as repo from "./products.repository.js";
import { toAdminProductRow, toProductDTO, toRetailerCatalogRow } from "./products.mappers.js";
import type { CreateProductInput, UpdateProductInput } from "./products.schemas.js";

function slugify(name: string) {
  return `${name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${crypto.randomBytes(3).toString("hex")}`;
}

export async function listProducts(filters: { weaveType?: string; retailerId?: string; tag?: string; q?: string; page: number; pageSize: number }) {
  const where: Prisma.ProductWhereInput = {
    status: "ACTIVE",
    ...(filters.weaveType ? { weaveType: WEAVE_TYPE_FROM_LABEL[filters.weaveType] } : {}),
    ...(filters.retailerId ? { retailerId: filters.retailerId } : {}),
    ...(filters.tag ? { tags: { has: filters.tag } } : {}),
    ...(filters.q ? { name: { contains: filters.q, mode: "insensitive" } } : {}),
  };

  const [rows, total] = await Promise.all([
    repo.findMany(where, { skip: (filters.page - 1) * filters.pageSize, take: filters.pageSize }),
    repo.count(where),
  ]);

  return { items: rows.map(toProductDTO), total, page: filters.page, pageSize: filters.pageSize };
}

export async function getBySlug(slug: string) {
  const product = await repo.findBySlug(slug);
  return product ? toProductDTO(product) : null;
}

export async function getById(id: string) {
  const product = await repo.findById(id);
  return product ? toProductDTO(product) : null;
}

/** Public bulk lookup — cart/wishlist/orders only persist productIds and need the full Product[] to render. */
export async function getByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await repo.findManyByIds(ids);
  return rows.map(toProductDTO);
}

/**
 * Internal cross-module accessor — other modules (orders, events) need raw
 * price/stock/retailer fields to do their own business logic (checkout
 * pricing, stock decrements). They call this instead of importing
 * products.repository directly, keeping the module boundary at the service
 * layer rather than the database layer.
 */
export async function getManyRaw(ids: string[]) {
  const rows = await repo.findManyByIds(ids);
  return rows.map((p) => ({ id: p.id, retailerId: p.retailerId, name: p.name, price: Number(p.price), stockCount: p.stockCount, status: p.status }));
}

export async function getTrending(limit = 4) {
  const rows = await repo.findTrending(limit);
  return rows.map(toProductDTO);
}

export async function getRelated(productId: string, limit = 4) {
  const current = await repo.findById(productId);
  if (!current) {
    const fallback = await repo.findFallback(productId, limit);
    return fallback.map(toProductDTO);
  }
  const sameCategory = await repo.findSameWeaveType(current.weaveType, productId, limit);
  if (sameCategory.length >= limit) return sameCategory.slice(0, limit).map(toProductDTO);

  const rest = await repo.findFallback(productId, limit - sameCategory.length);
  const restFiltered = rest.filter((p) => !sameCategory.some((s) => s.id === p.id));
  return [...sameCategory, ...restFiltered].slice(0, limit).map(toProductDTO);
}

// ---------- Retailer-scoped ----------

export async function createForRetailer(retailerId: string, input: CreateProductInput) {
  const product = await repo.create({
    retailerId,
    slug: slugify(input.name),
    name: input.name,
    description: input.description,
    // Non-null: input.weaveType is already constrained to the known label
    // set by createProductSchema's zod enum, so the lookup can't miss.
    weaveType: WEAVE_TYPE_FROM_LABEL[input.weaveType]!,
    collectionLabel: input.collectionLabel,
    tags: input.tags,
    color: input.color,
    borderType: input.borderType,
    material: input.material,
    lengthWidth: input.lengthWidth,
    price: input.price,
    compareAtPrice: input.compareAtPrice,
    stockCount: input.stockCount,
    status: input.status,
    images: input.images,
  });
  eventBus.publish(DomainEvents.ProductCreated, { productId: product.id, retailerId });
  return toProductDTO(product);
}

export async function updateForRetailer(retailerId: string, productId: string, input: UpdateProductInput) {
  const owned = await repo.findOwnedById(productId, retailerId);
  if (!owned) throw new NotFoundError("Product not found");
  const updated = await repo.update(productId, {
    ...input,
    weaveType: input.weaveType ? WEAVE_TYPE_FROM_LABEL[input.weaveType] : undefined,
  });
  return toProductDTO(updated);
}

export async function deleteForRetailer(retailerId: string, productId: string) {
  const owned = await repo.findOwnedById(productId, retailerId);
  if (!owned) throw new NotFoundError("Product not found");
  await repo.remove(productId);
}

export async function listForRetailer(retailerId: string) {
  const products = await repo.findMany({ retailerId });
  const rows = await Promise.all(
    products.map(async (p) => toRetailerCatalogRow(p, await repo.orderCountByProduct(p.id))),
  );
  return {
    items: rows,
    summary: {
      all: rows.length,
      active: rows.filter((r) => r.status === "Active" || r.status === "Low Stock").length,
      draft: rows.filter((r) => r.status === "Draft").length,
      archived: rows.filter((r) => r.status === "Archived").length,
    },
  };
}

// ---------- Admin-scoped ----------

export async function listForAdmin(filters: { page: number; pageSize: number }) {
  const [rows, total] = await Promise.all([
    repo.findManyWithRetailer({}, { skip: (filters.page - 1) * filters.pageSize, take: filters.pageSize }),
    repo.count({}),
  ]);
  const items = await Promise.all(rows.map(async (p) => toAdminProductRow(p, await repo.orderCountByProduct(p.id))));
  return { items, total, page: filters.page, pageSize: filters.pageSize };
}

export async function setStatusAdmin(productId: string, status: "DRAFT" | "ACTIVE" | "UNDER_REVIEW" | "ARCHIVED") {
  const updated = await repo.update(productId, { status });
  return toProductDTO(updated);
}
