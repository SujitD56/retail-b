import { createApp } from "@/app.js";
import { env } from "@/config/env.js";
import { logger } from "@/lib/logger.js";
import { prisma } from "@/lib/prisma.js";
import { registerActivityLogSubscribers } from "@/modules/admin/activityLog.subscribers.js";

// Event-bus subscribers are registered once at boot, independent of any
// single request — this is where a future service split would instead spin
// up its own consumer process against the same topics.
registerActivityLogSubscribers();

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 Ilkal Threads API listening on :${env.PORT} (${env.NODE_ENV})`);
});

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully…`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  // Force-exit if graceful shutdown hangs.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => logger.error({ reason }, "Unhandled promise rejection"));
