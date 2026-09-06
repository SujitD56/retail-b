import rateLimit from "express-rate-limit";

// Tighter limiter for auth endpoints (login/signup/password-reset) — the
// usual brute-force/credential-stuffing mitigation. General API traffic gets
// the more permissive default limiter in app.ts.
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "TOO_MANY_REQUESTS", message: "Too many attempts. Please try again later." } },
});

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "TOO_MANY_REQUESTS", message: "Too many requests. Please slow down." } },
});
