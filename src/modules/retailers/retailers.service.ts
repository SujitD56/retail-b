import { prisma } from "@/lib/prisma.js";
import { hashPassword } from "@/lib/password.js";
import { encryptField } from "@/lib/crypto.js";
import { ConflictError, NotFoundError } from "@/lib/errors.js";
import { eventBus, DomainEvents } from "@/lib/eventBus.js";
import { WEAVE_TYPE_FROM_LABEL } from "@/lib/enumLabels.js";
import * as repo from "./retailers.repository.js";
import { toAdminRetailerRow, toRetailerDTO } from "./retailers.mappers.js";
import type { RegisterRetailerInput, UpdateRetailerSettingsInput } from "./retailers.schemas.js";

function slugify(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function listApproved() {
  const rows = await repo.findApproved();
  return rows.map(toRetailerDTO);
}

export async function getBySlug(slug: string) {
  const row = await repo.findBySlug(slug);
  return row ? toRetailerDTO(row) : null;
}

export async function getById(id: string) {
  const row = await repo.findById(id);
  return row ? toRetailerDTO(row) : null;
}

/** Used by other modules (products, orders, events) to resolve "the retailer profile owned by this logged-in user" — the sanctioned cross-module call, not a raw repository import. */
export async function getRetailerIdForUser(userId: string): Promise<string | null> {
  const retailer = await repo.findByUserId(userId);
  return retailer?.id ?? null;
}

export async function getMyProfile(userId: string) {
  const retailer = await repo.findByUserId(userId);
  return retailer ? toRetailerDTO(retailer) : null;
}

/**
 * Creates the User + pending Retailer application in one transaction. Bank
 * account number is AES-encrypted at rest (see lib/crypto.ts) — a stopgap
 * for a demo payout flow, not a substitute for a PCI-compliant processor.
 */
export async function register(input: RegisterRetailerInput) {
  const existingUser = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (existingUser) throw new ConflictError("An account with this email already exists");

  let slug = slugify(input.storeName);
  const slugTaken = await prisma.retailer.findUnique({ where: { slug } });
  if (slugTaken) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

  const passwordHash = await hashPassword(input.password);

  const retailer = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name: input.fullName, email: input.email.toLowerCase(), phone: input.mobile, passwordHash, role: "RETAILER" },
    });

    return tx.retailer.create({
      data: {
        userId: user.id,
        slug,
        name: input.storeName,
        location: `${input.city}, ${input.state}`,
        bio: input.storeDescription,
        storeDescription: input.storeDescription,
        primaryCategory: input.primaryCategory,
        pincode: input.pincode,
        specialties: [WEAVE_TYPE_FROM_LABEL[input.primaryCategory]!],
        status: "PENDING",
        registrationType: input.registrationType,
        gstin: input.gstin,
        gstExempt: input.gstExempt ?? false,
        pan: input.pan,
        registeredAddress: input.registeredAddress,
        yearsInBusiness: input.yearsInBusiness,
        monthlyRevenue: input.monthlyRevenue,
        accountHolderName: input.accountHolderName,
        bankName: input.bankName,
        accountNumberEnc: encryptField(input.accountNumber),
        ifsc: input.ifsc.toUpperCase(),
        accountType: input.accountType,
        upi: input.upi,
        payoutCycle: input.payoutCycle,
      },
    });
  });

  eventBus.publish(DomainEvents.RetailerRegistered, { retailerId: retailer.id, userId: retailer.userId });
  return { userId: retailer.userId, retailer: toRetailerDTO(retailer) };
}

export async function updateSettings(userId: string, input: UpdateRetailerSettingsInput) {
  const retailer = await repo.findByUserId(userId);
  if (!retailer) throw new NotFoundError("No retailer profile for this account");

  const updated = await repo.update(retailer.id, {
    ...input,
    specialties: input.specialties?.map((s) => WEAVE_TYPE_FROM_LABEL[s]!),
  });
  return toRetailerDTO(updated);
}

// ---------- Admin ----------

export async function listForAdmin() {
  const rows = await repo.findManyAdmin();
  const items = await Promise.all(
    rows.map(async (r) => toAdminRetailerRow(r, r.productCount, await repo.ordersServicedCount(r.id))),
  );
  const [all, verified, pending, suspended] = await Promise.all([
    repo.countAll(),
    repo.countStatus("APPROVED"),
    repo.countStatus("PENDING"),
    repo.countStatus("SUSPENDED"),
  ]);
  return { items, summary: { all, verified, pending, suspended } };
}

export async function moderate(retailerId: string, action: "approve" | "reject" | "suspend" | "reinstate", reason?: string) {
  const statusByAction = { approve: "APPROVED", reject: "REJECTED", suspend: "SUSPENDED", reinstate: "APPROVED" } as const;
  const updated = await repo.update(retailerId, {
    status: statusByAction[action],
    verified: action === "approve" || action === "reinstate",
    rejectionReason: action === "reject" ? reason : undefined,
  });

  eventBus.publish(action === "approve" ? DomainEvents.RetailerApproved : DomainEvents.RetailerRejected, {
    retailerId,
    action,
  });

  return toRetailerDTO(updated);
}
