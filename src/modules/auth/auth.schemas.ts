import { z } from "zod";

// Indian mobile number: 10 digits starting 6-9, with an optional +91/91/0
// prefix — spaces/dashes anywhere are stripped before matching.
const phoneSchema = z
  .string()
  .refine((v) => /^(?:\+?91|0)?[6-9]\d{9}$/.test(v.replace(/[\s-]/g, "")), "Enter a valid 10-digit mobile number")
  .optional()
  .or(z.literal(""));

export const signupSchema = z.object({
  fullName: z.string().min(2, "Enter your full name"),
  email: z.string().email("Enter a valid email address"),
  phone: phoneSchema,
  password: z.string().min(8, "At least 8 characters"),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const updateProfileSchema = z.object({
  fullName: z.string().min(2, "Enter your full name"),
  phone: phoneSchema,
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  remember: z.boolean().optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const adminMfaVerifySchema = z.object({
  mfaToken: z.string().min(1),
  code: z.string().length(6, "Enter the 6-digit code"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "At least 8 characters"),
});
