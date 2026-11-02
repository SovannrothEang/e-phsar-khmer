# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Follow the repository-wide engineering rules in `AGENTS.md`. The current system map, module reference, and engineering constraints live in [`ARCHITECTURE.md`](ARCHITECTURE.md); its **Known gaps** section tracks open work. Keep this file short — operational guidance only. Architecture and module detail belongs in `ARCHITECTURE.md`, `docs/`, or the owning module's `README.md`.

## Repository docs

- **`ARCHITECTURE.md`** — the canonical, current system map and backend/web/mobile implementation reference. Verify time-sensitive details against the code before relying on them.
- **`AGENTS.md`** (repo root) — the project's engineering rules, including the Module README convention; `apps/backend/src/payment/README.md` and `src/chat/README.md` are the canonical README examples.
- **`CHANGELOG.md`** — shipped changes by date (Keep a Changelog) with an `Unreleased` section; **`tasks/todo.md`** — the running ship log (history before 2026-10-24: `git show fd824a0:tasks/todo.md`); **`tasks/waiting-for-implements-laters.md`** — parked work. Finished plans are deleted once shipped (outcome in the CHANGELOG, text in git).
- **`docs/`** — tracked design notes (`e2e-encryption.md`, `e2e-attachments.md`, `post-form-layout.md`, `social-oauth-setup.md`, …). `docs/architecture.md` is a compatibility pointer to `ARCHITECTURE.md`.
- **Root and `apps/web` READMEs are `create-turbo` boilerplate** (the web one still has merge markers) — the module READMEs are the accurate ones.

## Prerequisites

- **Node.js** ≥ 18, **pnpm** 9.0.0 (enforced by `packageManager` in root `package.json`)
- First clone: `pnpm install`

## Commands

### Root (Turbo, all packages)

```bash
pnpm install        # first-time setup
pnpm build          # build all packages
pnpm dev            # dev all packages in parallel
pnpm lint           # lint all packages
pnpm check-types    # type-check packages that define it (currently @repo/ui only)
pnpm format         # prettier all .ts/.tsx/.md
pnpm format:check   # CI's format gate (writes nothing)
```

### Backend only

```bash
pnpm --filter backend build          # nest build → dist/src/
pnpm --filter backend start:dev      # watch mode
pnpm --filter backend lint           # eslint --fix
pnpm --filter backend test           # jest (rootDir=src, *.spec.ts)
pnpm --filter backend test:watch
pnpm --filter backend test:e2e       # jest --config test/jest-e2e.json
pnpm --filter backend test:cov

# Single test file (Jest 30: plural flag; singular --testPathPattern errors)
pnpm --filter backend test -- --testPathPatterns=jwt-auth.guard
# Single test by name
pnpm --filter backend test -- --testNamePattern="throws Unauthorized"
```

### Database (backend)

```bash
pnpm --filter backend db:generate    # drizzle-kit generate (creates migration files)
pnpm --filter backend db:migrate     # apply migrations
pnpm --filter backend db:push        # push schema directly (dev only)
pnpm --filter backend db:studio
pnpm --filter backend db:seed        # ts-node src/db/seed.ts (idempotent)
pnpm --filter backend db:fetch-photos   # demo-catalogue photo cache
pnpm --filter backend db:seed:catalog   # demo catalogue only
```

**Migration gotcha:** the migrator compares only the newest `created_at` in `drizzle.__drizzle_migrations` against each journal `when`; an unapplied file stamped older than that watermark is silently skipped. Check the watermark before trusting `db:migrate` on an old database (details and the repair history are in `ARCHITECTURE.md` Known gaps).

### Web (Next.js)

```bash
pnpm --filter web dev      # dev on port 3001
pnpm --filter web build    # next build — the only type gate (no check-types, no test suite)
pnpm --filter web lint
```

`web` is standalone: no `@repo/*` deps, no shared tsconfig, flat `eslint.config.js`. The DOM is client-rendered, so raw HTML/`curl` greps see only the flight payload — browser verification means driving a real browser. The worked headless-Chromium/CDP recipe (blink settings, viewport, Radix pointerdown, hydration waits, kill command) is in `ARCHITECTURE.md` → *Browser verification*.

### Mobile (Expo)

```bash
pnpm --filter phsarkhmer start     # Expo dev server (package is `phsarkhmer`, not `mobile`)
pnpm --filter phsarkhmer android
pnpm --filter phsarkhmer ios
pnpm --filter phsarkhmer web
pnpm --filter phsarkhmer lint      # expo lint — the only gate it has
```

No test or type gate: run `pnpm --filter phsarkhmer exec tsc --noEmit` by hand. Root `pnpm dev` does not start the app (no `dev` script).

### Shared packages

```bash
pnpm --filter @repo/ui lint
pnpm --filter @repo/ui check-types
pnpm --filter @repo/eslint-config lint
```

**`@repo/ui`** exports `./src/*.tsx` — import as `@repo/ui/button`, etc.; write shared components there, not in apps. **`@repo/typescript-config`** has `base.json`/`nextjs.json`/`react-library.json`; **`@repo/eslint-config`** has `base.js`/`next.js`/`react-internal.js`.

## Pipeline workflow

`.pipeline/` tracks features through four phases: `spec.md` (planner) → `changes.md` (coder) → `test-results.md` (tester) → `review.md` (reviewer). Start new features with the planner agent. `tasks/todo.md` is the running ship log — append a dated entry per ship; once shipped, fold the outcome into `CHANGELOG.md` and drop it from the log.

