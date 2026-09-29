# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Approach for Agents

You are a pragmatic senior engineer. Your job is to help design and build a long-term maintainable backend API.

Non-negotiable rules:

1. Prefer modular monolith with strict module boundaries
2. Evolutionary design — extract services only when there is a clear need
3. Strong typing + OpenAPI contract-first
4. PostgreSQL as primary database
5. Every suggestion must include trade-offs and a path to evolve later
6. Never introduce complexity (Kafka, microservices, CQRS, etc.) unless explicitly requested

For a design/architecture question (not a direct code-edit request), respond with:

- Reasoning (max 5 bullets)
- Concrete recommendation
- Risks
- What to verify next

## Monorepo layout

pnpm + Turborepo. Packages are scoped with `pnpm --filter <name>`.

| Path                          | Name                      | Stack                            |
| ----------------------------- | ------------------------- | -------------------------------- |
| `apps/backend/`               | `backend`                 | NestJS 11, Drizzle ORM, Supabase |
| `apps/web/`                   | `web`                     | Next.js                          |
| `packages/ui/`                | `@repo/ui`                | Shared React components          |
| `packages/eslint-config/`     | `@repo/eslint-config`     | Shared ESLint config             |
| `packages/typescript-config/` | `@repo/typescript-config` | Shared tsconfigs                 |

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

## Backend architecture

### Request lifecycle

```
Request
  → IdempotencyMiddleware  (POST/PATCH/PUT only; middleware runs before guards)
  → JwtAuthGuard          (global APP_GUARD #1)  ← skipped if @Public()
  → UserAwareThrottlerGuard (global APP_GUARD #2) — keys on req.user.id when JwtAuthGuard set one, else IP
  → ValidationPipe (whitelist + transform)
  → Handler
  → ResponseInterceptor  → { success, data, meta? }
  → GlobalExceptionFilter  (on throw)
```

JwtAuthGuard runs first specifically so the throttler can see `req.user` — a fairness fix for shared-NAT traffic (one busy office/campus no longer shares a single IP-keyed bucket). `UserAwareThrottlerGuard` (`common/guards/user-aware-throttler.guard.ts`) falls back to IP for anonymous/public requests, where `req.user` is never set.

### URL structure

Global prefix `api`, excluded for `GET /` and `GET /health`. URI versioning with `defaultVersion: '1'`.

- Root: `GET /` → `Hello World!` (no auth, no prefix)
- Health: `GET /health` (no auth, VERSION_NEUTRAL)
- All other routes: `/api/v1/<resource>/...`

### Auth model

- `@Public()` on a handler or controller class bypasses `JwtAuthGuard` entirely. Without it, a valid `Bearer` token is required.
- JWT payload is exactly `{ sub, role }` where `role` is `'user' | 'admin' | 'super_admin'`. `JwtStrategy.validate` (`src/auth/strategies/jwt.strategy.ts`) checks the DB, rejects soft-deleted users (`deletedAt` set), and sets `req.user` as `RequestUser { id, role }`. `super_admin` satisfies every `@Roles('admin', 'super_admin')` guard. The only current permission gradation: only `super_admin` can assign `admin`/`super_admin` roles (`AdminService.createUser`/`updateUser` throw `ForbiddenException` otherwise), and the Team page is super_admin-only.
- Use `@CurrentUser() user: RequestUser` to access the authenticated user in a handler.
- Dual tokens: short-lived `accessToken` (default 15 min) + long-lived `refreshToken` (default 30 d). `refreshToken` uses a separate `JWT_REFRESH_SECRET`.
- Soft-delete is enforced at all three entry points: `loginWithPassword`, `refresh`, and `JwtStrategy.validate`.

### Auth flow — phone registration & login (OTP + password)

```
POST /api/v1/auth/register   { phone }                        → sends OTP via Supabase (or dev bypass)
POST /api/v1/auth/otp/request { phone }                       → re-sends OTP (public; E.164-validated via RequestOtpDto)
POST /api/v1/auth/otp/login  { phone, password }              → login-mode: validates credentials, THEN sends OTP (unknown phone / wrong password → 401, no SMS)
POST /api/v1/auth/otp/verify { phone, token, password,
                              firstName?, lastName? }         → verifies OTP; creates the account (register) or logs in the existing user
```

`verifyPhoneOtp` is the single creation/login chokepoint. It looks up the active user by `primaryPhone` first:

- **User exists** — the submitted `password` must match (`bcrypt.compare`); mismatch → 401 **before** any OTP is consumed. The conflict path can never overwrite credentials: payload extras land only in the INSERT `.values()`, while `onConflictDoUpdate.set` stays `{updatedAt}` (locked by a unit test). Even a replayed body with a fresh password/names/username is ignored.
- **User absent or a legacy bare account** (null `passwordHash` — created before passwords were required) — the verify **completes the account in place**: bcrypt-hashes the password (10 rounds), stores `firstName`/`lastName`, and generates a unique username via `generateUniqueUsername(buildUsernameBase(first,last))` → `sokdara`, `sokdara2`, …. Names carry from the web register form; a phone-digit fallback is deliberately avoided so the nicer name-based handle stays free.
- Verify **without** `password` is a 400 — there is no passwordless login path (the public `otp/request` resend can never be a backdoor).

`mirrorSupabaseUser` in `auth.service.ts` upserts users without a Supabase-specific ID: phone auth conflicts on `primaryPhone`; social auth (Google/Facebook) conflicts on `email`. Both paths insert into `user_auth_providers` and `user_phones` (isPrimary: true) when a phone is present. Soft-deleted phones don't conflict (partial index with `WHERE deleted_at IS NULL`) — a fresh row is created with the extras.

### Database access

`DbModule` is `@Global()` — never import it in feature modules. Inject the typed Drizzle client with `@Inject(DRIZZLE) private readonly db: DbClient`. For raw SQL (e.g. health ping), inject `@Inject(PG_CLIENT) private readonly sql: postgres.Sql`.

Drizzle is configured with `casing: 'snake_case'`: write schema column names in camelCase; the driver maps to `snake_case` in the DB automatically.

Schema files live in `src/db/schema/` and are re-exported from `src/db/schema/index.ts`. Add new tables there.

### Supabase

`SupabaseModule` is `@Global()` — never import it in feature modules; inject `SupabaseService` directly. It exposes one admin client (service-role key) and a helper to create a user-scoped client. Auth (OTP, social OAuth, token validation) and storage operations go through `SupabaseService`.

`signInWithOtp` and `verifyOtp` support a dev bypass via `DEV_OTP_TOKEN` env var — when set, no SMS is sent and that fixed token is accepted. Keep the value at 6 digits or fewer — the web OTP input (`apps/web/components/auth/OtpVerifyForm.tsx`) has 6 single-digit boxes, so a longer token can never be entered. Currently `000000` in `apps/backend/.env`; changing it requires a backend restart. In dev, the Supabase-side fake user id is the literal string `'dev'`; the local `users.id` is DB-random (`defaultRandom`), and repeat-login identity is guaranteed by the `primaryPhone` upsert in `mirrorSupabaseUser`.

### Response envelope

`ResponseInterceptor` wraps all non-string handler return values:

```json
{ "success": true, "data": <value>, "meta": <pagination?> }
```

String return values pass through unwrapped (preserves `GET /` → `Hello World!`). Errors from `GlobalExceptionFilter` have shape `{ "success": false, "error": { "code", "message", "details?" } }`.

### Idempotency

`IdempotencyMiddleware` runs on POST/PATCH/PUT. Clients include an `Idempotency-Key` header. The middleware hashes the request body (SHA-256) and stores key+method+path+user in the `idempotency_keys` table (unique with `NULLS NOT DISTINCT` so anonymous requests dedupe too). Because middleware runs before guards, it verifies the `Bearer` token itself (via `JwtService`) to resolve the user; invalid/absent tokens are scoped as anonymous (`user_id NULL`). First-request detection uses `INSERT … ON CONFLICT DO NOTHING … RETURNING`: a returned row means "we own it, proceed"; a conflict means replay (completed), 409 (processing < 30 s), 422 (processing with different body hash), or reclaim (failed rows are flipped back to processing, not deleted). Known gap: body-hash mismatch on completed rows is not yet checked (returns cached response instead of 422).

### Categories i18n

Categories and subcategories use **four tables**, not two:

| Table                      | Purpose                                            |
| -------------------------- | -------------------------------------------------- |
| `categories`               | Structure only (slug, icon, sort_order, is_active) |
| `subcategories`            | Structure + `field_schema` JSONB                   |
| `category_translations`    | `(category_id, locale, name, description)`         |
| `subcategory_translations` | `(subcategory_id, locale, name, description)`      |

Supported locales: `'en' | 'km' | 'zh'` (the `localeEnum` pgEnum). Locale is resolved from the `Accept-Language` request header via `resolveLocale()` in `src/categories/locale.util.ts`.

