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
// Boot-time errors here (bad/missing env vars, a dependency that throws on
// import) are the #1 cause of Vercel's opaque "This Serverless Function has
// crashed" page — the real reason is almost always in the function logs,
// but only if something logs it clearly before the module throws. Wrap the
// whole boot sequence so that whatever goes wrong gets one unmistakable
// console.error with the actual message, then re-throw so Vercel still
// correctly reports the invocation as failed.
let app;
try {
  console.log("[boot] Ilkal Threads API — starting…");
  const { createApp } = await import("../dist/app.js");
  const { registerActivityLogSubscribers } = await import(
    "../dist/modules/admin/activityLog.subscribers.js"
  );
  registerActivityLogSubscribers();
  app = createApp();
  console.log("[boot] Ilkal Threads API — ready.");
} catch (err) {
  console.error("[boot] Ilkal Threads API — FAILED TO START:", err);
  throw err;
}

export default app;
