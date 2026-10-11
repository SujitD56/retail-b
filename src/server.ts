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
  logger.info(`🚀 Kaushaya API listening on :${env.PORT} (${env.NODE_ENV})`);
});

// Node's default keepAliveTimeout (5s) is shorter than the idle window
// Next.js's server-side fetch() pool happily reuses a kept-alive socket
// across — so this server would close the connection out from under it,
// and the next reused-socket request would fail with ECONNRESET/"other
// side closed". Matching it to a conventional reverse-proxy-length timeout
// (headersTimeout must exceed keepAliveTimeout, per Node's own requirement)
// gives pooled connections enough headroom to actually get reused.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

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
