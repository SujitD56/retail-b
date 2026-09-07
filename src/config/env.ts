import "dotenv/config";
import { z } from "zod";

// Fail fast on boot if config is missing/invalid, rather than surfacing a
// cryptic error the first time a route touches the missing value.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 chars"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 chars"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),

  FIELD_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "FIELD_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)"),

  AWS_REGION: z.string().default("ap-south-1"),
  AWS_ACCESS_KEY_ID: z.string().min(1, "AWS_ACCESS_KEY_ID is required"),
  AWS_SECRET_ACCESS_KEY: z.string().min(1, "AWS_SECRET_ACCESS_KEY is required"),
  S3_BUCKET_NAME: z.string().min(1, "S3_BUCKET_NAME is required"),
  S3_PUBLIC_BASE_URL: z.string().optional(),

  SEED_ADMIN_EMAIL: z.string().email().default("admin@ilkalthreads.com"),
  SEED_ADMIN_PASSWORD: z.string().min(8).default("ChangeMe123!"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const fieldErrors = parsed.error.flatten().fieldErrors;
  // eslint-disable-next-line no-console
  console.error("❌ Invalid environment configuration:\n", fieldErrors);
  // Throw rather than `process.exit(1)`: this file is imported at the very
  // top of the module graph on every entry point, including the Vercel
  // serverless one (api/index.js -> dist/app.js -> here). `process.exit()`
  // kills the whole Node isolate outright — on Vercel that surfaces as an
  // opaque "This Serverless Function has crashed" / FUNCTION_INVOCATION_FAILED
  // page with no indication of why, because exiting sidesteps the runtime's
  // normal uncaught-exception reporting. Throwing instead lets Vercel (and
  // `node dist/server.js` locally) log a real stack trace with this message
  // — including exactly which env vars are missing/invalid by name — to the
  // function logs, and still crashes just as hard either way.
  throw new Error(
    `Invalid environment configuration — missing/invalid keys: ${Object.keys(fieldErrors).join(", ")}. ` +
      `Set these in your deploy platform's environment variables (see .env.example).`,
  );
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
