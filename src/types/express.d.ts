import type { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        role: Role;
        email: string;
      };
      requestId?: string;
      /** Raw request body bytes, captured by express.json()'s `verify` hook in app.ts — needed to check Razorpay's webhook signature, which is computed over the exact bytes sent, not a re-serialization of the parsed body. */
      rawBody?: Buffer;
    }
  }
}

export {};
