# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Follow the repository-wide engineering rules in `AGENTS.md`. The current system architecture and module map are in [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Repository docs

- **`ARCHITECTURE.md`** — current system map and backend/web architecture details. Verify implementation-specific details against code before relying on them.
- **`AGENTS.md`** (repo root) — the project's engineering rules and Module README convention.
- **`CHANGELOG.md`** (repo root) — shipped changes by date, Keep a Changelog format, with an `Unreleased` section for in-flight work. **`tasks/todo.md`** — the running ship log for in-flight work (shipped entries fold into the CHANGELOG; history before 2026-10-24 is in `git show fd824a0:tasks/todo.md`); `tasks/waiting-for-implements-laters.md` — work deliberately parked; **`docs/post-form-layout.md`** — the post form's layout, step by step. Finished plans are deleted from `tasks/` once shipped (outcome in `CHANGELOG.md`; text in git); durable design notes live in `docs/` (`e2e-encryption.md`, `e2e-attachments.md`).
- **Both `README.md` files are untouched `create-turbo` starter boilerplate** — the root one and `apps/web/README.md` both describe a `docs` app that has never existed here, and the web one **still contains unresolved merge-conflict markers**. Neither documents this project; read them for nothing. (The only accurate READMEs are the per-module ones — see the Module README convention.)

## Prerequisites

- **Node.js** ≥ 18, **pnpm** 9.0.0 (enforced by `packageManager` in root `package.json`)
- First clone: `pnpm install` (installs all workspace dependencies)

## Commands

### Root (runs across all packages via Turbo)

```bash
pnpm install       # first-time setup
pnpm build          # build all packages
pnpm dev            # dev all packages in parallel
pnpm lint           # lint all packages
pnpm check-types    # type-check packages that define it (currently @repo/ui only)
pnpm format         # prettier all .ts/.tsx/.md
```

### Backend only

```bash
pnpm --filter backend build          # nest build → dist/src/
pnpm --filter backend start:dev      # watch mode
pnpm --filter backend lint           # eslint --fix
pnpm --filter backend test           # jest (unit, rootDir=src, *.spec.ts)
pnpm --filter backend test:watch     # jest watch
pnpm --filter backend test:e2e       # jest --config test/jest-e2e.json
pnpm --filter backend test:cov       # jest --coverage

# Run a single test file (Jest 30: flag is plural; singular --testPathPattern errors out)
pnpm --filter backend test -- --testPathPatterns=jwt-auth.guard

# Run a single test by name
pnpm --filter backend test -- --testNamePattern="throws Unauthorized"
```

### Database (backend)

```bash
pnpm --filter backend db:generate    # drizzle-kit generate (creates migration files)
pnpm --filter backend db:migrate     # apply migrations
pnpm --filter backend db:push        # push schema directly (dev only)
pnpm --filter backend db:studio      # Drizzle Studio UI
pnpm --filter backend db:seed        # ts-node src/db/seed.ts (idempotent seed)
```

### Web (Next.js)

```bash
pnpm --filter web dev          # Next.js dev on port 3001
pnpm --filter web build        # next build (includes full type-checking)
pnpm --filter web lint         # eslint
```

