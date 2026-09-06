import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export function requestId(req: Request, res: Response, next: NextFunction) {
  const id = (req.headers["x-request-id"] as string | undefined) ?? crypto.randomUUID();
  req.requestId = id;
  res.setHeader("x-request-id", id);
  next();
}