`CategoriesService` uses **two aliased LEFT JOINs** per query (one for the requested locale, one for `'en'`), then COALESCE in JS:

```ts
name: row.reqName ?? row.enName ?? row.cat.slug; // slug is the last resort
```

**`field_schema` JSONB** stores a `FieldDef[]` array describing the listing creation form fields for that subcategory. The frontend is currently independent (hardcoded forms), so `field_schema` is present but not consumed at runtime. `FieldDef` type is defined in `src/db/schema/categories.schema.ts` — key, label (i18n), type (`text | number | select | boolean | price | discount | photos | location | contact`), required, options?, max?.

When populating `field_schema` from a `spec-detail-*.md` file (see "Frontend listing-form specs"), copy the conventions already used by the seeded categories (cars/phones/computers/electronics/home-and-land/jobs/services/fashion-and-beauty/furniture-and-decor/books-sports-and-hobbies/pets/foods) so entries stay consistent: reuse the module-level `conditionField` const in `categories.seed.ts` (do not redefine it); write photos inline as `{ key: 'photos', type: 'photos', max: 8 }`; map "Name / Phone Number (up to 3) / Email" to `contactName` / `contactPhones` (`max: 3`) / `contactEmail` (all `type: 'contact'`); fold "Address" + "(set on Google Maps)" into a `location` field plus a `text` `address` field (there is no separate maps field); key any "Type" picker as `type` with `type: 'select'` + `options`; labels are `en`-only. Use `type: 'number'` for a free numeric quantity the frontend renders with a fixed unit (e.g. Home & Land `size`, shown as `m²`), and reserve `select` for enumerable numerics (`storage`, `year`); reuse `conditionField` only when the form actually has a Condition field — not every category does (Home & Land forms carry no Condition/discount/free-delivery fields). The seed upsert in `src/db/seed.ts` writes `field_schema` on conflict, so re-running `db:seed` is idempotent. (Counting tip: `grep -c "fieldSchema:"` skips the `fieldSchema?:` type-def line.) When a spec-detail file states all subcategories of a main category share one form (Jobs/`spec-detail-six.md` and Services/`spec-detail-seven.md` both say "the same form"), apply one identical `fieldSchema` array to every subcategory. **The photos `max` is per-category — read each spec's own `Photo (0/N)` line; never generalize across categories:** Jobs (`spec-detail-six.md` = `Photo (0/1)`) → `max: 1`; Services (`spec-detail-seven.md` = `Photo (0/8)`) → `max: 8`; most categories use `max: 8`.

**`commonListingFields`:** the seed defines a module-level `commonListingFields` const — the 11-field set photos(max 8)/title(req)/price(req)/discount/description/location/address/deliveryFree/contactName/contactPhones(max 3)/contactEmail (the camera form minus any Type and Condition fields). Many subcategory forms equal this set exactly (e.g. all of Pets and Foods, and the no-Type Furniture blocks like `wardrobe-and-cabinets`). **By current convention these are written out INLINE**, field-for-field, matching the existing blocks — do **not** write `fieldSchema: commonListingFields`. No block references the const as a whole `fieldSchema` value; it is only ever spread for the photos field via `...commonListingFields.filter((f) => f.key === 'photos')`. (A spec-detail spec that recommends the bare const reference is wrong about the convention — verified this way in the Pets/Foods ships. Collapsing the inline duplication into a shared reference is a tracked follow-up; see Known gaps.)

**Seed (`src/db/seed.ts`):** runs geography → categories → brands → models → attributes → admin → reports in order. All seeds are idempotent; the models + attributes seeds are insert-only (never overwrite admin edits).

### Users schema

The `users` table relates to **six satellite tables**:

| Table                 | Purpose                                                                 |
| --------------------- | ----------------------------------------------------------------------- |
| `user_phones`         | Phone numbers (`phone unique`, `isPrimary`, owned by `userId`)          |
| `user_auth_providers` | One row per (user, provider): `telegram`, `phone`, `google`, `facebook` |
| `user_blocks`         | Directional blocks; unique `(blocker_id, blocked_id)`, both FKs cascade |
| `provinces`           | 25 Cambodian provinces (slug unique, seeded)                            |
| `districts`           | ~200 districts; unique on `(province_id, slug)` (25 seeded)             |
| `communes`            | ~1600 communes; unique on `(district_id, slug)` (0 seeded yet)          |

Key columns on `users`:

- `username / primaryPhone / email` — unique via **partial unique indexes** (`WHERE deleted_at IS NULL`), so soft-deleted users release their identifiers for re-registration. Upserts targeting these columns must pass `targetWhere: isNull(users.deletedAt)` (see `mirrorSupabaseUser`), and single-row lookups must filter `isNull(users.deletedAt)`. Username generation lives in `src/users/username.util.ts` — `buildUsernameBase(first,last)` (lowercase/NFC, space-stripped) feeds `generateUniqueUsername(db,base)`: probes `users.username`, suffixes `base, base2, base3…` (skips 1), caps at 50 chars; the probe checks ALL rows including soft-deleted (stricter than the partial index). Wired into: Telegram login insert, `updateProfile` lazy backfill (only while `username === null`), and phone-OTP registration. Check-then-insert → a 23505 race is possible (see Known gaps).
- `provinceId / districtId / communeId` — nullable FKs to lookup tables (no cascade)
- `deletedAt timestamp` — soft-delete; `status='deleted'` + `deletedAt=now()`
- `preferredLanguage default('en').notNull()` — also drives the admin UI locale (the `/wanderer/*` surface reads it via an `admin_locale` cookie seeded at login; the in-dashboard `LocaleSwitcher` writes back via `PATCH /users/me`). DTO allowlist: `en, km, zh, ko, id, vi`.

`user_phones` enforces at most one `isPrimary` row per user via a partial unique index (`user_phones_user_primary_uq`). `user_phones.phone` stays globally unique (not freed by soft-delete).

**Phone management endpoints** (all require JWT): `POST /api/v1/users/me/phones`, `DELETE /api/v1/users/me/phones/:phoneId`, `PATCH /api/v1/users/me/phones/:phoneId/primary`. Ownership is enforced via `and(eq(id), eq(userId))`.

**Block endpoints** (all require JWT): `GET/POST /api/v1/users/me/blocks`, `DELETE /api/v1/users/me/blocks/:userId`. Blocking is idempotent (`onConflictDoNothing`); a block in either direction makes chat sends fail with 403 (see Chat).

**Activity tracking:** `LastSeenInterceptor` (global `APP_INTERCEPTOR`) calls `ActivityService.touch(userId)` on every authenticated request. `touch` is fire-and-forget with a 5-minute in-memory throttle per user.

**Migration status:** `drizzle/migrations/` holds generated migrations `0000`–`0025` (plus `meta/`). `0000_perfect_ultimatum` creates all 9 enums and the bulk of the schema (categories/subcategories, users, listings, brands/models, idempotency_keys); `0001`–`0002` alter `users`; `0003` adds `listing_photos`; `0004_premium_mephisto` swaps `users` uniques for partial indexes + listing CHECK constraints; `0005_nosy_monster_badoon` adds chat tables + `user_blocks`; `0006_overjoyed_doorman` narrows chat timestamps to `timestamp(3)`; `0007_far_pet_avengers` adds `attribute_options`; `0008_legal_barracuda` adds subscription tables (4-tier hierarchy: categories→plans→packages→terms + `user_subscriptions`); `0009_tidy_screwball` adds report tables (`report_reasons`, `user_reports`, `listing_reports`); `0010`–`0011` are prior uncommitted migrations; `0012_blushing_sentinel` extends `user_role` enum with `'super_admin'` (`ALTER TYPE … ADD VALUE`); `0013_absent_tarantula` adds `outbox_events` (the transactional outbox — see `src/outbox/`); `0014_add_payment_ledger_entities` creates the 9 payment/ledger tables (still in `public` at this point); `0015_move_payment_tables_to_payment_schema` moves all 9 of those tables (+ their enums) from `public` into a dedicated `payment` Postgres schema — see the Payments section; `0016_move_chat_tables_to_chat_schema` does the same for `conversations`/`messages`, moving them into a dedicated `chat` Postgres schema (`src/db/schema/chat.pg-schema.ts`, mirroring `payment.pg-schema.ts`) — cross-schema FKs into `public.users`/`public.listings` are unaffected, Postgres and Drizzle both handle those with no special casing; `0017_perfect_tarantula` adds the E2E key tables (`user_e2e_identities`, `user_e2e_one_time_prekeys`) and `messages.isE2e`/`messages.e2eHeader`; `0018_friendly_pandemic` adds `user_e2e_identities.identitySigningKey` (the separate Ed25519 signing key — see the Chat section). `0019` adds `messages.clientMessageId` (send idempotency); `0020` adds `notifications`; `0021` adds per-side conversation delete (`deleted_by_user_a_at`/`_b_at`); `0022_conscious_rocket_racer` adds `messages.groupId` (`0022_add_message_group_id.sql` is an orphan — not in `_journal.json`, never runs); `0023` adds E2E multi-device (`user_e2e_devices`, `user_e2e_device_prekeys`, `message_envelopes`, `messages.e2eVersion`/`senderDeviceId`); `0024` adds history backup (`e2e_backups`, `e2e_backup_segments`, `e2e_history_requests`, device `label`); `0025` adds `e2e_backups.keyProofHash`; `0026` adds `chat.attachments` (encrypted chat files). **Gotcha:** `db:migrate` only compares each file's journal `when` against the newest `created_at` in `drizzle.__drizzle_migrations`; the shared dev DB holds a row from a migration not on this branch (stamped 2026-09-27), so any older unapplied file is silently skipped (`0024` hit this and was applied by hand + recorded). If a migrate fails on a missing relation, check that table first.

