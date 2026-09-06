import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";

type Target = "body" | "query" | "params";

/** Parses+validates req[target] with a Zod schema and replaces it with the parsed (typed, coerced) value. */
export function validate(schema: ZodTypeAny, target: Target = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      next(result.error);
      return;
    }
    req[target] = result.data;
    next();
  };
}
