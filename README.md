# Ilkal Threads API

A modular-monolith backend for the Ilkal Threads marketplace — Node.js,
TypeScript, Express, Prisma, PostgreSQL, and S3-backed image uploads. Built
so it runs as one deployable service today, but splits into independent
microservices later without a rewrite.

## Stack

- **Express + TypeScript (ESM)** — HTTP layer.
- **PostgreSQL + Prisma** — the database and its typed client/migrations.
- **JWT sessions** — short-lived access token + rotating refresh token, both
  httpOnly cookies (`ilkal_at` / `ilkal_rt`); `Authorization: Bearer` also
  accepted for non-browser clients.
- **AWS S3 (SDK v3)** — presigned-URL direct-from-browser uploads; the API
  never proxies image bytes.
- **Zod** — request validation at every route boundary.
- **Pino** — structured logging.

## Getting started

```bash
cp .env.example .env        # fill in DATABASE_URL, JWT secrets, AWS creds
npm install
npm run prisma:migrate      # creates the schema, then runs prisma/seed.ts
npm run dev                 # http://localhost:4000
```

Or via Docker from the repo root: `docker compose up --build` (Postgres +
API; run the Next.js app separately with `npm run dev`).

Seeding prints a demo admin login (with its MFA otpauth:// URL to scan into
an authenticator app), a demo customer login, and one login per seeded
retailer — see the console output after `prisma:migrate` or `db:seed`.

## Why "modular monolith, microservice-ready"

Every module under `src/modules/<domain>/` owns its own routes, controller,
service, repository, and Zod schemas, and follows one rule:

> **A module may only be used by another module through its exported
> `*.service.ts` functions (or the event bus) — never through its
> `*.repository.ts` or a raw Prisma query.**

That's the entire trick. As long as that rule holds, a module is already
shaped like a service with an API — extracting it later means giving it its
own process and turning its direct function calls into HTTP/gRPC calls,
not redesigning it. Two deliberate, documented exceptions:

1. **`modules/admin`** reads other modules' tables directly for dashboard
   aggregates (`admin.service.ts`) — a CQRS-style read model is allowed to
   cut across boundaries because it never writes.
2. **`modules/admin/activityLog.subscribers.ts`** — not an exception at all,
   actually the pattern working as intended: it listens to domain events
   other modules publish (`order.placed`, `retailer.registered`, …) instead
   of reaching into their tables.

### The event bus (`src/lib/eventBus.ts`)

An in-memory `EventEmitter` today, hidden behind an `IEventBus` interface
(`publish` / `subscribe`). When a module needs to react to something another
module did, it subscribes to a named event instead of importing that
module. The day any of this splits into real services, **this one file**
becomes a RabbitMQ/Kafka/SNS+SQS client — every `publish()`/`subscribe()`
call site elsewhere is unchanged, because they only ever depended on the
interface.

### Everything else that makes a later split mechanical

- Routes are namespaced per module and mounted under `/api/v1` in `app.ts`
  — a natural place for an API gateway to fan out to per-module services.
- Enum values crossing the HTTP boundary are translated explicitly
  (`src/lib/enumLabels.ts`) rather than relying on Prisma's enum `@map` (which
  only affects the DB column, not the JS-facing value) — so the wire
  contract doesn't secretly depend on which process renders it.
- One Postgres database today; each module's tables are already scoped
  enough (see `prisma/schema.prisma`) to move to `@@schema` multi-schema or
  a separate database per service with a mechanical migration, not a
  re-model.

## Integration with the frontend

This API is a separate project/repo from the Ilkal Threads Next.js frontend
— there's no shared filesystem, build step, or import between them. They
integrate purely over HTTP, through a small, explicit contract:

- **`CORS_ORIGINS`** (this repo's `.env`) must list the frontend's origin(s)
  (e.g. `http://localhost:3000` in dev, `https://app.yourdomain.com` in
  prod) — `app.ts` only allows `credentials: true` CORS from these.
- **`API_INTERNAL_URL`** (the frontend's `.env.local`) points Server
  Components (`lib/api/server.ts`) at this API's base URL
  (`http://localhost:4000/api/v1` in dev). Server Components call it
  directly — no CORS involved, since that's server-to-server.
- **The frontend's `next.config.ts` rewrite** (`/api/backend/*` →
  `${API_INTERNAL_URL}/*`) is what lets the *browser* call this API same-origin
  from Client Components (`lib/api/client.ts`), so the httpOnly session
  cookies this API sets stay same-site with zero CORS/cookie-domain
  wrangling in dev. In production, put both apps behind the same domain
  (e.g. a reverse proxy routing `/api/*` to this service) for the same
  reason, or set the cookies' `Domain` to a shared parent domain if they
  must live on different subdomains.
- **`JWT_ACCESS_SECRET`** must be byte-for-byte identical between this
  repo's `.env` and the frontend's `.env.local` — the frontend's `proxy.ts`
  verifies this API's access-token JWT signature directly (no network call)
  to gate `/retailer/*` and `/admin/*`, so a mismatched secret makes every
  authenticated user look logged out at the proxy layer even though the API
  itself still accepts their session.

Local dev, running both side by side:

```bash
# this repo
cp .env.example .env   # fill in DATABASE_URL, JWT secrets (matching the frontend's), AWS creds
npm install && npm run prisma:migrate && npm run dev   # :4000

# the frontend repo, separately
cp .env.local.example .env.local   # API_INTERNAL_URL=http://localhost:4000/api/v1, same JWT_ACCESS_SECRET
npm install && npm run dev   # :3000
```

## Known scope cuts (call these out before shipping)

- **Payments** are mocked (`paymentStatus` is set synchronously at
  checkout) — there's no real payment gateway integration.
- **Retailer bank details** are AES-encrypted at rest as a stopgap
  (`src/lib/crypto.ts`) — production should route these through a
  PCI-compliant processor (Razorpay/Stripe Connect) and never store raw
  account numbers, encrypted or not.
- **Password reset / registration emails** aren't sent — the token is
  logged server-side instead of emailed (no transactional email provider is
  wired up yet; SES would be the natural choice given the AWS footprint
  already in use).
- **Event entry analytics** (views/shares/comments) aren't modeled — those
  need a real event-tracking pipeline, not fabricated numbers, so only
  vote counts and rank (both real) are exposed.