**Cambodian geography seed** (`src/db/seeds/cambodia-geography.seed.ts`): 25 provinces, 25 districts (one per province), 0 communes.

### Locations API

`LocationsModule` (`src/locations/`) exposes three public read-only endpoints:

```
GET /api/v1/locations/provinces
GET /api/v1/locations/provinces/:slug/districts
GET /api/v1/locations/provinces/:pSlug/districts/:dSlug/communes
```

All `@Public()`. Returns `[]` (not 404) when no results exist.

### Brands

`BrandsModule` (`src/brands/`) — lookup tables for brand/model selects on listing forms.

```
GET /api/v1/brands                        → all active brands, sorted by sort_order
GET /api/v1/brands?subcategory=<slug>     → brands linked to that subcategory ([] if slug unknown)
GET /api/v1/brands/:id/models             → active models for a brand ([] if none)
```

Both endpoints are `@Public()`. Three DB tables: `brands`, `models`, `brand_subcategory_links` (junction). The seed (`brands.seed.ts`) has two sets: `BRANDS` — 67 brands covering phones, tablets, smart-watches, and computers-and-accessories subcategories — plus `CAR_BRANDS` — 91 car brands (cars-and-vehicles → cars-for-sale), names/order taken from the web mock design (MG first), slug + icon derived from the app's local `/sub-img/car_vehicles/cars-for-sale/brands/*.png` design assets (interim icon source until these move to Supabase Storage; admins replace via the UI). `BrandSeed.icon?` lands only on INSERT — the brand `onConflictDoUpdate.set` never touches `icon`, so admin-uploaded icons survive re-seeds. A slug appearing in two sets is handled specially: the first occurrence upserts the row, later ones only wire `brand_subcategory_links` (+ null-icon backfill) so they can't clobber the earlier set's `sortOrder` (the one case: `xiaomi`, in both phones and cars; its car-grid position follows the phone order). Motorcycle brands not seeded yet.

