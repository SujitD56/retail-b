import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { env } from "@/config/env.js";
import { logger } from "@/lib/logger.js";
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

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        // No Origin header (server-to-server calls, curl, Postman) — allow.
        if (!origin) return callback(null, true);
        if (env.CORS_ORIGINS.includes(origin)) return callback(null, true);
        // Vercel preview deployments get an unpredictable *.vercel.app
        // subdomain per branch/PR — CORS_ORIGINS can't list those ahead of
        // time, so also allow any subdomain of the project's own Vercel
        // domain when ALLOW_VERCEL_PREVIEW_ORIGINS is set.
        if (env.ALLOW_VERCEL_PREVIEW_ORIGINS && /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) {
          return callback(null, true);
        }
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
    }),
  );
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

  app.get("/healthz", (_req, res) => res.status(200).json({ status: "ok" }));
  app.get("/readyz", (_req, res) => res.status(200).json({ status: "ready" }));

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
