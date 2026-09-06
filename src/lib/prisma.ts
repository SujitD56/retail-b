import { PrismaClient } from "@prisma/client";
import { isProd } from "@/config/env.js";

// Singleton PrismaClient — avoids exhausting Postgres connections from
// hot-reload creating a new client per file change in dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProd ? ["error", "warn"] : ["warn", "error"],
  });

if (!isProd) globalForPrisma.prisma = prisma;
