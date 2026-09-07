// Vercel serverless entry point. Vercel's Node runtime treats a default
// export shaped like `(req, res) => void` as the request handler — an
// Express app already satisfies that (it's the same signature Node's own
// `http.createServer(app)` expects), so no adapter library is needed.
//
// This imports the *compiled* output (dist/), not src/ — `npm run build`
// (wired as this project's `vercel-build` script) runs `tsc` + `tsc-alias`
// first, so by the time this file executes, every `@/...` path alias in
// the app has already been rewritten to a plain relative import. That
// sidesteps relying on Vercel's own bundler to understand this project's
// TypeScript path aliases, which is a common source of "works locally,
// breaks on Vercel" failures for exactly this kind of setup.
//
// Known limitation of running this Express app as a serverless function
// (see server/README.md's "Deploying to Vercel" section): the in-memory
// rate limiter and the in-memory event bus (and anything downstream of it,
// like the admin activity feed) are scoped to a single warm instance —
// they work, but not with the same guarantees as on a persistent process.
// These MUST be static top-level imports, not `await import(...)`. Vercel's
// build uses @vercel/nft to statically parse this file and trace its real
// dependency graph (dist/app.js and everything it needs) — top-level
// `await` makes that parse fail outright ("Failed to parse ... as script:
// Unexpected token", confirmed by running `npx @vercel/nft print
// api/index.js` locally), and when the tracer can't parse the declared
// entry point, Vercel's builder falls back to independently discovering
// and compiling src/app.ts on its own instead — using a plain compiler
// that doesn't understand this project's `@/*` path aliases, which is what
// previously surfaced as "Cannot find package '@/lib' imported from
// /var/task/src/app.js" in production. A static import that fails (e.g.
// config/env.ts's validation throwing on a bad/missing env var) still
// produces a normal, visible stack trace in Vercel's function logs on its
// own — nothing here needs to be inside a try/catch for that to work.
import { createApp } from "../dist/app.js";
import { registerActivityLogSubscribers } from "../dist/modules/admin/activityLog.subscribers.js";

console.log("[boot] Ilkal Threads API — starting…");
let app;
try {
  registerActivityLogSubscribers();
  app = createApp();
  console.log("[boot] Ilkal Threads API — ready.");
} catch (err) {
  console.error("[boot] Ilkal Threads API — FAILED TO START:", err);
  throw err;
}

export default app;
