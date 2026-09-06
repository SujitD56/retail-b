import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors.js";
import { logger } from "@/lib/logger.js";
import { isProd } from "@/config/env.js";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: "NOT_FOUND", message: `No route for ${req.method} ${req.originalUrl}` } });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) logger.error({ err, requestId: req.requestId }, err.message);
    res.status(err.statusCode).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request", details: err.flatten() } });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({ error: { code: "CONFLICT", message: `A record with this ${(err.meta?.target as string[])?.join(", ") ?? "value"} already exists` } });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Record not found" } });
      return;
    }
  }

  logger.error({ err, requestId: req.requestId }, "Unhandled error");
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Something went wrong",
      // Never leak stack traces / raw error messages to clients in production.
      ...(isProd ? {} : { debug: err instanceof Error ? err.message : String(err) }),
    },
  });
}
