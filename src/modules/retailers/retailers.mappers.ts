import type { Retailer } from "@prisma/client";
import { WEAVE_TYPE_LABEL } from "@/lib/enumLabels.js";

/** Maps a DB row to exactly the `Retailer` shape `types/index.ts` defines on the frontend. */
export function toRetailerDTO(retailer: Retailer) {
  return {
    id: retailer.id,
    slug: retailer.slug,
    name: retailer.name,
    logoUrl: retailer.logoUrl ?? "",
    coverUrl: retailer.coverUrl ?? "",
    location: retailer.location,
    verified: retailer.verified,
    rating: retailer.rating,
    reviewCount: retailer.reviewCount,
    productCount: retailer.productCount,
    memberSince: retailer.memberSince.toISOString().slice(0, 10),
    bio: retailer.bio,
    specialties: retailer.specialties.map((s) => WEAVE_TYPE_LABEL[s]),
    status: retailer.status.toLowerCase() as "approved" | "pending" | "rejected" | "suspended",
    totalSales: Number(retailer.totalSales),
    heroImageUrl: retailer.heroImageUrl ?? undefined,
    storyImageUrl: retailer.storyImageUrl ?? undefined,
    foundedYear: retailer.foundedYear ?? undefined,
    storyTitle: retailer.storyTitle ?? undefined,
    storyParagraphs: retailer.storyParagraphs.length ? retailer.storyParagraphs : undefined,
    ordersFulfilled: retailer.ordersFulfilled,
  };
}

const ADMIN_STATUS_LABEL = { APPROVED: "Verified", PENDING: "Pending", REJECTED: "Rejected", SUSPENDED: "Suspended" } as const;

export function toAdminRetailerRow(retailer: Retailer, productsListed: number, ordersServiced: number) {
  return {
    id: retailer.id,
    name: retailer.name,
    weaverId: `#ILK-RT-${retailer.id.slice(-4).toUpperCase()}`,
    status: ADMIN_STATUS_LABEL[retailer.status],
    location: retailer.location,
    productsListed,
    ordersServiced,
    rating: retailer.rating,
    joinedDate: retailer.memberSince.toISOString().slice(0, 10),
  };
}
