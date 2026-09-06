import pino from "pino";
import { isProd } from "@/config/env.js";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport: isProd ? undefined : { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } },
  redact: ["req.headers.authorization", "req.headers.cookie", "*.password", "*.passwordHash"],
});
