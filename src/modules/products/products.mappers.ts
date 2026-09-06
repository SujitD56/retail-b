import type { Product, ProductImage } from "@prisma/client";
import { WEAVE_TYPE_LABEL } from "@/lib/enumLabels.js";

type ProductWithImages = Product & { images: ProductImage[] };

/** Maps a DB row to exactly the `Product` shape `types/index.ts` defines on the frontend — the API's public contract. */
export function toProductDTO(product: ProductWithImages) {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    retailerId: product.retailerId,
    weaveType: WEAVE_TYPE_LABEL[product.weaveType],
    price: Number(product.price),
    compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice) : undefined,
    images: product.images.map((img) => ({ url: img.url, alt: img.alt })),
    color: product.color,
    borderType: product.borderType,
    material: product.material,
    lengthWidth: product.lengthWidth,
    rating: product.rating,
    reviewCount: product.reviewCount,
    // inStock is DERIVED from stockCount, never stored redundantly.
    inStock: product.stockCount > 0 && product.status === "ACTIVE",
    stockCount: product.stockCount,
    tags: product.tags,
    description: product.description,
    createdAt: product.createdAt.toISOString(),
  };
}

export type ProductDTO = ReturnType<typeof toProductDTO>;

const LIFECYCLE_LABEL = { DRAFT: "Draft", ACTIVE: "Active", UNDER_REVIEW: "Under Review", ARCHIVED: "Archived" } as const;

/** Display status for admin/retailer tables — "Out of Stock"/"Low Stock" are derived, never stored. */
export function deriveDisplayStatus(product: Pick<Product, "status" | "stockCount">): string {
  if (product.status === "ACTIVE" && product.stockCount === 0) return "Out of Stock";
  if (product.status === "ACTIVE" && product.stockCount > 0 && product.stockCount <= 3) return "Low Stock";
  return LIFECYCLE_LABEL[product.status];
}

export function toAdminProductRow(product: ProductWithImages & { retailer: { name: string } }, ordersCount: number) {
  return {
    id: product.id,
    name: product.name,
    sku: `ILK-PR-${product.id.slice(-4).toUpperCase()}`,
    retailer: product.retailer.name,
    category: WEAVE_TYPE_LABEL[product.weaveType],
    price: Number(product.price),
    stock: product.stockCount,
    status: deriveDisplayStatus(product),
    rating: product.rating,
    imageUrl: product.images[0]?.url ?? "",
    orders: ordersCount,
  };
}

export function toRetailerCatalogRow(product: ProductWithImages, ordersCount: number) {
  return {
    id: product.id,
    imageUrl: product.images[0]?.url ?? "",
    name: product.name,
    collection: product.collectionLabel ?? WEAVE_TYPE_LABEL[product.weaveType],
    price: Number(product.price),
    stock: product.stockCount,
    status: deriveDisplayStatus(product),
    orders: ordersCount,
  };
}
