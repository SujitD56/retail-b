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
import { createApp } from "../dist/app.js";
import { registerActivityLogSubscribers } from "../dist/modules/admin/activityLog.subscribers.js";

registerActivityLogSubscribers();

export default createApp();
