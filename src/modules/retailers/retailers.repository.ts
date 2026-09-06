import { prisma } from "@/lib/prisma.js";
import type { Prisma, RetailerStatus } from "@prisma/client";

export function findApproved() {
  return prisma.retailer.findMany({ where: { status: "APPROVED" }, orderBy: { rating: "desc" } });
}

export function findBySlug(slug: string) {
  return prisma.retailer.findUnique({ where: { slug } });
}

export function findById(id: string) {
  return prisma.retailer.findUnique({ where: { id } });
}

export function findByUserId(userId: string) {
  return prisma.retailer.findUnique({ where: { userId } });
}

export function create(data: Prisma.RetailerCreateInput) {
  return prisma.retailer.create({ data });
}

export function update(id: string, data: Prisma.RetailerUpdateInput) {
  return prisma.retailer.update({ where: { id }, data });
}

export function findManyAdmin(where: Prisma.RetailerWhereInput = {}) {
  return prisma.retailer.findMany({ where, orderBy: { createdAt: "desc" } });
}

export function countStatus(status: RetailerStatus) {
  return prisma.retailer.count({ where: { status } });
}

export function countAll() {
  return prisma.retailer.count();
}

export function ordersServicedCount(retailerId: string) {
  return prisma.orderItem.count({ where: { retailerId } });
}
