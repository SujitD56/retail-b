// Prisma's enum @map() only changes what's stored in the DB column — the
// Prisma Client still returns the schema's enum *identifier*
// (e.g. "COTTON_ILKAL"), not the mapped display string. Every enum this API
// exposes over HTTP needs an explicit identifier <-> display-string table so
// responses match `types/index.ts` on the frontend exactly. Single-word
// enums (Role, RetailerStatus, EventStatus, PaymentMethod, PaymentStatus,
// EntryStatus) are just `.toLowerCase()`'d inline where used — only the
// multi-word ones need a real lookup table.

import type { OrderStatus, TrackingStatus, WeaveType } from "@prisma/client";

export const WEAVE_TYPE_LABEL: Record<WeaveType, string> = {
  COTTON_ILKAL: "Cotton Ilkal",
  SILK_COTTON: "Silk Cotton",
  TRADITIONAL_ILKAL: "Traditional Ilkal",
  CONTEMPORARY_ILKAL: "Contemporary Ilkal",
  WEDDING_SAREE: "Wedding Saree",
  FESTIVE_SAREE: "Festive Saree",
};

export const WEAVE_TYPE_FROM_LABEL: Record<string, WeaveType> = Object.fromEntries(
  Object.entries(WEAVE_TYPE_LABEL).map(([id, label]) => [label, id as WeaveType]),
);

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PROCESSING: "processing",
  SHIPPED: "shipped",
  IN_TRANSIT: "in transit",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
};

export const ORDER_STATUS_FROM_LABEL: Record<string, OrderStatus> = Object.fromEntries(
  Object.entries(ORDER_STATUS_LABEL).map(([id, label]) => [label, id as OrderStatus]),
);

export const TRACKING_STATUS_LABEL: Record<TrackingStatus, string> = {
  PLACED: "placed",
  ...ORDER_STATUS_LABEL,
};
