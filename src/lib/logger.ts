import pino from "pino";
import { isProd } from "@/config/env.js";

// pino-pretty's transport spawns a worker thread that resolves the
// "pino-pretty" package's entry point at runtime — that resolution breaks
// once the code is bundled/isolated into a deployment package (Vercel's
// /var/task, or any other lambda-style runtime), throwing "unable to
// determine transport target for 'pino-pretty'" and crashing on the very
// first log line, before any route ever runs. `isProd` alone isn't a
// reliable guard against that: it depends on NODE_ENV actually being set
// to "production" and propagating correctly to the running function, which
// isn't guaranteed for a plain (non-framework) Node deploy. `VERCEL` is —
// Vercel sets it to "1" in every one of its own runtime environments — so
// check both: never attempt the worker-thread transport there regardless
// of what NODE_ENV says.
const usePrettyTransport = !isProd && !process.env.VERCEL;

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport: usePrettyTransport
    ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } }
    : undefined,
  redact: ["req.headers.authorization", "req.headers.cookie", "*.password", "*.passwordHash"],
});
