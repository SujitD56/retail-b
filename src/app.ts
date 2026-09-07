import express from "express";
import cors from "cors";
import helmetImport from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import type { IncomingMessage, ServerResponse } from "node:http";

// helmet's CJS/ESM default-export interop resolves inconsistently across
// build environments — it type-checks fine locally, but some `tsc`
// invocations (observed on Vercel's build, not local) infer the default
// import as the whole module namespace instead of the callable factory it
// actually is at runtime, and fail with "This expression is not callable".
// Pin down the minimal real shape ourselves and cast through `unknown`
// instead of trusting whichever way a given environment unwraps `.default`.
type HelmetMiddleware = (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => void;
type HelmetFactory = (options?: Record<string, unknown>) => HelmetMiddleware;
const helmet = helmetImport as unknown as HelmetFactory;
import { env } from "@/config/env.js";
import { logger } from "@/lib/logger.js";
import { prisma } from "@/lib/prisma.js";
import { requestId } from "@/middleware/requestId.js";
import { apiRateLimiter } from "@/middleware/rateLimit.js";
import { errorHandler, notFoundHandler } from "@/middleware/errorHandler.js";

import { authRouter } from "@/modules/auth/auth.routes.js";
import { uploadsRouter } from "@/modules/uploads/uploads.routes.js";
import { productsRouter } from "@/modules/products/products.routes.js";
import { categoriesRouter } from "@/modules/categories/categories.routes.js";
import { collectionsRouter } from "@/modules/collections/collections.routes.js";
import { reviewsRouter } from "@/modules/reviews/reviews.routes.js";
import { retailersRouter } from "@/modules/retailers/retailers.routes.js";
import { retailerStatsRouter } from "@/modules/retailers/retailer-stats.routes.js";
import { cartRouter } from "@/modules/cart/cart.routes.js";
import { wishlistRouter } from "@/modules/wishlist/wishlist.routes.js";
import { ordersRouter } from "@/modules/orders/orders.routes.js";
import { eventsRouter } from "@/modules/events/events.routes.js";
import { adminRouter } from "@/modules/admin/admin.routes.js";

export function createApp() {
  const app = express();

  // Vercel (like any reverse proxy) terminates the real client connection
  // and forwards requests with an `X-Forwarded-For` header. Express ignores
  // that header by default — a deliberate safe default, since blindly
  // trusting it would let a client spoof its own IP — so express-rate-limit
  // refuses to key off it until this is set explicitly. `1` means "trust
  // exactly one hop in front of us", which is correct for Vercel's setup
  // (a self-hosted deployment behind your own nginx/ALB would use the same
  // value; only a chain of multiple proxies needs a higher hop count).
  app.set("trust proxy", 1);

  app.disable("x-powered-by");
  app.use(helmet());
  // Allow every origin. `origin: true` reflects whatever Origin header the
  // request sent back as Access-Control-Allow-Origin (the CORS spec
  // forbids a literal `*` alongside `credentials: true`, which this app
  // needs for its httpOnly session cookies) — so this is the "allow all"
  // equivalent that still works with cookie-based auth. That means any
  // site, not just this project's own frontend, can make credentialed
  // requests here and have a logged-in visitor's cookies sent along. Scope
  // this back down to an explicit allowlist (see git history for the
  // previous CORS_ORIGINS/ALLOW_VERCEL_PREVIEW_ORIGINS-based version) once
  // there's a real frontend domain to lock it to.
  app.use(cors({ credentials: true, origin: true }));
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      customLogLevel: (_req: IncomingMessage, res: ServerResponse) =>
        res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
    }),
  );
  app.use(apiRateLimiter);

  // Liveness: the process is up and able to answer HTTP at all. Deliberately
  // does not touch the database — this is what should stay green even while
  // /readyz is failing, so a monitor can tell "crashed" apart from "up but
  // can't reach Postgres". Logged at info so cold starts and health-checker
  // traffic are both visible in the function logs, not just errors.
  app.get("/healthz", (_req, res) => {
    logger.info("healthz check: ok");
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Readiness: actually exercises the one dependency most likely to be
  // misconfigured after a fresh deploy (DATABASE_URL wrong/missing/host
  // unreachable) so that shows up as a clear "database: unreachable" log
  // line and a 503, instead of every route silently 500ing on first request
  // with no obvious cause in the logs.
  app.get("/readyz", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      logger.info("readyz check: database reachable");
      res.status(200).json({ status: "ready", database: "connected" });
    } catch (err) {
      logger.error({ err }, "readyz check failed: database unreachable");
      res.status(503).json({ status: "not_ready", database: "unreachable" });
    }
  });

  // Every module is mounted under /api/v1 as its own router — this is the
  // seam a future API gateway / per-module deploy would split along. See
  // server/README.md for the modular-monolith -> microservices story.
  const v1 = express.Router();
  v1.use("/auth", authRouter);
  v1.use("/uploads", uploadsRouter);
  v1.use("/products", productsRouter);
  v1.use("/categories", categoriesRouter);
  v1.use("/collections", collectionsRouter);
  v1.use("/reviews", reviewsRouter);
  v1.use("/retailers/stats", retailerStatsRouter); // mounted before /retailers so "stats" isn't parsed as a retailer id
  v1.use("/retailers", retailersRouter);
  v1.use("/cart", cartRouter);
  v1.use("/wishlist", wishlistRouter);
  v1.use("/orders", ordersRouter);
  v1.use("/events", eventsRouter);
  v1.use("/admin", adminRouter);
  app.use("/api/v1", v1);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
