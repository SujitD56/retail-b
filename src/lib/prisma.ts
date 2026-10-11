import { Prisma, PrismaClient } from "@prisma/client";
import { isProd } from "@/config/env.js";
import { logger } from "@/lib/logger.js";

// Neon's pooled connection occasionally refuses/drops a query outright —
// most often right after this process starts (cold Prisma connection pool)
// or after the DB has been idle long enough for Neon to suspend the
// compute. Those are transient by nature, so every query gets one or two
// quiet retries before bubbling up as a real 500. This is a client
// extension (not a transaction) — a `$transaction(callback)` still needs
// its own retry (see orders.service.ts's withTransientRetry) since a
// dropped transaction connection isn't a single retryable operation.
const RETRYABLE_PRISMA_CODES = new Set(["P1001", "P1002", "P2028"]);

function isTransientDbError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) return RETRYABLE_PRISMA_CODES.has(err.code);
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  if (err instanceof Error) return /can't reach database server|econnrefused|other side closed/i.test(err.message);
  return false;
}

function createPrismaClient() {
  return new PrismaClient({ log: isProd ? ["error", "warn"] : ["warn", "error"] }).$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const maxAttempts = 3;
          for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
              return await query(args);
            } catch (err) {
              if (!isTransientDbError(err) || attempt === maxAttempts) throw err;
              logger.warn({ attempt }, "Transient DB error — retrying query");
              await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
            }
          }
          throw new Error("unreachable");
        },
      },
    },
  });
}

// Singleton PrismaClient — avoids exhausting Postgres connections from
// hot-reload creating a new client per file change in dev.
const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createPrismaClient> };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (!isProd) globalForPrisma.prisma = prisma;
