import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "@/lib/asyncHandler.js";
import { optionalAuth } from "@/middleware/auth.js";
import { validate } from "@/middleware/validate.js";
import { prisma } from "@/lib/prisma.js";

export const supportRouter = Router();

const ticketSchema = z.object({
  orderId: z.string().optional(),
  email: z.string().email().optional(),
  message: z.string().min(1).default("Need help with my order"),
});

supportRouter.post(
  "/tickets",
  optionalAuth,
  validate(ticketSchema),
  asyncHandler(async (req, res) => {
    const ticket = await prisma.supportTicket.create({
      data: { orderId: req.body.orderId, email: req.body.email, message: req.body.message, userId: req.auth?.userId },
    });
    res.status(201).json({ ticket: { id: ticket.id, status: ticket.status, createdAt: ticket.createdAt } });
  }),
);