`sort_order` is manually assigned — not auto-increment. `Other` always gets `sortOrder: 999` (phones set; the car set's `other-car-brand` is simply last in the design order). The `models` table is seeded with ~250 starter models (`MODEL_SEEDS` + `seedModels` in `brands.seed.ts`, insert-only) covering the major phone/laptop/printer/smartwatch brands plus car models for the design's model-bearing brands (mg/leapmotor/toyota — the mock's "Pirus" typo is seeded verbatim); admins add the rest via the admin Models page (each model carries an optional image; old images are cleaned up on update/delete via `removeByPublicUrl`). The brands list response shape is `{id, slug, name, icon, sortOrder}` — the field is `icon`, not `image` (models use `image`); brands do NOT nest models (`GET /brands/:id/models` is a separate call).

### Listings

`ListingsModule` (`src/listings/`) — marketplace listings with cursor-based public feed and offset-based owner feed.

**Feed filtering (`GET /api/v1/listings`):** `findFeed()` delegates slug resolution to a private `resolveQueryFilters(query)` helper. If any slug is not found, short-circuits with `{ data: [], meta: {...} }` — no error. The same pattern applies in `findMine()`.

Supported query params: `categorySlug`, `subcategorySlug`, `provinceSlug`, `districtSlug`, `q` (title ilike), `minPrice`, `maxPrice`, `condition`, `brand`, `bodyType`. `districtSlug` without `provinceSlug` is silently ignored. **`brand`/`bodyType` match the display names stored in the `attributes` JSONB** (`attributes->>'brand'` / `->>'bodyType'`) — the same names the post form writes; slugs on the web are mapped slug → name at the page boundary.

**Ad creation** — `POST /api/v1/listings` (JWT): takes `categoryId`/`subcategoryId` as **UUIDs** (not slugs), inserts with `status='draft'`, `attributes` JSONB, `photos: [{url, path, sort}]` (max 8 — `url` = Supabase public URL, `path` = the `/files/sign` storage path; no upload tokens). `POST /api/v1/listings/:id/publish` (owner) flips to `status='active'` + `expiresAt = +30d`; the feed only shows `active` — a client post flow must call create **then** publish. Update/PATCH swaps `listing_photos` rows and best-effort cleans up dropped photos after commit.

**Cursor pagination** (feed): cursor encodes `{ createdAt, id }` as base64 JSON. Invalid cursors are ignored.

**Owner listing** (`GET /api/v1/listings/me/all`): offset pagination, adds `status` filter.

### Chat

`ChatModule` (`src/chat/`) — 1:1 buyer↔seller messaging. **REST is authoritative; a WebSocket gateway is an optional low-latency push on top, not a replacement.** Every message — REST or WS — goes through the single `ChatService.sendMessage` write path, so validation exists once. Its three pre-write checks (recipient existence, block check, listing ownership) run concurrently via `Promise.all` rather than sequentially — each is an independent read, and each DB round trip is real latency against the remote Supabase pooler, so this is the difference between one queueing round trip and three under concurrent send load. See `DATABASE_POOL_MAX` above: the shared postgres.js pool (default 20, not chat-specific) is the actual scaling limit under concurrent chat traffic, not `ConnectionRegistry` (verified empirically — 20 concurrent WS sends across 2 connections showed 0 drops/duplicates/misrouting; latency scaled with pool contention instead). **Per-contact threads**: exactly one `conversations` row per unordered user pair (CHECK `user_a_id < user_b_id` + unique; the service canonicalizes the pair and upserts with `onConflictDoUpdate`, bumping `last_message_at`). A message may carry an optional `listingId` context card (FK `ON DELETE SET NULL`). All routes require JWT. Full design + diagrams: `src/chat/README.md`.

```
POST /api/v1/chats/messages          → send { recipientId, body?, listingId?, imagePath?, e2eHeader? }; find-or-creates the conversation
GET  /api/v1/chats                   → inbox: cursor on (lastMessageAt, id); items carry otherUser, lastMessage, unreadCount
GET  /api/v1/chats/unread-count      → { total } for the badge
GET  /api/v1/chats/with/:userId      → resolve thread with a user (read-only — never creates; conversation may be null)
GET  /api/v1/chats/:id/messages      → history (cursor=, DESC) or polling deltas (after=, ASC); meta adds latestCursor + peerLastReadAt
POST /api/v1/chats/:id/read          → bulk mark-read; returns { marked }
```

Send rejections: self (400), no body & no imagePath (400), imagePath outside `chat/{senderId}/` (400), recipient missing/soft-deleted (404), block in either direction (403 `Messaging unavailable`), listing owned by neither participant (400). Non-participants get 404 (not 403) on conversation routes — no existence oracle. Clients poll with `after = meta.latestCursor`; read receipts surface via `peerLastReadAt` (= `max(readAt)` of my messages, valid because mark-read is bulk).

`messages.created_at` and `conversations.last_message_at` are `timestamp(3)` — cursor values roundtrip through JS Dates (ms precision), so µs columns would re-deliver the boundary row on `after` polls.

**WebSocket gateway** (`chat.gateway.ts`, `/ws/chat`): authenticates via `?token=` query param, `Authorization` header, or the `user_access_token` cookie (browser WS can't set headers), verifying signature+expiry via `JwtService.verify` and then running the same soft-delete DB check `JwtStrategy.validate` does on the REST path (parity — a soft-deleted user can no longer keep a working socket until access-token expiry). `send_message` is rate-limited in-memory, 30/min per user, mirroring the REST route's `@Throttle`; its payload is validated in the handler with the REST `ValidationPipe` options (the envelope is an interface, so the global pipe can't see it), and every send is answered with exactly one frame echoing `clientMessageId` — `ack` `{conversationId, message}` or `error` `{code, message, details?}` with the same codes as the REST error envelope (errors are caught in the handler because `GlobalExceptionFilter` is HTTP-only). `markRead` pushes a `read` `{conversationId}` event to the other participant so a WS-connected sender's receipts update live (their delta poll is paused while the socket is up). `ConnectionRegistry` is still an in-memory per-process `userId -> sockets` map — a given instance can only write to its own local sockets — but `ChatPubSubService` (`chat-pubsub.service.ts`) now publishes every push (`message`, `inbox_update`, `unread_count`) over Redis pub/sub (reusing the BullMQ Redis connection), so every instance's gateway subscribes and delivers to its own locally-connected recipient. Real-time push therefore reaches a recipient on _any_ backend instance, not just the sender's; an offline recipient still gets the message via their next `after=` poll, so correctness never depends on the socket. `HeartbeatService` pings every open socket every 30s and evicts any that hasn't ponged in 40s. On the web client, `use-chat-ws.ts` holds one shared WebSocket per tab (ref-counted across the nav unread badge, inbox list, and any open thread) and `inbox_update`/`unread_count` pushes replace the flat-interval inbox/badge poll whenever that socket is connected — see `CHAT_POLL` in `use-chat-polling.ts` for the fallback tiers used the rest of the time.

**End-to-end encryption** (X3DH + Double Ratchet over `@noble/curves`, Signal-protocol shaped): `SendMessageDto.e2eHeader` (validated by `E2eHeaderDto`) marks a message as E2E — `body` becomes base64 ciphertext (max 24000 chars vs. plaintext), mutually exclusive with `imagePath` (text only in v1). The header carries the Double Ratchet fields (`dh`, `pn`, `n`) plus, only on a session's first message, the X3DH initial-message fields (`identityKey`, `ephemeralKey`, `oneTimePrekeyId`, `signedPrekeyId`). Stored verbatim in `messages.e2eHeader` (JSONB) alongside `messages.isE2e`. Key material lives in two tables: `user_e2e_identities` (one row per user — X25519 `identityKey` for DH, a **separate** Ed25519 `identitySigningKey` for signing `signedPrekeyPublic`, since `@noble/curves` doesn't expose the Edwards↔Montgomery conversion Signal's XEdDSA uses to make one key do both) and `user_e2e_one_time_prekeys` (claimed one at a time via a partial index on unused rows). `E2eKeysController` (`/api/v1/chats/e2e/keys`): `POST` registers/rotates a user's keys + replenishes one-time prekeys, `GET me/prekey-count` reports remaining stock, `GET :userId/bundle` fetches a peer's bundle (identity key, signing key, signed prekey + signature, one claimed one-time prekey) to start an X3DH session. The backend only stores and relays key material and ciphertext — it never sees plaintext or private keys. **v2 multi-device** (`e2eVersion=2`): one identity per browser (`user_e2e_devices`), the message key wrapped per recipient/sender device in `message_envelopes`; a stale device list → 409 `E2E_DEVICES_MISMATCH` with `details` for the client to fix and retry. **History backup** (`e2e-backup.*`, `/chats/e2e/backup`, `/chats/e2e/history-requests`): a per-account backup key (BK) encrypts plaintext segments; a new device gets BK via passcode (argon2id → server-rate-limited unlock) or approval from an existing device. Plan + status: `tasks/plan-e2e-multi-device.md`; open security items: `src/chat/README.md`. **Encrypted attachments** (`chat-attachments.*`, `/chats/attachments`, plan `tasks/plan-e2e-attachments.md`): the browser resizes images to WebP, encrypts each file with its own AES-256-GCM key (frozen `E2E_FILE_V1` format: `NPF`+version, IV, ciphertext+tag) and uploads ciphertext to the **private** `chat-files` bucket (octet-stream only, 25 MB cap); keys, MIME types and thumbnails ride inside the v2 E2E message. `chat.attachments` tracks `pending → uploaded → attached`; `complete` trusts only the size read from storage; `POST /chats/messages` attaches `attachmentIds` in the send transaction with one conditional `UPDATE`; downloads use 5-min signed URLs issued only to participants; integrity is recipient-verified (hash + GCM tag), so there's no server-side hash. An hourly BullMQ job (`chat-maintenance` queue) deletes objects + rows never attached within 24 h. Legacy `imageUrl` images stay in the public bucket; `NEXT_PUBLIC_E2E_ATTACHMENTS=off` falls back to them.

### Files

`FilesModule` (`src/files/`) handles file uploads to Supabase Storage. Signed upload URLs are generated server-side; the client uploads directly to Supabase. Public URLs are returned for confirmed uploads. Bucket name is configured via `SUPABASE_STORAGE_BUCKET` (default: `listings`).

**Upload scopes** (`POST /files/sign`, `SignUploadDto.scope`): `avatar | cover | listing | chat | category | subcategory | brand | model | attribute` — `chat` paths are per-user (`chat/{userId}/…`) so ChatService can verify `imagePath` ownership by prefix. `DELETE /files` takes `{ paths: string[] }` for path-based deletion.

**Image cleanup on replace/delete:** `FilesService.removeByPublicUrl(publicUrl)` (`files.service.ts:105-125`) derives the storage path from a public URL, silently skips non-storage values (`/placeholder.svg`, foreign URLs), and warns-but-never-throws. The established pattern: read the prior `image`/`icon` inside the DB op, call `removeByPublicUrl(old)` **after commit**, gated on the value actually changing. Currently wired for: attributes, brands, models, categories/subcategories (icons), user avatar, user cover, and listing photos (removed-from-payload diff). **Not** wired for: admin user soft-delete (avatar/cover stay live in storage), chat images (no message-delete endpoint exists by design), and listing soft-delete (restore must work).

### Payments

`PaymentModule` (`src/payment/`) — gateway-agnostic payment processing feeding a double-entry ledger; the full design (table layout, entity map, outbox/queue placement, lifecycle sequence, current status) lives in [`src/payment/README.md`](apps/backend/src/payment/README.md), the canonical Module README example. One thing that README won't flag because it's a backend-wide convention question, not a module detail: **this module's use-cases are written in [Effect](https://effect.website) (`effect` npm package), not plain async/await NestJS services.** `use-cases/**/*.use-case.ts` (split into `use-cases/payments/` — payment_transaction/payment_attempt/provider-event lifecycle — and `use-cases/ledgers/` — double-entry posting, mirroring the processing/ledger table split; the top-level `use-cases/index.ts` re-exports both so every consumer still imports from one place) are `Effect.fn`-wrapped generators that `yield*` a `DbClientTag` (`src/db/db.provider.ts` — an Effect `Context.Service` wrapping the same Drizzle client the `DRIZZLE` token provides everywhere else) and fail with `Schema.TaggedError` subclasses (`use-cases/payments/errors.ts` / `use-cases/ledgers/errors.ts`) instead of throwing. `PaymentsController` is the only bridge back to NestJS: its private `run()` helper provides `DbClientTag.layer(this.db)`, runs the effect with `Effect.runPromiseExit`, and maps a typed failure to an `HttpException` via a `switch` on `error._tag`; an unmodeled defect falls through to `GlobalExceptionFilter` as a 500. This pattern is currently unique to `payment/` — don't reach for `effect` in other modules without a deliberate decision to extend the convention.

### Adding a new feature module

1. Create `src/<feature>/{feature}.module.ts`, `.service.ts`, `.controller.ts`.
2. Add DTOs to `src/<feature>/dto/`.
3. Import the module in `AppModule`.
4. Mark public endpoints with `@Public()`. Everything else requires a valid JWT automatically.
5. Do **not** import `DbModule` or `SupabaseModule`; their providers are available globally.

**For admin-only features**, add the controller + service to `AdminModule` instead of creating a separate module. Register them in `src/admin/admin.module.ts`. The controller uses `@Roles('admin', 'super_admin')` (guard is inherited from `AdminModule` or applied at the controller level if the feature has its own module).

**Exception:** the attributes feature owns its own module at `src/attributes/` (`AttributesModule` — admin-scoped routes at `/admin/attributes/:type`, registered in `AppModule`, imports `FilesModule`). It was decoupled from `AdminModule` so it can grow a public surface; keep admin-only features in `AdminModule` unless they have the same trajectory.

### Repository history note

The admin dashboard originally lived at `apps/admin` and was renamed to `apps/web`. The old `apps/admin` directory was a nested git repo, which prevented `git mv` — it was moved with plain `mv` + `git add -A`. If you see stale references to `apps/admin` or `pnpm --filter admin`, mentally substitute `apps/web` / `pnpm --filter web`.

### Admin API (`/api/v1/admin/*`)

`AdminModule` (`src/admin/admin.module.ts`) registers all admin controllers. Every route requires `@Roles('admin', 'super_admin')` + `RolesGuard` (enforced globally — no `@Public()` on admin routes). The admin surface covers:

| Controller                                             | Routes                                                                                                          |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `AdminController`                                      | `GET /admin/stats`, `GET /admin/stats/timeseries`, `GET/POST /admin/users`, `GET/PATCH/DELETE /admin/users/:id` |
| `AdminCategoriesController`                            | CRUD `GET/POST/PATCH/DELETE /admin/categories` (+ translations)                                                 |
| `AdminSubcategoriesController`                         | CRUD `GET/POST/PATCH/DELETE /admin/subcategories` (+ translations)                                              |
| `AdminBrandsController`                                | CRUD `GET/POST/PATCH/DELETE /admin/brands`                                                                      |
| `AdminModelsController`                                | CRUD `GET/POST/PATCH/DELETE /admin/models`                                                                      |
| `AttributesController` (own module, `src/attributes/`) | `GET/POST/PATCH/DELETE /admin/attributes/:type` (generic — `type` discriminates; see the Attributes section)    |
| `SubscriptionConfigController`                         | CRUD for subscription categories/plans/packages/terms (4-tier cascade)                                          |
| `UserSubscriptionsController`                          | `GET /admin/user-subscriptions`, `POST` grant, `DELETE :id`                                                     |
| `ReportsController`                                    | `GET /admin/reports/reasons`, `GET/PATCH/DELETE /admin/reports/users`, `/admin/reports/listings`                |

**Admin stats** (`AdminService.getStats`): 4 card metrics (`totalUsers`, `newUsers`, `totalListings`, `activeListings`), each with `{value, changePct, trend}` comparing current 30d vs prior 30d. `getTimeseries(range)` returns daily `{date, newUsers, newListings}` bucketed in ICT (UTC+7) via `date_trunc(... AT TIME ZONE 'Asia/Phnom_Penh')`.

**Admin user management** (`AdminService.listUsers`): offset-paginated with filters (`q`, `role`, `status`). Premium derivation via EXISTS on active `user_subscriptions` (expiresAt > now) → `accountType: 'Premium'|'Normal'`. Create/update handles password hashing (bcrypt, 10 rounds) and phone rows in a transaction. Delete is soft-delete: frees `user_phones` rows, sets `status='deleted'` + `deletedAt`.

**Admin seed bootstrap:** The seed (`src/db/seed.ts`) upserts an admin user when `ADMIN_SEED_USERNAME` + `ADMIN_SEED_PASSWORD` are set in the environment. The user gets `role: 'admin'` and a bcrypt `passwordHash` — this is the only path to create the initial admin (phone-OTP users have no password).

## Web app architecture (admin dashboard)

The `apps/web` Next.js 16 app is the admin dashboard. It runs on port **3001** and talks to the backend at `http://localhost:3000/api/v1` (configurable via `API_URL` env, default baked into `lib/api/client.ts`).

### Auth flow

Admin and user auth are **split onto separate surfaces**:

**Admin (`/wanderer/*` — non-localized, no `/[locale]` prefix):**

1. `actions/admin-login.ts` (server action) calls `POST /api/v1/auth/login`, rejects unless `user.role` is `'admin'` or `'super_admin'`, then calls `setAdminSession()` to persist `accessToken` + `refreshToken` in **httpOnly cookies** (`admin_access_token` / `admin_refresh_token`). Also seeds the `admin_locale` cookie from `user.preferredLanguage`.
2. `proxy.ts` (Next.js 16 replacement for `middleware.ts`) guards `/wanderer/dashboard/**` — if no `admin_access_token` cookie, redirects to `/wanderer/login`. The entire `/wanderer/*` surface bypasses next-intl entirely (never gets a locale prefix). Stray locale-prefixed wanderer URLs (e.g. `/en/wanderer/login`) are redirected to strip the locale.
3. `app/wanderer/layout.tsx` is a **second root `<html>` layout** (Next.js supports multiple root layouts when no `app/layout.tsx` exists). It reads the `admin_locale` cookie, validates it against `routing.locales`, and wraps children in `NextIntlClientProvider` with the cookie-sourced locale + directly-imported `messages/${locale}.json`. This bypasses `i18n/request.ts` (which is URL-segment based) entirely.
4. The in-dashboard `LocaleSwitcher` (`components/dashboard/locale-switcher.tsx`) calls `actions/admin-locale.ts`, which sets the `admin_locale` cookie + `PATCH /users/me { preferredLanguage }`, then `router.refresh()` re-renders the layout in the new locale.
5. `actions/logout.ts` (`adminLogout`) clears session + locale cookies and redirects to `/wanderer/login`.

**User (`/[locale]/login` — locale-prefixed):**

1. `actions/login.ts` (server action) calls `POST /api/v1/auth/login` and accepts any authenticated user (no role gate). **Phone-shaped identifiers** (`^0\d{7,9}$` — local-only; typed `+855…` or `855…` is treated as a username and fails) route instead to `requestLoginOtp` (`actions/otp.ts` → `POST /auth/otp/login`), which validates the password first, then sends the OTP and redirects to `/{locale}/otp?phone=<E.164>`.
2. **Distinct cookies:** admin and user sessions use separate httpOnly cookie pairs — `admin_access_token` / `admin_refresh_token` (admin) vs `user_access_token` / `user_refresh_token` (user). A user login cannot satisfy the proxy's admin-cookie guard, and `serverFetch` reads admin cookies only.
3. **Post-login destination is `/me`.** Both the login form (password mode) and the OTP verify success handler push `/me` — after any successful user login/register the user lands on their account page first, never the home feed.

`serverFetch<T>(path, init?)` in `lib/api/client.ts` reads the **admin** httpOnly cookie (`admin_access_token`), injects `Authorization: Bearer`, unwraps the `{success, data, meta}` envelope, and **transparently refreshes** on 401 (calls `POST /auth/refresh`, sets new cookies, retries once). On refresh failure, clears session. Throws `ApiError` on non-ok responses. **`userServerFetch<T>(path, init?)` is the user-side twin** — identical behavior but reads USER cookies (`getUserAccessToken`/`getUserRefreshToken`) and clears the user session on refresh failure; same cookie-write-during-RSC-render caveat applies. `getCurrentUser(): SessionUser | null` (`lib/auth/current-user.ts`, server-only) is the fail-soft session reader used by the `(user)` layout — anonymous fast-path (`no access or refresh token`) returns `null` with zero backend calls; any error degrades to visitor chrome. `actions/logout.ts` exposes both `adminLogout()` and `userLogout()`.

`clearAdminSession()` on 401 failure in `serverFetch` — cookie writes throw during RSC render (read-only context), which is caught and swallowed (token persists until next mutation).

### Category + subcategory pages (backend-driven)

`/[locale]/category/[categorySlug]` and `/[locale]/category/[categorySlug]/[subcategorySlug]` are **async RSC** fetching `GET /api/v1/categories/:slug` (one call each — the response nests subcategories, so the subcategory page `.find()`s by slug; both pages pass the locale via `Accept-Language` and render backend names directly). The data plumbing lives in `lib/api/categories.ts` (server-only — `CategoryGrid`-style raw `fetch`, `cache: "no-store"`, envelope unwrap, `null`/`[]` on failure):

- `getCategoryWithSubcategories(slug, locale)` → `BackendCategory {id, slug, name, icon, subcategories: BackendSubcategory[]}` (BackendSubcategory has `id` — required: bodytype rows carry `subcategoryIds` as UUIDs)
- `getBrandsForSubcategory(subSlug)` → `BackendBrand {id, slug, name, icon}` (map `icon` → OptionGrid's `image` at the page boundary)
- `getBodyTypes()` → rows for the car body-type grids, filtered in the page by `row.subcategoryIds.includes(sub.id)`
- `getModelsForBrand(brandId)` → the selected brand's model grid (brands never nest models)

Grid components use **local minimal types**, never the mock `Category`/`Subcategory` types or backend DTOs: `SubcategoryGrid` takes `{slug, name, icon: string|null}[]` (null icon → text pill), `OptionGrid` takes `{slug, name, image?: string|null}` (images render **`unoptimized`** — admin Supabase URLs crash `next/image` otherwise), `SubcategoryContent` takes optional `brands`/`bodyTypes`/`models` props (~render only when `length > 0`). Brand/bodyType/model grids now work for any subcategory with linked data (cars: 91 brands + 9 bodytypes; phones/tablets/smart-watches phones-family brands; others none).

**Filter bar / grid-list toggle:** the 4 category layouts (`components/category-layouts/*CategoryLayout.tsx`, chosen by slug) render only the title + the sticky filter bar (`sticky top-16 z-40`) using the **shared** `@/components/filter/*` components (`LocationSelectorFilter`/`SortFilter`/`PriceFilter`/`MoreFilters` — URL-param driven) plus the grid/list `TabsList`. The **category page owns the `Tabs` root** (the layouts are unwrapped so the bar's sticky containing block is tall): `TabsContent grid` = `GridCardSell` + `posts.map(GridCardPost)`, `TabsContent list` = `ListCardSell` + `posts.map(ListCardPost)` — the same feed as AllAds (`components/all-ads/AllAdsHeader.tsx` is the reference). The filter bar has a measured 8px gap on both sides (title→bar and bar→content) — keep it equal.

### Real listing surfaces (Cars for Sale, wired 2026-08-27; detail surfaces extended 2026-08-29)

The **cars-and-vehicles → cars-for-sale** branch is real end-to-end; every other category/subcategory keeps its mock path. Key module: `lib/api/categories.ts` is the server-only hub for both pages and actions.

- **Post an ad:** `app/[locale]/(user)/post/(publish)/` — a route-group `layout.tsx` gates `/post` on the user session (`getCurrentUser` → `redirect('/login')`, same as `me/layout.tsx`); `/post/[slug]` stays public. `page.tsx` branches on `selectedSub.slug === "cars-for-sale"` → `components/post/CarsPostForm.tsx` (real form); every other subcategory keeps the mock `DynamicForm` + `lib/post-ad.ts` (dead-end submit by design). The form loads `actions/listings.ts` `getCarsForSaleConfig(locale)` (category/subcategory UUIDs + brands + bodyTypes/colors filtered by `subcategoryIds` + generated years + **contact prefill** from `/users/me/phones` + `/auth/me`, local-formatted) and `getCarModels(brandId)`; submit = `createListing(payload)` which POSTs `/listings` then POSTs `/listings/:id/publish`, redirecting to the new ad. Photos sign via `signUploadUser` (user session, in `actions/files.ts`) — the admin twin `signUpload` is used only by admin surfaces. The extracted `components/post/ImageUpload.tsx` takes `signFn`/`onSigned`; `onSigned` returns the storage `path` (required in `photos[]` — never reuse the public URL as the path).
- **Feeds:** `getListingsFeed({categorySlug|subcategorySlug|brand|bodyType}, locale)` + `toCardPost()` (adapter into the shared `Post` shape — `post.postId` is `number | string`, UUIDs pass through, and the card link `title-adid-<uuid>` then resolves to the real detail). `category/cars-and-vehicles` and `/cars-for-sale` render real items through the existing card templates (`GridCardPost`/`ListCardPost`, `HighLightAds`/`NormalAd` with an optional `posts` prop); other categories keep their mock feeds. **Gotcha: `components/ads/AdsPhoto.tsx` is NOT a static banner — it maps all mock `posts` — never mix it into a real branch.** Card images render `unoptimized` (the Supabase hostname is not in `next.config` remotePatterns — required or dev crashes).
- **Detail:** two entry points resolve real UUIDs through `buildRealDetailData(id, locale)` (listing + breadcrumb + seller) into the same `Post-Detail.tsx` template via its `real?: RealDetailData` prop: `[locale]/[slug]` (root `title-adid-<uuid>` — the card-link format, also what mock slugs and the ShareModal use) and `[locale]/post/[slug]`. Non-UUID slugs fall back to the mock render. The seller card is built from the **listing's contact fields** (`GET /users/:id` is JWT-protected — no anonymous seller profile); attribute breadcrumbs use display names.
- **Contact-phone carrier icons (2026-08-29):** both phone surfaces on the detail page (`ContactUser.tsx`, `Profile-Sidebar.tsx`) show the carrier logo next to each number, derived from the 3-digit prefix via `utils/telecom.ts` — `detectCambodiaNetwork()` (Cellcard/Metfone/Smart/Seatel/Qube; **seatel is `['018']` only** — its original array was a duplicated `smart` list that made `018` resolve to Smart) and `carrierIconPath(phone)` (E.164-safe via `formatPhoneLocal`; maps the 4 carriers to the 64×64 `/icon/*.png` assets; Qube has no asset → no icon). `components/post/CarrierBadge.tsx` renders the icon (16px, `unoptimized`) or the site's S/C letter-badge as `fallback`. **Each phone row renders only when the number exists** — a single-phone user must not get an empty second row.
- **Description specs grid (2026-08-29):** real listings render `components/post/ListingSpecs.tsx` between the `Description` h2 and the description text — fixed 8 rows (Main Category / Category / Brand / Model / Year / Tax Type / Condition / Color), grey labels over blue values, every value a link with underline on hover only (`hover:underline`). Targets: category/subcategory pages; brand `?ad_field=<slug>`; model `?ad_field=<slug>&ad_model=<slug>` (UI highlight only — never filters); the other 4 fields → the subcategory page. **`condition` is NOT inside `attributes`** — it is top-level `BackendListing.condition` (`new|used`), and `toPostView` drops both, so the grid reads only from `real.{cate,subcate,brand,model,listing.attributes,listing.condition}` — never the local `post`.

### Data fetching patterns

- **TanStack Query** (`@tanstack/react-query`) for client-side reads/mutations. `QueryClientProvider` mounted in `app/providers.tsx` with `staleTime: 30s`, `retry: 1`.
- **Server actions** (`actions/*.ts`, all `"use server"`) call `serverFetch` and return typed data. Mutations return `{success, error?}`; queries return the data directly.
- **Verbose-adapter pattern:** The admin UI types (`types/user.ts`, `types/reportuser.ts`, etc.) have a different shape than backend DTOs. Each page maps backend rows → UI types inside the `queryFn` (e.g. `ReportUserRow` extends `ReportUser` with `_reporterName`/`_targetName` internal fields). The adapter lives inline in the page, not in a separate file.
- **Batch-lookup pattern** (avoiding Drizzle double-JOIN alias issues): When a query needs names from the `users` table for two different FKs (e.g. reporter + target), collect all IDs → single `inArray` query → `Map<id, name>` in JS. Used in `ReportsService.listUserReports()` and `listListingReports()`.

### Page conventions

Admin pages under `app/wanderer/dashboard/` are `"use client"` components using:

- `useQuery` with a `["admin", <domain>, ...]` key for initial fetch
- Client-side search + tab filtering + pagination on the full dataset (no server-side re-fetch per keystroke)
- `useQueryClient().invalidateQueries(...)` after mutations
- `toast.success`/`toast.error` from `@/components/ui/sonner` for mutation feedback

### Key files

| File                                  | Purpose                                                                                                                                                                 |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/api/client.ts`                   | `serverFetch<T>()` — typed API client with auth + refresh                                                                                                               |
| `lib/api/adapters.ts`                 | `BackendUser` interface + `toUiUser()` mapping                                                                                                                          |
| `lib/auth/session.ts`                 | Cookie get/set/clear for access & refresh tokens                                                                                                                        |
| `lib/auth/admin-locale.ts`            | `admin_locale` cookie helpers (resolve/set/clear) — drives the wanderer root layout locale                                                                              |
| `proxy.ts`                            | Auth guard (`/wanderer/dashboard/**`) + `next-intl` middleware composition                                                                                              |
| `app/providers.tsx`                   | `QueryClientProvider`                                                                                                                                                   |
| `app/wanderer/layout.tsx`             | Non-localized root `<html>` layout for admin (cookie-locale `NextIntlClientProvider`)                                                                                   |
| `actions/login.ts`                    | **User** login server action (any role → home)                                                                                                                          |
| `actions/admin-login.ts`              | **Admin** login server action (`admin`/`super_admin` only → seeds `admin_locale`)                                                                                       |
| `actions/admin-locale.ts`             | In-dashboard locale switch (cookie + `PATCH /users/me`)                                                                                                                 |
| `actions/logout.ts`                   | `adminLogout` (admin) + `userLogout` (user) — clears session cookies; `userLogout` redirects locale-aware (`/[locale]/login`)                                           |
| `lib/auth/current-user.ts`            | `getCurrentUser()` — server-only, fail-soft user-session reader (anonymous fast-path)                                                                                   |
| `actions/otp.ts`                      | User OTP actions: `requestOtp`, `requestLoginOtp` (password-gated), `verifyOtp` (carries password/names)                                                                |
| `lib/otp-registration.ts`             | sessionStorage handoff: password/names ride to the OTP verify call — never in a URL                                                                                     |
| `lib/phone.ts`                        | `normalizePhone` / `formatPhoneLocal` / `isLocalPhone` — local `0…` ↔ E.164 `+855…`                                                                                     |
| `actions/admin-users.ts`              | User CRUD actions                                                                                                                                                       |
| `actions/admin-stats.ts`              | Dashboard stats + timeseries actions                                                                                                                                    |
| `actions/admin-categories.ts`         | Category CRUD actions                                                                                                                                                   |
| `actions/admin-subscriptions.ts`      | Subscription config CRUD (categories/plans/packages/terms)                                                                                                              |
| `actions/admin-user-subscriptions.ts` | User subscription grant/delete actions                                                                                                                                  |
| `actions/admin-reports.ts`            | Report reasons + user/listing report actions                                                                                                                            |
| `lib/attribute-types.ts`              | `ATTRIBUTE_TYPES` — the 6 admin-managed attribute types with `hasImage`/`readOnly` flags (drives the sidebar + `[type]/page.tsx`)                                       |
| `lib/api/categories.ts`               | Server-only fetchers for the backend-driven category/subcategory pages (`getCategoryWithSubcategories`, `getBrandsForSubcategory`, `getBodyTypes`, `getModelsForBrand`) |

## Schema domains beyond the core

### Subscriptions (`subscriptions.schema.ts`)

4-tier config hierarchy — cascading parent selects in the admin UI:

```
subscription_categories → subscription_plans → subscription_packages → subscription_terms
```

- `subscription_plans` unique on `(categoryId, slug)`; FK cascade on parent delete.
- `subscription_packages` feature fields are **integers** (`photos`, `ads`, `renews`, `autoRenews`, `videos`) — admin forms use number inputs.
- `subscription_terms`: `durationValue` (int) + `durationUnit` (`day|month|year`) + `price` (numeric) + `discount`/`discountType` (reuses `discountTypeEnum` from listings).
- `user_subscriptions`: `userId` FK cascade, `termId` FK set null on delete, `priceUsd` (snapshot at grant time), `paymentMethod`, `subscribedAt`, `expiresAt`. Status is **derived** (`expiresAt < now → expired`), not stored.

### Reports (`reports.schema.ts`)

- `report_reasons`: admin-managed picklist, unique on `(targetType, reason)`, discriminated by `targetType` (`user`|`listing`).
- `user_reports`: `reporterId` → `targetUserId`, optional `reasonId` (set null on delete), `imagePaths` JSONB string array, `status` (`pending|approved|rejected`), `reviewedById`.
- `listing_reports`: `reporterId` → `listingId`, same status/reviewedBy pattern.

Admin list endpoints batch-lookup user names (reporter + target) via `inArray` to avoid Drizzle's double-JOIN alias limitation.

### Attributes (`attributes.schema.ts`)

Single generic `attribute_options` table with a free-form `type` discriminator (`varchar(60)`, **not validated** — a typo'd type in the API silently creates a new set). Unique on `(type, slug)`. Optional `categoryId` FK + `subcategoryIds` JSONB (denormalized mirror of admin UI selections — **UUIDs, not slugs**, so client-side filtering must compare against the subcategory `id`). Admin CRUD at `/admin/attributes/:type`, served by the standalone `AttributesModule` (`src/attributes/`, `@Roles('admin', 'super_admin')`). The module also exposes a **public read**: `GET /api/v1/attributes/:type` (`PublicAttributesController`, `@Public()`, used by the web category pages for the car body-type grids). Note `AttributesService.list(type)` returns the full row (`id/type/slug/name/image/categoryId/subcategoryIds/sortOrder/isActive/…`) with **no `isActive` filter**, ordered by `sortOrder`.

**Data is seeded** (`src/attributes/seeds/attributes.seed.ts`, **insert-only** `onConflictDoNothing` — admin edits survive re-seeds). 19 types seeded (~279 rows): `colors, rams, cpus, storage_phone, storage_computer, screensize_laptop, screensize_monitor, bodytypes, enginetypes, vehicletypes, accessories, jobtypes, networks, bedrooms, bathrooms, facings, experiences, vgas, types`. The `types` picklist spans computer parts / cameras / TVs-audio / property / fashion / furniture / musical instruments; rows sharing `(type, slug)` (e.g. the many "Other - ផ្សេងៗ" rows) are merged by the seed's dedupe pre-pass, unioning `subcategories`. Seed slugs must match the DTO `SLUG_RE` (dev-time assertion throws otherwise).

**Images are never seeded** — every row starts `image: null`; admins upload via the admin UI (`ImageUpload` scope `attribute` → Supabase → public URL stored in `image`). Only 5 types are image-bearing (`hasImage: true`): `bodytypes, accessories, jobtypes, types, networks`. The single exception: after the insert loop the seed **gap-fills car body-type icons** (null-only UPDATE for the 9 car slugs → the web app's local `/sub-img/car_vehicles/cars-for-sale/body_type/*.png` assets; the `other-type` row maps to `other.png`) — non-null images are never touched.

**`years` is generated, not stored.** `AttributesService.list('years')` computes `currentYear+1 → 1980` descending at read time (`categoryId` = cars-and-vehicles, `subcategoryIds` = cars-for-sale/motorcycles-for-sale, falling back to null/[]); `create`/`update`/`remove` reject `type === 'years'` with a 400.

**Admin UI is trimmed to 6 types** — `lib/attribute-types.ts` (`ATTRIBUTE_TYPES`, the source of truth): bodytypes, accessories, jobtypes, types, networks, years (years is `readOnly: true`). The other 13 seeded types stay readable via the API but have no admin page/sidebar entry (spec-fixed plain dropdowns needing no management). The dynamic route `dashboard/attributes/[type]/page.tsx` validates the slug against `ATTRIBUTE_TYPES` (404 otherwise) and renders `<AttributeManager type title hasImage? readOnly? />` (`components/dashboard/attribute-manager.tsx`). `readOnly` hides the Add button + per-row actions. Client-side search matches name/slug/category/subcategory names and resets to page 1.

## Pipeline workflow

The `.pipeline/` directory tracks feature changes through a structured four-phase workflow:

| Phase     | File              | Purpose                                          |
| --------- | ----------------- | ------------------------------------------------ |
| 1. Spec   | `spec.md`         | Engineering spec with decisions + open questions |
| 2. Impl   | `changes.md`      | Summary of files modified and behavioral diffs   |
| 3. Test   | `test-results.md` | Test gate results (build, lint, suites, count)   |
| 4. Review | `review.md`       | Code review verdict + follow-up tickets          |

The `planner`, `coder`, `tester`, and `reviewer` agent types work through this pipeline in order. For new features, start with the planner agent to produce `spec.md`.

## Module README convention

A request like "give me the README for `<module>`" or "let's do a README for `src/<module>`" means: write `src/<module>/README.md` in the fixed shape below, so module docs stay comparable to each other instead of drifting into whatever shape felt natural that day. `apps/backend/src/payment/README.md` and `apps/backend/src/chat/README.md` are the canonical examples — re-read both for tone and depth before writing a new one; this section describes their shape, not a substitute for looking at them.

**Sections, in this order:**

1. Title + a one-to-two sentence purpose statement.
2. `## Architecture`
   - An opening subsection whose heading names the module's actual core design idea (`The ledger boundary`, `REST is authoritative, the socket is a shortcut`) — never a generic `### Overview`.
   - A table: one row per file for a thin/service-style module, or one row per DB table for a schema-heavy one. One-line purpose per row.
   - `### Entity map` — a `mermaid erDiagram` of the tables the module owns (fields + FK relationships). Skip this subsection entirely if the module owns no tables.
   - A short subsection on how the module relates to this backend's two standing cross-cutting mechanisms — the transactional outbox (`src/outbox/`) and BullMQ queues. State plainly which ones it uses and which it deliberately skips, and why (chat skips the outbox and uses BullMQ only for attachment cleanup; payment is designed around both).
3. `## Lifecycle, end to end` — one or more `mermaid sequenceDiagram` blocks tracing the module's real request/data flow (not a generic CRUD sketch), followed by a short `Key properties this gives us` bullet list pulling out the non-obvious invariants the diagram makes visible.
4. `## Current state` — a table of piece vs. status (`Done` / `Not started` / partial with a caveat). Be honest: a mostly-unbuilt module should read as mostly-unbuilt, not padded out to look further along.
5. `## Open items` — real findings from reading the actual code (a structural gap, a guard that isn't applied consistently, a doc that's gone stale), each with why it matters. No filler items. Carry forward anything from this file's `Known gaps` section that applies to the module, plus whatever new gaps surfaced while writing the README.

**Process, before and while writing:**

- Read every file in the module first — an empty stub file changes what the README can honestly claim (this is why payment's README reads as mostly-unbuilt and chat's doesn't).
- Verify each architectural claim against the actual code (imports, schema, guards actually applied) rather than the file's own comments or this file's prose — both can be stale.
- Reuse the terminology this file and sibling READMEs already use for the same concept, rather than introducing a new synonym for it.
- Run `pnpm format` (or `npx prettier --write <path>`) on the finished file, and confirm the mermaid fences survived formatting untouched.
- If writing the README surfaces something that contradicts this file (e.g. a module description here turns out stale because the code moved on), note it under that module's Open items — don't silently rewrite this file as a side effect unless asked to.

## Frontend listing-form specs (`spec-detail-*.md`)

`apps/backend/docs/spec-detail-one.md` … `spec-detail-twelve.md` (12 files, ~1,120 lines) are **per-category listing-creation form specifications**, written from the frontend's perspective. They are the source of truth for each subcategory's `field_schema` (see the Categories i18n section above). Each file enumerates the form fields for the subcategories of one main category:

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

Note: the pre-commit hook blocks committing any file matching `*.env*`.

The web app (`apps/web`) reads two optional env vars (server-side only — never `NEXT_PUBLIC_`): `API_URL` (backend API base; defaults to `http://localhost:3000/api/v1`, consumed by `lib/api/client.ts`) and `SUPABASE_URL` (Supabase project URL; `next.config.ts` parses the hostname at build time so `next/image` can optimize Storage URLs — must match the backend's `SUPABASE_URL`).

**`NEXT_PUBLIC_WS_URL`** (optional, client-visible by design — it's the one exception to the server-only rule above): the chat WebSocket's origin (e.g. `ws://localhost:8080`, or `wss://…` for a tunnel/prod), read by `apps/web/hooks/use-chat-ws.ts`. `API_URL` can't serve double duty here — it's server-only and invisible to a `"use client"` hook. Without this var the hook falls back to a dev heuristic (`localhost:3000`, the backend's default port) that silently breaks the moment the backend runs on any other port: the socket "connects" to whatever's listening there (or nothing), `ws.isConnected` still flips true, and every WS-path send gets optimistically marked "sent" client-side and then vanishes — never reaching the real backend, never persisted. REST sends (the fallback path when WS isn't connected) are unaffected since server actions read `API_URL` correctly. **Must mirror `API_URL`'s host** whenever the backend isn't on the default port.

## IDs

Use `crypto.randomUUID()` from Node's built-in `node:crypto`. There is no `uuid` package dependency.

## Known gaps (track as separate tickets)

- **Feedback schema not built** — the admin Feedback page (`dashboard/feedback/page.tsx`) is a mock-data stub. Needs a new `feedback` table + `POST /feedback` (public) + `GET /admin/feedback` (admin). This is Phase 8, the last remaining phase of the admin-backend integration.
- **No `km`/`zh` seed copy.** Category translations contain only `en` values. Add `km`/`zh` keys to `src/categories/seeds/categories.seed.ts` — no code change needed.
- **Idempotency completed-row hash reuse.** A repeated `POST` with the same `Idempotency-Key` but a different body returns the cached response instead of 422.
- **`removePhone` no primary reassignment.** Deleting a primary phone leaves the user with zero primary phones (the DB now enforces _at most_ one primary, not _exactly_ one).
- **No delete-account flow yet.** Nothing sets `users.deletedAt` via user-facing flow (admin can soft-delete via `DELETE /admin/users/:id`, which also frees `user_phones` rows). The user-facing delete-account flow still needs to be built.
- **Geography names not i18n'd.** `provinces/districts/communes` carry a single `name` while the app supports `en/km/zh`.
- **`PublicUser` over-exposes fields cross-user.** `GET /users/:id` returns `Omit<UserRow,'passwordHash'>`, exposing `deletedAt`, verification timestamps. Consider narrowing to an explicit allow-list.
- **Communes not seeded.** `COMMUNES = []` in `cambodia-geography.seed.ts`. ~1600 Cambodian communes need to be added before `communeId` FK is useful.
- **Attribute `:type` param is unvalidated.** Any string works against `attribute_options.type` (`varchar(60)`) — a typo'd type in the API silently creates a new attribute set. Consider validating against the seeded/admin type allowlist.
- **Motorcycle brands not seeded.** The car set is seeded (91 brands, cars-for-sale); motorcycles-for-sale has no brand list yet.
- **No push notifications for chat.** Realtime now fans out across backend instances via Redis pub/sub (`ChatPubSubService` — see the Chat section), but there's still no FCM/APNs layer: a backgrounded mobile app or a closed tab only catches up on its next poll, not instantly.
- **Legacy chat images are public-bucket URLs.** New images go through encrypted attachments (private bucket); messages sent before that, or with `NEXT_PUBLIC_E2E_ATTACHMENTS=off` / without a v2 device, keep the old public `imageUrl`. No migration of old images yet.
- **WS rate limiting is per-instance, not global.** `ChatGateway`'s 30/min send limiter is an in-memory `Map`, so under multiple backend instances the effective global limit is `30 × instance count`. The REST route's `@Throttle` has the same per-instance-storage caveat (no `ThrottlerStorageRedisService` configured). Non-issue at MVP scale; needs a shared counter (Redis) before running more than one instance under real abuse pressure.
- **Inline `field_schema` duplication.** ~10 no-Type/no-Condition subcategory forms (all of Pets, Foods, and the no-Type Furniture blocks) are byte-identical to `commonListingFields` yet re-inline all 11 fields (~75 lines each) instead of referencing the const. Consistent by current convention but heavy; a one-time systemic refactor (e.g. `fieldSchema: [...commonListingFields]` for exact-match subcats) could DRY it. Non-blocking — do it once across all categories, never per-ship.
- **`super_admin` vs `admin` permission gradation is role-assignment only.** `AdminService.createUser` and `updateUser` enforce that only `super_admin` can set `role` to `'admin'` or `'super_admin'` (`ForbiddenException` otherwise). The Team management page (`/wanderer/dashboard/team`) is super_admin-only — guarded at both the page level (`redirect` for non-super_admin) and the sidebar (the Team link is hidden from regular admins). Beyond role assignment, `admin` and `super_admin` are treated identically by all other `@Roles('admin', 'super_admin')` guards. Add finer-grained permission distinctions if needed later.
- **Users page form shows `super_admin` option to regular admins.** `USER_ROLES` in `schemas/user.ts` includes `'super_admin'` so the Team page form can select it. The Users page form (`UserClient.tsx`) shares this constant and will render the option for regular admins too. The backend rejects unauthorized assignments with 403, but the UI should ideally hide the option for non-super_admin (follow-up).
- **Most user-facing surfaces are mock data** — the real islands are: the `/me` header (`components/profile/MyProfileHeader`, real session via `me/layout.tsx`), the homepage **Browse By Category** grid, the **category/subcategory pages** (names/slugs/icons + live brand/bodyType/model option grids for cars & phones-family), and since 2026-08-27 the **cars-for-sale post flow + its category/subcategory feeds + real listing detail** (see "Real listing surfaces") — extended 2026-08-29 with contact-phone carrier icons and the Description specs grid. Still hardcoded: every `/me/*` subpage (they import the mock `currentUser` from `lib/user.ts`), the home feed + all non-car category feeds (`lib/posts.ts`), the non-car post forms (`lib/post-ad.ts` + `DynamicForm` — submit deliberately unwired), the `lib/categories.ts` mock consumed by `PostForm.tsx`, `SearchBar.tsx`, `AllAdsCategories.tsx`, `lib/data.ts`, and `/me`'s My Ads list (a posted car ad does NOT appear there yet). Phase C (mock → real for the profile surfaces) is the remaining user-account work.
- **Brand/bodytype/subcategory icon storage objects missing.** As of 2026-08-25 the DB icon URLs for brands, bodytypes and subcategories return `NoSuchKey` from Supabase Storage (category icons exist; the 91 seeded car brands work because they point at the web app's local `/sub-img` assets). Affected tile grids degrade to broken `<img>` glyphs (`OptionGrid`/`SubcategoryGrid` count images by presence, not load success). Fix options: re-upload via the admin UI, restore the bucket objects, or add an `onError` → text-pill fallback (proposed, not implemented).
- **Specs-grid brand links are best-effort.** `buildRealDetailData` derives brand slugs via `slugify(attribute name)` into `real.brand.slug`, which can diverge from backend `brands.slug` rows (e.g. `mercedes-benz` vs `mercedesbenz`) — the `?ad_field=` link then lands on the unfiltered subcategory page. Model links (`ad_model`) only highlight the model grid, never filter the feed. Carrier-icon detection covers only the 4 carriers that have `/icon` assets (Qube and unknown prefixes get the S/C letter-badge fallback).
- **`generateUniqueUsername` race.** Check-then-insert with no 23505 retry — concurrent same-name creates (e.g. two OTP verifies at once) can 500. Add retry-on-unique-violation in the consumers (Telegram login, `updateProfile`, phone-OTP verify).
- **`phoneVerifiedAt` is never written** though the column exists, and a soft-deleted user keeps its global-unique `user_phones` row so a re-registered active user ends up with `primaryPhone` but no `user_phones` row.
- **Username login is case-sensitive** (`loginWithPassword` matches `users.username` exactly) while generated usernames are lowercase — typed-cased usernames fail. `UpdateProfileDto` first/last names have no `@MaxLength` (Postgres 22001 → 500 on overflow) while the column is `varchar(100)`.
- **`src/tenant/` is a design doc, not code.** `tenant/README.md` sketches a proposed `tenants`/`tenant_members` schema meant to eventually back `payment_transactions.tenantId` (currently a bare, FK-less UUID — see the Payments section) and possibly scope `user_subscriptions`. No schema file, migration, or `src/db/schema/index.ts` export exists yet — treat it as a proposal to reference, not something implemented.
