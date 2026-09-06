import type { NextFunction, Request, Response } from "express";

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

// Wraps an async route handler so a rejected promise reaches errorHandler.ts
// instead of crashing the process (Express 4 doesn't do this automatically).
export function asyncHandler(fn: Handler) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
