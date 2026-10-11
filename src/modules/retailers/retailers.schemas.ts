import { z } from "zod";

const weaveTypeEnum = z.enum([
  "Cotton Ilkal",
  "Silk Cotton",
  "Traditional Ilkal",
  "Contemporary Ilkal",
  "Wedding Saree",
  "Festive Saree",
]);

// One combined submission for the 5-step onboarding wizard — the steps are
// client-side UI state; the account + application are created together in a
// single transaction once the wizard completes (see retailers.service.ts).
export const registerRetailerSchema = z.object({
  // Step 1 — account
  fullName: z.string().min(2),
  email: z.string().email(),
  // Indian mobile number: 10 digits starting 6-9, with an optional +91/91/0
  // prefix — spaces/dashes anywhere are stripped before matching.
  mobile: z.string().refine((v) => /^(?:\+?91|0)?[6-9]\d{9}$/.test(v.replace(/[\s-]/g, "")), "Enter a valid 10-digit mobile number"),
  password: z.string().min(8),
  // Step 2 — store profile
  storeName: z.string().min(2),
  storeDescription: z.string().min(10),
  primaryCategory: weaveTypeEnum,
  city: z.string().min(2),
  state: z.string().min(1),
  pincode: z
    .string()
    .regex(/^\d{6}$/)
    .refine((v) => !/^(\d)\1{5}$/.test(v), "Enter a valid 6-digit PIN code"),
  // Step 3 — business/tax details
  registrationType: z.string().min(1),
  gstin: z.string().optional(),
  gstExempt: z.boolean().optional(),
  pan: z.string().min(10),
  registeredAddress: z.string().min(5),
  yearsInBusiness: z.string().min(1),
  monthlyRevenue: z.string().min(1),
  // Step 4 — verification documents (already-uploaded S3 URLs)
  documentUrls: z.array(z.string().url()).default([]),
  // Step 5 — payout details
  accountHolderName: z.string().min(2),
  bankName: z.string().min(2),
  accountNumber: z.string().min(6),
  ifsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/i),
  accountType: z.enum(["savings", "current"]),
  upi: z.string().optional(),
  payoutCycle: z.string().min(1),
});
export type RegisterRetailerInput = z.infer<typeof registerRetailerSchema>;

export const updateRetailerSettingsSchema = z.object({
  name: z.string().min(2).optional(),
  bio: z.string().min(10).optional(),
  location: z.string().min(2).optional(),
  logoUrl: z.string().url().optional(),
  coverUrl: z.string().url().optional(),
  specialties: z.array(weaveTypeEnum).optional(),
  heroImageUrl: z.string().url().optional(),
  storyImageUrl: z.string().url().optional(),
  storyTitle: z.string().optional(),
  storyParagraphs: z.array(z.string()).optional(),
  foundedYear: z.number().int().optional(),
});
export type UpdateRetailerSettingsInput = z.infer<typeof updateRetailerSettingsSchema>;

export const moderateRetailerSchema = z.object({
  action: z.enum(["approve", "reject", "suspend", "reinstate"]),
  reason: z.string().optional(),
});