## Frontend listing-form specs

`apps/backend/docs/spec-detail-one.md` … `-twelve.md` are the per-category form specs written from the frontend's perspective; the seed (`src/categories/seeds/categories.seed.ts`) translates them into each subcategory's `field_schema`. All 12 are seeded, and the web form consumes `field_schema` at runtime. A captain's mock overrides a spec — the seed records those overrides inline, so check the seed before "correcting" it from a spec file. Per-file mapping and conventions: `ARCHITECTURE.md` → *Frontend listing-form specs*.

## TypeScript constraints

- `module: nodenext`, no `"type":"module"` → CJS output. Do **not** add `.js` extensions to relative imports.
- `strict: true` everywhere except `strictPropertyInitialization: false` (NestJS DI fields). `noImplicitAny` + ESLint `no-explicit-any: error` — use typed interfaces or `unknown`. For Supabase use `type AnySupabaseClient = SupabaseClient` + explicit return types (avoids TS2742).
- Express 5 wildcards: use `'{*splat}'` in `forRoutes()`, not `'*'`.
- `@nestjs/jwt` `expiresIn` is `ms.StringValue` — cast runtime strings `as unknown as number`.

## Tooling quirks

- **Plain `grep` is a mise shim and breaks** (`unknown option '-G'`) — use `git grep` or the Grep/Read tools.
- **A PostToolUse hook runs prettier on every edited file** (double quotes, 2-space). When batching edits to one file, re-Read after the first edit — later `old_string`s based on pre-format text fail. It also mangles conflict markers; when resolving a merge, remove markers by exact line, then re-check.
- **`CLAUDE.md` is deliberately in `.prettierignore`** — prettier's markdown printer corrupts it. Never run prettier on it and never remove that entry: CI's format gate runs `prettier --check "**/*.{ts,tsx,md}"`.
- **CI is real:** `.github/workflows/ci.yml` runs on PRs + `prod` pushes (format:check, `turbo run lint check-types`, a no-autofix `git diff --exit-code` gate, backend unit tests, a `drizzle-kit generate` migration-drift check, build — Node 22), and `deploy.yml` chains CI → `db:migrate` → Vercel backend deploy on `prod`. There are no git hooks; the on-edit formatting is the Claude Code hook.
- **Workspace hoisting hazard:** a pnpm install can hoist a conflicting copy of a shared tool and break a different package (past: `jest-environment-node`, `@types/react`). After changing dependencies, check the lockfile still resolves one copy.

## Environment variables

The backend requires `.env`/`.env.local` in `apps/backend/` (Zod-validated at boot). Required:

| Var | Constraint |
| --- | ---------- |
| `SUPABASE_URL` | valid URL |
| `SUPABASE_ANON_KEY` | non-empty |
| `SUPABASE_SERVICE_ROLE_KEY` | non-empty |
| `DATABASE_URL` | must start with `postgres` |
| `JWT_SECRET` | ≥ 16 chars |
| `JWT_REFRESH_SECRET` | ≥ 16 chars |

Optional (defaults): `PORT=3000`, `DATABASE_POOL_MAX=20` (shared postgres.js pool — the real chat-scaling limit), `JWT_ACCESS_EXPIRES_IN=15m`, `JWT_REFRESH_EXPIRES_IN=30d`, `THROTTLE_TTL=60`, `THROTTLE_LIMIT=100`, `SUPABASE_STORAGE_BUCKET=listings`, `CHAT_FILES_BUCKET=chat-files`, `CHAT_ATTACHMENT_DAILY_BYTES=209715200`, `TELEGRAM_BOT_TOKEN`, `FRONTEND_ORIGINS` (comma-separated), `DEV_OTP_TOKEN` (dev only; rejected at boot in production), `IDEMPOTENCY_TTL_HOURS=24`, `OTP_PROVIDER=supabase|plasgate`, `OTP_HMAC_SECRET`, `SMS_BASE_URL`, `SMS_PRIVATE_KEY`, `SMS_SECRET`, `SMS_SENDER`, `SMS_RATE_LIMIT_PER_MINUTE=150`, `SMS_USER_COOLDOWN_SECONDS=300`, `SMS_USER_DAILY_CAP=10`.

Grouped feature config — `src/config/config.validation.ts` (Zod) is the source of truth. It also owns the outbox worker, account purge, BullMQ queue (`QUEUE_*`), payment-job, ABA PayWay and Bakong variables; read it before changing any of them.

**Web env:** `API_URL` (backend base, default `http://localhost:3000/api/v1`) and `SUPABASE_URL` (must match the backend's; `next.config.ts` reads its hostname at build time) — server-side only. Client-visible exceptions: `NEXT_PUBLIC_WS_URL` (chat WebSocket origin; without it the hook falls back to `localhost:3000` and WS sends silently vanish — it must mirror `API_URL`'s host) and `NEXT_PUBLIC_SITE_URL` (share links, QR, metadata; default `https://phsarkhmer.com`).

`*.env*` is gitignored.

## IDs

Use `crypto.randomUUID()` from Node's `node:crypto`. There is no `uuid` package dependency.

## Known gaps

See `ARCHITECTURE.md` → **Known gaps**. Track each as a separate ticket; do not silently fold fixes into unrelated work.