`web` is a full user-facing marketplace + admin dashboard (Next.js 16 App Router + `next-intl` i18n). It is **standalone**: its `package.json` has no `@repo/*` deps, its `tsconfig.json` extends nothing from `@repo/typescript-config`, and its flat `eslint.config.js` uses `eslint-config-next` directly. The old nested `apps/web/pnpm-workspace.yaml` / `apps/web/pnpm-lock.yaml` are deleted (web resolves against the root workspace). There is no `check-types` script — `next build` is the type gate — and no web test framework (no vitest/jest, no `test` script); browser verification requires driving a real browser (the DOM is client-rendered — raw HTML/`curl` greps see only the flight payload). Worked recipe: `chromium --headless=new --no-sandbox --disable-gpu --blink-settings=primaryPointerType=2,availablePointerTypes=2,primaryHoverType=2,availableHoverTypes=2 --remote-debugging-port=9333 --user-data-dir=/tmp/<fresh-profile>` — the blink-settings force `(hover: hover)` (plain headless resolves `hover: none`, silently killing every `hover:*` utility), plus `Emulation.setDeviceMetricsOverride` (default viewport is 800×600 and clips mid-page, and the login form's focus-scroll survives client-side navigation — `window.scrollTo(0,0)` first) and `Emulation.setEmulatedMedia {prefers-color-scheme: light}`. Drive it with node's global WebSocket: Radix dropdown **triggers** open on pointerdown (dispatch `Input.dispatchMouseEvent` mousePressed, hold ~350 ms, mouseReleased — a synthetic `click()` does nothing) while **menu items** select on plain `click()`; the navbar avatar trigger is `[data-slot="dropdown-menu-trigger"].ml-2` (`.outline-none` matches every shadcn button — a language-switcher dropdown elsewhere in the navbar shares it); native setter + `new Event('input', {bubbles:true})` fills React inputs; wait ~10 s after navigation for hydration. Kill chromium with `pgrep -f "[r]emote-debugging-port=9333" | xargs -r kill -9` (bracket trick avoids self-match).

### Shared packages

```bash
pnpm --filter @repo/ui lint               # lint shared UI components
pnpm --filter @repo/ui check-types        # type-check @repo/ui
pnpm --filter @repo/eslint-config lint    # lint eslint config package
```

**`@repo/ui`** exports `./src/*.tsx` — import as `@repo/ui/button`, `@repo/ui/card`, `@repo/ui/code`. Write new shared components here, not in apps.

**`@repo/typescript-config`** — three presets: `base.json`, `nextjs.json`, `react-library.json`. Apps extend these in their local `tsconfig.json`.

**`@repo/eslint-config`** — three presets: `base.js`, `next.js`, `react-internal.js`. Apps import and re-export in their `eslint.config.js`.

## Pipeline workflow

The `.pipeline/` directory tracks feature changes through a structured four-phase workflow:

| Phase     | File              | Purpose                                          |
| --------- | ----------------- | ------------------------------------------------ |
| 1. Spec   | `spec.md`         | Engineering spec with decisions + open questions |
| 2. Impl   | `changes.md`      | Summary of files modified and behavioral diffs   |
| 3. Test   | `test-results.md` | Test gate results (build, lint, suites, count)   |
| 4. Review | `review.md`       | Code review verdict + follow-up tickets          |

`tasks/todo.md` is the running ship log (what changed, how it was verified, open decisions) — append a dated entry per ship; once it ships, record it in `CHANGELOG.md` (`Unreleased` until merged) and drop it from the log.

The `planner`, `coder`, `tester`, and `reviewer` agent types work through this pipeline in order. For new features, start with the planner agent to produce `spec.md`.

## Module README convention

Follow the module README convention in `AGENTS.md`; `apps/backend/src/payment/README.md` and `apps/backend/src/chat/README.md` are the canonical examples.

## Frontend listing-form specs (`spec-detail-*.md`)

`apps/backend/docs/spec-detail-one.md` … `spec-detail-twelve.md` (12 files, ~1,120 lines) are **per-category listing-creation form specifications**, written from the frontend's perspective. They describe each subcategory's `field_schema` conventions (see [`ARCHITECTURE.md`](ARCHITECTURE.md#categories-i18n)). Each file enumerates the form fields for the subcategories of one main category:

| File                    | Main category                                                         | `field_schema` seeded? |
| ----------------------- | --------------------------------------------------------------------- | ---------------------- |
| `spec-detail-one.md`    | Cars & Vehicles (also: the full category tree + profile/auth screens) | yes                    |
| `spec-detail-two.md`    | Phones & Tablets                                                      | yes                    |
| `spec-detail-three.md`  | Computers & Accessories                                               | yes                    |
| `spec-detail-four.md`   | Electronics & Appliances                                              | yes                    |
| `spec-detail-five.md`   | Home & Land (all 12 subcategories)                                    | yes                    |
| `spec-detail-six.md`    | Jobs (all 36 subcategories — one shared form)                         | yes                    |
| `spec-detail-seven.md`  | Services (all 24 subcategories — one shared form)                     | yes                    |
| `spec-detail-eight.md`  | Fashion & Beauty (6 subcategories)                                    | yes                    |
| `spec-detail-nine.md`   | Furniture & Decor (10 subcategories)                                  | yes                    |
| `spec-detail-ten.md`    | Books, Sports & Hobbies (all 7 subcategories)                         | yes                    |
| `spec-detail-eleven.md` | Pets (all 7 subcategories — one shared form)                          | yes                    |
| `spec-detail-twelve.md` | Foods (all 10 subcategories — one shared form)                        | yes                    |

**A spec-detail can be overridden by a captain's mock — and the mock wins.** The electronics ship added Condition to `machinery`/`security-cameras`/`lighting` against `spec-detail-four.md`, and the 2026-09-22 Home & Land ship **removed `facing` from `apartment-for-rent`** against `spec-detail-five.md:53`, because the captain's mock — both the screenshots and the design's own data at `apps/web/lib/post-ad.ts:2887`, which carries only bedrooms/bathrooms/size — omits it. The seed carries an inline comment at that subcategory so the divergence is not "corrected" back later. `field_schema` is therefore the shipped truth, and a bare re-read of a spec-detail file can be wrong; check the seed's own comments for a recorded override before treating spec-detail as authoritative.

**"Shipping a spec-detail"** = translating its forms into `fieldSchema: FieldDef[]` arrays on the matching subcategories in `src/categories/seeds/categories.seed.ts` (conventions in the Categories i18n section). **All 12 main categories are now seeded** — every subcategory carries a `field_schema` (146 `fieldSchema:` data blocks as of the Foods ship; no bare `{ slug, name, sortOrder }` subcategories remain, so there is no next spec-detail to ship). Shared-form categories (one identical `fieldSchema` applied to every subcategory): **Jobs** (`spec-detail-six.md`, 36 subcats), **Services** (`spec-detail-seven.md`, 24 subcats), **Pets** (`spec-detail-eleven.md`, 7 subcats), and **Foods** (`spec-detail-twelve.md`, 10 subcats) — Pets and Foods both use the bare 11-field `commonListingFields` set (no Type, no Condition). The lone mixed case is **Books, Sports & Hobbies** (`spec-detail-ten.md`): `musical-instruments` is a Type+Condition form, the other 6 share one no-Type form.

These are design reference, not runtime docs (the frontend forms are currently hardcoded; `field_schema` is not read at runtime).

## TypeScript constraints

- `tsconfig.json` sets `module: nodenext` with no `"type":"module"` in `package.json` → CJS output. Do **not** add `.js` extensions to relative imports.
- `strict: true` is enabled (with `strictPropertyInitialization: false` to keep NestJS DI-injected class fields declarable without an initializer). Full strict null-checks apply everywhere else.
- `noImplicitAny: true` and ESLint `@typescript-eslint/no-explicit-any: error` are enforced. Use typed interfaces or `unknown` instead of `any`. For Supabase client, use `type AnySupabaseClient = SupabaseClient` and add explicit return-type annotations on storage methods to avoid TS2742.
- Express 5 changed wildcard routing: use `'{*splat}'` in `forRoutes()`, not bare `'*'`.
- `@nestjs/jwt` uses `ms.StringValue` for `expiresIn`; cast runtime string values as `value as unknown as number` when passing to `jwtService.sign()`.

## Tooling quirks

- **Plain `grep` is a mise shim and breaks** (errors "unknown option '-G'") — use `git grep` or the Grep/Read tools.
- **A PostToolUse hook runs prettier on every edited file** (repo style: double quotes, 2-space). A file that isn't prettier-clean gets rewritten right after the edit (quotes, array formatting), so when batching several edits to the same file, re-Read it after the first edit — later old_strings based on the pre-format text fail with "String to replace not found".

## Environment variables

The backend requires a `.env` or `.env.local` file inside `apps/backend/`. Without it, `ConfigModule` throws at startup (Zod validation). Required vars:

| Var                         | Constraint                 |
| --------------------------- | -------------------------- |
| `SUPABASE_URL`              | valid URL                  |
| `SUPABASE_ANON_KEY`         | non-empty                  |
| `SUPABASE_SERVICE_ROLE_KEY` | non-empty                  |
| `DATABASE_URL`              | must start with `postgres` |
| `JWT_SECRET`                | ≥ 16 chars                 |
| `JWT_REFRESH_SECRET`        | ≥ 16 chars                 |

Optional (with defaults): `CHAT_FILES_BUCKET=chat-files`, `CHAT_ATTACHMENT_DAILY_BYTES=209715200` (per-user 24 h upload quota), `PORT=3000`, `DATABASE_POOL_MAX=20` (postgres.js connection pool size, shared by the whole backend — raise if concurrent traffic starts queueing for a free connection; see the Chat section), `JWT_ACCESS_EXPIRES_IN=15m`, `JWT_REFRESH_EXPIRES_IN=30d`, `THROTTLE_TTL=60`, `THROTTLE_LIMIT=100`, `SUPABASE_STORAGE_BUCKET=listings`, `TELEGRAM_BOT_TOKEN`, `FRONTEND_ORIGINS` (comma-separated), `DEV_OTP_TOKEN` (dev only — bypasses Supabase SMS, accepts this fixed token for all phone OTP verifications).

Note: `*.env*` is blocked by **`.gitignore`** — this repo installs **no git hooks** (`.git/hooks/` holds only samples, and there is no `.github/workflows`). The prettier-on-edit formatting comes from a Claude Code PostToolUse hook, not from git.

The web app (`apps/web`) reads two optional env vars (server-side only — never `NEXT_PUBLIC_`): `API_URL` (backend API base; defaults to `http://localhost:3000/api/v1`, consumed by `lib/api/client.ts`) and `SUPABASE_URL` (Supabase project URL; `next.config.ts` parses the hostname at build time so `next/image` can optimize Storage URLs — must match the backend's `SUPABASE_URL`).

**`NEXT_PUBLIC_WS_URL`** (optional, client-visible by design — it's the one exception to the server-only rule above): the chat WebSocket's origin (e.g. `ws://localhost:8080`, or `wss://…` for a tunnel/prod), read by `apps/web/hooks/use-chat-ws.ts`. `API_URL` can't serve double duty here — it's server-only and invisible to a `"use client"` hook. Without this var the hook falls back to a dev heuristic (`localhost:3000`, the backend's default port) that silently breaks the moment the backend runs on any other port: the socket "connects" to whatever's listening there (or nothing), `ws.isConnected` still flips true, and every WS-path send gets optimistically marked "sent" client-side and then vanishes — never reaching the real backend, never persisted. REST sends (the fallback path when WS isn't connected) are unaffected since server actions read `API_URL` correctly. **Must mirror `API_URL`'s host** whenever the backend isn't on the default port.

## IDs

Use `crypto.randomUUID()` from Node's built-in `node:crypto`. There is no `uuid` package dependency.

## Known gaps (track as separate tickets)

- **Signed uploads are still unvalidated server-side** — no MIME or size check on `/files/sign` uploads, since the bytes never pass through the backend (server-side multipart uploads — avatar, cover, feedback — are capped at 5 MB in multer and limited to raster image types). Ownership is enforced since 2026-10-23: user scopes (`listing`, `avatar`, `cover`, `chat`, `report`) sign into `{scope}/{userId}/`, catalog scopes are staff-only, `DELETE /files` lets non-staff delete only their own folders, and listing photos must be the owner's own uploads (`ListingsService.assertPhotosOwned`). Objects under the old flat `listing/…` paths stay valid on their listings but are never cleaned up by the server.
- **No CI and no admin-surface tests.** There is no `.github/workflows`; the Jest suite (28 suites / 315 tests as of 2026-09-27) covers backend units only — stats, users CRUD, subscriptions, reports and attributes have zero coverage.
- **Web ships 6 locales, the backend stores 3.** `i18n/routing.ts` routes `en|km|zh|ko|id|vi` while the backend `localeEnum` is `en|km|zh`, so `ko/id/vi` pages fall back to English names; `preferredLanguage` accepts all six.
- **No `km`/`zh` seed copy.** Category translations contain only `en` values. Add `km`/`zh` keys to `src/categories/seeds/categories.seed.ts` — no code change needed.
- **The Fashion & Beauty `type` lists carry the same two latent divergences (2026-09-27), both inert and both the `bathrooms` shape.** (1) `spec-detail-eight.md` spells the men's and kids' options **`Men's Accessories` / `Baby & Kids Clothing`**, while the seed's inline `options` (written from that spec) and the admin-managed `types` rows disagree with each other: the rows read **`Men Accessories` / `Kid Clothing`**, and the design mock data in `lib/post-ad.ts` sides with the rows. The rows win today (the set is managed), and the mock-wins rule makes them the correct value — but the inline copies are stale, so unlinking every `types` row would swap the form onto names no Browse grid can filter. Deliberately not "fixed" in the seed: unlike a one-line typo this is a spec-vs-design disagreement, and re-spelling the spec's own wording inside a file that cites it would hide which source won. (2) The shared `other` row renders **`Other - ផ្សេងៗ`** where spec-detail-eight says plain `Other` — that one is _not_ a fashion problem, it is the app-wide convention for every `other` row in every family, and `types` is a single shared row across 14 subcategories, so it cannot be spelled per-family anyway.
- **The Furniture & Decor `type` lists carry the same latency divergence (2026-09-27), the Fashion & Beauty shape again.** `spec-detail-nine.md` spells the two Type pickers **`Dining Tables` / `Game Tables` / `Kid's Desks` / `Office Desks` / `Student Desks` / `Wooden Tables`** and **`Kid's Chair & Seats`**, while the seed's inline `options` (written from that spec) and the admin-managed `types` rows disagree with each other: the rows read **`Dining Table` / `Game Table` / `Kids Desks` / `Office Desk` / `Student Desk` / `Wooden Table`** and **`Kids Chairs&Seats`**, and the design mock data in `lib/post-ad.ts` sides with the rows (singular, same spellings). The rows win today (the set is managed) and the mock-wins rule makes them the correct value — but the inline copies are stale, so unlinking every `types` row would swap both forms onto names no Browse grid can filter. Only these two of the ten forms are affected; the other eight declare no `type` at all. The shared `other` row again reads `Other - ផ្សេងៗ` where the spec says plain `Other` — the app-wide convention, not a furniture problem (see the Fashion & Beauty note above).
- **A typeless subcategory gets a dead grid if an admin ever ticks a `types` row for it (2026-09-27, corrected 2026-09-27).** **29** opted-in forms declare **no `type` key at all** — the dozen that made this bullet (Home & Land's `properties-wanted`/`agent-services`/`home-and-land-others`, since 2026-09-23; this bullet previously called `beauty-and-healthcare-products` the first, which was already untrue when it was written, Fashion's `beauty-and-healthcare-products`, and Furniture & Decor's eight no-Type forms) plus **all 7 of Pets and all 10 of Foods** (2026-09-28 — both families are the bare `commonListingFields` form, which has no `type` key). All 29 have zero `types` rows ticked today, so nothing renders and the hazard is inert. But `types` is listed in `ATTRIBUTE_SET_TITLES`, so ticking _any_ `types` row for one of them would grow a "Type" grid whose click resolves through `SET_FIELD_KEYS.types = ["type"]` to `undefined` (the schema declares no `type`), falling back to the legacy `bodyType` path and filtering a key no listing has — an empty feed with no message. The fallback itself is deliberate ("the previous behaviour beats a second way to empty the feed"), so the real guard is configuration: those subcategories should simply never have a `types` row ticked.
- **Two latent jobs-family divergences (2026-09-23), both inert today and both the `bathrooms` hazard shape** (a mapped attribute set and its inline `field_schema` fallback that disagree). (1) The seed's inline job-type `options` still spell `Internship`/`Other` while the admin-managed `jobtypes` set — which the form actually reads, since it is managed and wins — spells `Internships`/`Other-Jobs`; unlink every `jobtypes` row and the form would fall back to the inline list and start writing names the browse grid can never match. (2) The `experiences` set names are singular (`2 Year+`) against the inline `2 Years+` the form writes; inert while all 11 rows stay unlinked, but the first tick anywhere flips the set to managed for every subcategory at once. Note the `jobtypes` rows' `subcategoryIds` are frozen at first insert (`attributes.seed.ts` is insert-only), and the jobs form depends on those 36 ticks — an older database cannot be repaired by re-seeding alone.
- **`photos` is the one schema key with no render gate (2026-09-27).** Every other `ListingPostForm` block is wrapped in `has("<key>")`; `ImageUpload` renders unconditionally (`ListingPostForm.tsx:691`), so a subcategory whose `field_schema` omitted `photos` would still show a dropzone at the `max = 8` default instead of not rendering. Inert today — all 146 subcategories declare photos — but it is the thing to check before opting in a form that does not.
- **A subcategory created through the admin UI still has no working post form (2026-09-28, found by this ship's audit — do not "clean up" the mock branch).** `REAL_FORM_SUBCATEGORIES` is a hardcoded list and the **seed is the only writer of `field_schema`** (`CreateSubcategoryDto`/`UpdateSubcategoryDto` carry no such field, and `categories.service.ts` only reads it), so a subcategory an admin creates via `POST /admin/subcategories` is served by the API with a NULL schema and a slug no opt-in entry names — which lands it on the deliberately-unwired mock `DynamicForm` (`app/[locale]/(user)/post/(publish)/page.tsx`), whose submit goes nowhere: **such a subcategory cannot publish an ad at all**. Pre-existing, but before 2026-09-28 it was indistinguishable from the not-yet-opted-in families; now it is the only route into that branch, so `DynamicForm` + its `EMPTY_OPTION_LISTS` normalisation (`actions/post-categories.ts`) + `lib/post-ad.ts` (6,542 lines, imported only by it) are **load-bearing, not dead code** — deleting them would swap the dead-end form for the real form with `fields: []`, i.e. a photos-only form. A real fix is a product decision: let admins author `field_schema`, or give new subcategories a default one (plus a slug entry here). **Do not "simplify" this gate to `fields.length > 0`**: the hardcoded list is what catches a _non-empty_ schema holding a key the form has no block for — the silent-vanish failure it exists to prevent — while a length check would wave exactly that case through. Separately, **`apps/web/lib/subcategoryGroups.ts` (114 lines) IS genuinely dead** — zero importers, and its slug lists are stale too (`baby-and-kids-fashion`, `tables-and-desks`, `curtain-and-carpet`, `parts-accessories` are not real slugs), so it is the safe first deletion if the mock era is being cleared.
- **Test/E2E debris has no cleanup path, and the demo seed does not cover the newer families (2026-09-28).** `listings.seed.ts` deletes junk by an exact-title list (`JUNK_TITLES` — 7 cars-era strings), so every family shipped since has left its verification listings behind: **15 active test/E2E rows were live in the dev DB** when this was written, from the 2026-09-23…09-28 ships (jobs, services, fashion, furniture, books, pets, foods + a home-and-land `test`), and a re-seed removes none of them. Separately, `DEMO_LISTINGS` (23 rows) covers cars-and-vehicles (14), phones-and-tablets (2), home-and-land (2) and one each for jobs/furniture-and-decor/fashion-and-beauty/electronics-and-appliances/computers-and-accessories — **zero for pets, foods, services and books-sports-and-hobbies**, so deleting that debris would leave those categories' feeds empty (Foods today holds exactly one listing and it is such a row). Two decisions left open, deliberately not taken here: delete the debris (switching `JUNK_TITLES` to a pattern such as `ILIKE '%E2E%'` so the list stops needing maintenance), and add demo rows for the four uncovered families.
- **An unverified phone can become the login identifier.** `addPhone`/`setPrimaryPhone` set `users.primaryPhone` without an OTP (only the phone-change flow verifies), so a user can claim a number that is not theirs and block its owner from registering with it. Product decision pending: require the OTP flow for primary changes, or keep `user_phones` contact-only.
- **Follower lists need a login, and a `follow.created` notification is not transactional with the edge (2026-09-28).** Two deliberate first-cut limits of the follow feature. (1) `GET /users/:id/followers|following` require a JWT — that is what buys per-row `isFollowing` in one round trip, and it is why an anonymous visitor clicking "Followers" is bounced to `/login`; making them public again is a one-line guard change, but each row would then lose its toggle state. (2) `followUser` inserts the edge and _then_ calls `NotificationsService.notify()`, which uses its own Drizzle client and so cannot join the insert's transaction: if the notification throws, the follow is already committed and the request 500s. It self-heals rather than duplicating — the `.returning()` guard means a retry writes no second notification — so the worst case is a lost notification, never a wrong one.
- **The dev DB's migration ledger needed a repair to apply `0027`, and any DB built from the pre-merge branch ordering will need it again (2026-09-28).** drizzle-orm 0.36.4's migrator compares **only the newest `created_at`** in `drizzle.__drizzle_migrations` against each journal entry's `when` (`pg-core/dialect.cjs`); it does no per-hash membership check. Because `0021`–`0026` were renumbered on the chat merge, they were _applied_ under their branch-era timestamps, so the watermark sat at `1790235946854` while their journal `when`s are `1790061786624`–`1790406709559` — leaving `db:migrate` believing `0023`–`0026` were unapplied and ready to re-run (it would have failed on `CREATE TABLE "notifications"`). Fixed by syncing each applied row's `created_at` to its journal `when` (keyed by content hash, backup table `drizzle.__drizzle_migrations_backup_20260928`). **A fresh dev DB seeded in the old branch order will drift again** — check the watermark before trusting `db:migrate`.
- **Mock profile URLs no longer resolve (2026-09-28).** `/[username]` and `/[username]/about` used to read the hardcoded `users` array in `apps/web/lib/user.ts`; they now look the handle up against real accounts (`GET /users/by-username/:username`) and `notFound()` otherwise. So the old demo handles (`/en/nenneang`, `/en/reahuhin`, …) 404 by design. `lib/user.ts` itself is still live — its `User` type is the render contract the profile templates take, and `toProfileUser` in `lib/api/users.ts` adapts a real profile onto it. (`apps/web/lib/users.ts` remains genuinely dead — zero importers, and it defines a _different_ `User` from `@/types/user`.)
- **No delete-account flow yet.** Nothing sets `users.deletedAt` via user-facing flow (admin can soft-delete via `DELETE /admin/users/:id`, which also frees `user_phones` rows). The user-facing delete-account flow still needs to be built.
- **Geography names are half-i18n'd.** `name_km` carries Khmer (2026-09-12) but the endpoints still serve only `name`, so `km` users read Latin place names; no `name_zh` exists. Wiring `name_km` plus a locale branch into `LocationsService` is the remaining step.
- **`PublicUser` over-exposes fields cross-user.** `GET /users/:id` returns `Omit<UserRow,'passwordHash'>`, exposing `deletedAt`, verification timestamps. Consider narrowing to an explicit allow-list.
- **Geography seeded (2026-09-12) — the communes gap is closed.** Provinces/districts/communes are complete (25/208/1,652) with `name_km`, and a posted listing now stores the real `provinceId`/`districtId`/`communeId`. Still open: **villages** are deliberately not modelled (the source has 14,442), there is no `zh` name and no locale negotiation on the geo endpoints, and the **data file is a checked-in snapshot** — refreshing it means re-running the generator against the gazetteer and re-seeding (the file's `meta` records source + retrieval date).
- **Attribute `:type` param is unvalidated.** Any string works against `attribute_options.type` (`varchar(60)`) — a typo'd type in the API silently creates a new attribute set. Consider validating against the seeded/admin type allowlist.
- **Motorcycle brands seeded as of 2026-08-31** (31 rows incl. the `-moto` suffixed Honda/Suzuki/BMW); the known-gap note about an unseeded list is resolved — see the MOTO_BRANDS paragraph in the Brands section.
- **No push notifications for chat.** Realtime now fans out across backend instances via Redis pub/sub (`ChatPubSubService` — see the Chat section), but there's still no FCM/APNs layer: a backgrounded mobile app or a closed tab only catches up on its next poll, not instantly.
- **Legacy chat images are public-bucket URLs.** Historical `messages.imageUrl`/`imagePath` rows still render as stored; new media goes through encrypted attachments (private bucket). There is no plaintext fallback: with `NEXT_PUBLIC_E2E_ATTACHMENTS=off` (or no v2 device) images and voice notes fail closed instead of falling back. No migration of old images yet.
- **WS rate limiting is per-instance, not global.** `ChatGateway`'s 30/min send limiter is an in-memory `Map`, so under multiple backend instances the effective global limit is `30 × instance count`. The REST route's `@Throttle` has the same per-instance-storage caveat (no `ThrottlerStorageRedisService` configured). Non-issue at MVP scale; needs a shared counter (Redis) before running more than one instance under real abuse pressure.
- **Inline `field_schema` duplication.** ~10 no-Type/no-Condition subcategory forms (all of Pets, Foods, and the no-Type Furniture blocks) are byte-identical to `commonListingFields` yet re-inline all 11 fields (~75 lines each) instead of referencing the const. Consistent by current convention but heavy; a one-time systemic refactor (e.g. `fieldSchema: [...commonListingFields]` for exact-match subcats) could DRY it. Non-blocking — do it once across all categories, never per-ship.
- **`super_admin` vs `admin` permission gradation is account management only.** Every admin user mutation goes through `assertCanManageUser` (`admin/admin-user-policy.ts`, via `AdminService.authorizeManage`): only `super_admin` may grant staff roles or edit/suspend/delete an `admin`/`super_admin` account, nobody may delete, demote or suspend themselves, and the last active super_admin can never be removed (counted under a row lock). Approving a user report goes through the same check. The Team management page (`/wanderer/dashboard/team`) is super_admin-only — guarded at both the page level (`redirect` for non-super_admin) and the sidebar (the Team link is hidden from regular admins). Beyond role assignment, `admin` and `super_admin` are treated identically by all other `@Roles('admin', 'super_admin')` guards. Add finer-grained permission distinctions if needed later.
- **Most user-facing surfaces are mock data** — the real islands are: the `/me` header (`components/profile/MyProfileHeader`, real session via `me/layout.tsx`), the homepage **Browse By Category** grid + **Latest Ads** (real listings feed since 2026-08-31; Top Ads section stays mock), the **category/subcategory pages** (names/slugs/icons + live brand/type option grids), the **entire cars-and-vehicles category feed surface** (all 10 subcategories since 2026-08-31), and since 2026-08-31 **every category & subcategory feed is real** (browse bar chip flags per category, grid/list toggle, live listings, generalized attribute grids — see "Real listing surfaces"), plus **real listing detail** (post form → publish → detail, from 2026-08-27, extended 2026-08-29 with contact-phone carrier icons and the generalized Description specs grid). Still hardcoded: every `/me/*` subpage **except Likes and Saved** (real since 2026-10-05 — see the Likes & Saved section); the rest import the mock `currentUser` from `lib/user.ts`. **The post form is real for the whole catalogue — all 146 of its 146 subcategories** — all 10 cars-and-vehicles (2026-09-16), all 5 phones-and-tablets + all 7 computers-and-accessories + all 12 electronics-and-appliances (all 2026-09-22), **all 12 of Home & Land** (4 on 2026-09-22, the remaining 8 on 2026-09-23 — so that category is complete), **all 36 of Jobs** (2026-09-23, which also renamed the family's job-type key `type` → `jobType`), **all 24 of Services** (2026-09-27 — no new block needed; the family declares no price at all, so its ads read "Negotiable", and `spec-detail-seven.md` and the seed agreed field-for-field), **all 6 of Fashion & Beauty** (2026-09-27 — five declare `type`, the sixth is the family's only form without it, and Fashion Accessories' one picker reuses the existing `accessory` block and `accessories` set under its own "Accessory Type" label; see the `accessory` bullet above), and **all 10 of Furniture & Decor** (2026-09-27 — only Table & Desks and Chairs & Sofas declare `type`; the other eight are the plain 11-field form, and the whole ship was the slug list), and **all 7 of Books, Sports & Hobbies** (2026-09-27 — the catalogue's mixed family: only `musical-instruments` declares `type` + `condition`; the other six are the plain 11-field form, so nothing was added to them and the ship was the slug list; its Type options are the 11 admin-managed `types` rows ticked for it, which spell "Traditional-instruments" where `spec-detail-ten.md` says "Traditional Instruments" — the rows agree with the design mock, so the rows stand), and **all 7 of Pets + all 10 of Foods** (2026-09-28 — the last two families, and the cheapest ships of the series: both are the bare 11-field `commonListingFields` form, and **every one of their 17 seeded `fieldSchema` arrays is field-for-field identical to that const** — proven by parsing the seed's AST, not by eye — while `spec-detail-eleven.md` and `spec-detail-twelve.md` (15 lines each, "they have the same form") agree with the seed key for key. No new block, no seed change: the whole ship is the 17 slugs plus these counts. Their subcategory lists come from `spec-detail-one.md:194-202` (Pets) and `:203-214` (Foods) — the two 15-line spec files only point there). **No seeded subcategory reaches the mock `DynamicForm` any more** — all 146 render the real form — so that branch is now a fallback only for a subcategory created through the admin UI afterwards; it stays load-bearing, not dead code (see Known gaps). **Since 2026-09-12 step 1 feeds them REAL categories/subcategories** (`actions/post-categories.ts` → `getAllCategories`), and that action normalises their option lists to empty arrays so the mock form's unguarded `.map()` calls cannot crash — so those pickers render empty rather than mock options, the `lib/categories.ts` mock consumed by `PostForm.tsx`, `SearchBar.tsx`, `AllAdsCategories.tsx`, `lib/data.ts`, the **all-ads page feed** (`AllAdsHeader.tsx` still reads `lib/posts`), and `/me`'s My Ads list (a posted listing does NOT appear there yet). Phase C (mock → real for the profile surfaces) is the remaining user-account work.
- **Catalog images have no Storage backing at all (2026-09-10, audited across every image column).** The `product-images` bucket holds ONLY an `avatar` folder — no `brand/`, `attribute/`, `category/`, `subcategory/` or `listing/` objects. Of the 306 rows carrying an image, **154 point at local `/sub-img/…` files bundled in the web app** (the 91 car + 31 moto brand logos, 11 musical-instrument types, 5 rent body types — every file exists) and **152 are Supabase URLs whose objects are gone** (7 category icons, 62 subcategory icons, 56 brand icons, 27 attribute images — Supabase answers HTTP 400 with a `404 NoSuchKey` payload). Both sets now render as the "no image" state: `DbImage` accepts only a Storage object URL, so a bundled path is rejected exactly like a deleted object (see the Web app section). **Captain's decision (2026-09-10): leave it imageless** — nothing is uploaded and no rows are rewritten; icons return only when an admin uploads them through the admin UI. Do not "fix" this by re-adding bundled paths or a static fallback.
- **Specs-grid brand links are best-effort.** `buildRealDetailData` derives brand slugs via `slugify(attribute name)` into `real.brand.slug`, which can diverge from backend `brands.slug` rows (e.g. `mercedes-benz` vs `mercedesbenz`) — the `?ad_field=` link then lands on the unfiltered subcategory page. Model links (`ad_model`) only highlight the model grid, never filter the feed. Carrier-icon detection covers only the 4 carriers that have `/icon` assets (Qube and unknown prefixes get the S/C letter-badge fallback).
- **`generateUniqueUsername` race.** Check-then-insert with no 23505 retry — concurrent same-name creates (e.g. two OTP verifies at once) can 500. Add retry-on-unique-violation in the consumers (Telegram login, `updateProfile`, phone-OTP verify).
- **`phoneVerifiedAt` is never written** though the column exists, and a soft-deleted user keeps its global-unique `user_phones` row so a re-registered active user ends up with `primaryPhone` but no `user_phones` row.
- **Username uniqueness is case-sensitive.** Login also matches the lowercased identifier (2026-10-23), so typed-cased handles find generated ones, but the partial unique index is exact-case — an admin can create `Bob` next to `bob`.
- **`src/tenant/` is a design doc, not code.** `tenant/README.md` sketches a proposed `tenants`/`tenant_members` schema meant to eventually back `payment_transactions.tenantId` (currently a bare, FK-less UUID — see the Payments section) and possibly scope `user_subscriptions`. No schema file, migration, or `src/db/schema/index.ts` export exists yet — treat it as a proposal to reference, not something implemented.
- **Moderation, reports and feedback (2026-10-23).** Staff take ads down via `/admin/listings/:id/remove` (or by approving a listing report): `listings.moderatedAt`/`moderatedById`/`moderationReason`, status `deleted`, owner blocked from edit/publish (`LISTING_REMOVED_BY_ADMIN`), public `GET /listings/:id` 404s; restore re-derives the status and reconciles the owner's plan. A restored ad the owner had already deleted comes back live — the prior status is not kept. Users file reports via `/reports/listings|users` (one pending report per reporter+target, partial unique index). Feedback is `src/feedback/` (public multipart `POST /feedback`, admin list/delete). Migration `0040_moderation_feedback`. Not yet: the owner's My Ads page does not explain a removal; Manage Advertisement Ads and an admin Payments page are not built.
