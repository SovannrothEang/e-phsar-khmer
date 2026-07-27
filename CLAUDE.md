# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo layout

pnpm + Turborepo. Packages are scoped with `pnpm --filter <name>`.

| Path                          | Name                      | Stack                            |
| ----------------------------- | ------------------------- | -------------------------------- |
| `apps/backend/`               | `backend`                 | NestJS 11, Drizzle ORM, Supabase |
| `apps/web/`                   | `web`                     | Next.js                          |
| `apps/docs/`                  | `docs`                    | Next.js                          |
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
pnpm check-types    # type-check all packages
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

### Web & Docs (Next.js)

```bash
pnpm --filter web dev          # Next.js dev on port 3001
pnpm --filter docs dev         # Next.js dev on port 3002
pnpm --filter web build        # next build
pnpm --filter docs build       # next build
pnpm --filter web check-types  # next typegen → tsc --noEmit
pnpm --filter docs check-types # next typegen → tsc --noEmit
pnpm --filter web lint         # eslint --max-warnings 0
```

`web` is a full admin dashboard (Next.js 16 App Router + `next-intl` i18n). `docs` is scaffolding only. Both import `@repo/ui` for shared components and extend `@repo/typescript-config/nextjs.json` + `@repo/eslint-config/next-js`.

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
  → ThrottlerGuard (global APP_GUARD #1)
  → JwtAuthGuard   (global APP_GUARD #2)  ← skipped if @Public()
  → ValidationPipe (whitelist + transform)
  → Handler
  → ResponseInterceptor  → { success, data, meta? }
  → GlobalExceptionFilter  (on throw)
```

### URL structure

Global prefix `api`, excluded for `GET /` and `GET /health`. URI versioning with `defaultVersion: '1'`.

- Root: `GET /` → `Hello World!` (no auth, no prefix)
- Health: `GET /health` (no auth, VERSION_NEUTRAL)
- All other routes: `/api/v1/<resource>/...`

### Auth model

- `@Public()` on a handler or controller class bypasses `JwtAuthGuard` entirely. Without it, a valid `Bearer` token is required.
- JWT payload is exactly `{ sub, role }`. `JwtStrategy.validate` (`src/auth/strategies/jwt.strategy.ts`) checks the DB, rejects soft-deleted users (`deletedAt` set), and sets `req.user` as `RequestUser { id, role }`.
- Use `@CurrentUser() user: RequestUser` to access the authenticated user in a handler.
- Dual tokens: short-lived `accessToken` (default 15 min) + long-lived `refreshToken` (default 30 d). `refreshToken` uses a separate `JWT_REFRESH_SECRET`.
- Soft-delete is enforced at all three entry points: `loginWithPassword`, `refresh`, and `JwtStrategy.validate`.

### Auth flow — phone registration

```
POST /api/v1/auth/register   { phone }        → sends OTP via Supabase (or dev bypass)
POST /api/v1/auth/otp/verify { phone, token } → creates user row, inserts user_phones, returns tokens
```

`mirrorSupabaseUser` in `auth.service.ts` upserts users without a Supabase-specific ID: phone auth conflicts on `primaryPhone`; social auth (Google/Facebook) conflicts on `email`. Both paths insert into `user_auth_providers` and `user_phones` (isPrimary: true) when a phone is present.

### Database access

`DbModule` is `@Global()` — never import it in feature modules. Inject the typed Drizzle client with `@Inject(DRIZZLE) private readonly db: DbClient`. For raw SQL (e.g. health ping), inject `@Inject(PG_CLIENT) private readonly sql: postgres.Sql`.

Drizzle is configured with `casing: 'snake_case'`: write schema column names in camelCase; the driver maps to `snake_case` in the DB automatically.

Schema files live in `src/db/schema/` and are re-exported from `src/db/schema/index.ts`. Add new tables there.

### Supabase

`SupabaseModule` is `@Global()` — never import it in feature modules; inject `SupabaseService` directly. It exposes one admin client (service-role key) and a helper to create a user-scoped client. Auth (OTP, social OAuth, token validation) and storage operations go through `SupabaseService`.

`signInWithOtp` and `verifyOtp` support a dev bypass via `DEV_OTP_TOKEN` env var — when set, no SMS is sent and that fixed token is accepted. The fake Supabase user ID is a deterministic SHA-256 UUID derived from the phone number.

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

**Seed (`src/db/seed.ts`):** runs geography → categories → brands in order. All seeds are idempotent.

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

- `username / primaryPhone / email` — unique via **partial unique indexes** (`WHERE deleted_at IS NULL`), so soft-deleted users release their identifiers for re-registration. Upserts targeting these columns must pass `targetWhere: isNull(users.deletedAt)` (see `mirrorSupabaseUser`), and single-row lookups must filter `isNull(users.deletedAt)`. Username generation lives in `src/users/username.util.ts`.
- `provinceId / districtId / communeId` — nullable FKs to lookup tables (no cascade)
- `deletedAt timestamp` — soft-delete; `status='deleted'` + `deletedAt=now()`
- `preferredLanguage default('en').notNull()`

`user_phones` enforces at most one `isPrimary` row per user via a partial unique index (`user_phones_user_primary_uq`). `user_phones.phone` stays globally unique (not freed by soft-delete).

**Phone management endpoints** (all require JWT): `POST /api/v1/users/me/phones`, `DELETE /api/v1/users/me/phones/:phoneId`, `PATCH /api/v1/users/me/phones/:phoneId/primary`. Ownership is enforced via `and(eq(id), eq(userId))`.

**Block endpoints** (all require JWT): `GET/POST /api/v1/users/me/blocks`, `DELETE /api/v1/users/me/blocks/:userId`. Blocking is idempotent (`onConflictDoNothing`); a block in either direction makes chat sends fail with 403 (see Chat).

**Activity tracking:** `LastSeenInterceptor` (global `APP_INTERCEPTOR`) calls `ActivityService.touch(userId)` on every authenticated request. `touch` is fire-and-forget with a 5-minute in-memory throttle per user.

**Migration status:** `drizzle/migrations/` holds generated migrations `0000`–`0009` (plus `meta/`). `0000_perfect_ultimatum` creates all 9 enums and the bulk of the schema (categories/subcategories, users, listings, brands/models, idempotency_keys); `0001`–`0002` alter `users`; `0003` adds `listing_photos`; `0004_premium_mephisto` swaps `users` uniques for partial indexes + listing CHECK constraints; `0005_nosy_monster_badoon` adds chat tables + `user_blocks`; `0006_overjoyed_doorman` narrows chat timestamps to `timestamp(3)`; `0007_far_pet_avengers` adds `attribute_options`; `0008_legal_barracuda` adds subscription tables (4-tier hierarchy: categories→plans→packages→terms + `user_subscriptions`); `0009_tidy_screwball` adds report tables (`report_reasons`, `user_reports`, `listing_reports`).

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

Both endpoints are `@Public()`. Three DB tables: `brands`, `models`, `brand_subcategory_links` (junction). Brand seed lives in `src/brands/seeds/brands.seed.ts` — 67 brands covering phones, tablets, smart-watches, and computers-and-accessories subcategories. Car/motorcycle brands deferred (no brand list in spec yet).

`sort_order` is manually assigned — not auto-increment. `Other` always gets `sortOrder: 999`. `models` table is seeded empty; models are populated via admin UI (not yet built).

### Listings

`ListingsModule` (`src/listings/`) — marketplace listings with cursor-based public feed and offset-based owner feed.

**Feed filtering (`GET /api/v1/listings`):** `findFeed()` delegates slug resolution to a private `resolveQueryFilters(query)` helper. If any slug is not found, short-circuits with `{ data: [], meta: {...} }` — no error. The same pattern applies in `findMine()`.

Supported query params: `categorySlug`, `subcategorySlug`, `provinceSlug`, `districtSlug`, `q` (title ilike), `minPrice`, `maxPrice`, `condition`. `districtSlug` without `provinceSlug` is silently ignored.

**Cursor pagination** (feed): cursor encodes `{ createdAt, id }` as base64 JSON. Invalid cursors are ignored.

**Owner listing** (`GET /api/v1/listings/me/all`): offset pagination, adds `status` filter.

### Chat

`ChatModule` (`src/chat/`) — 1:1 buyer↔seller messaging, REST + polling (no WebSockets). **Per-contact threads**: exactly one `conversations` row per unordered user pair (CHECK `user_a_id < user_b_id` + unique; the service canonicalizes the pair and upserts with `onConflictDoUpdate`, bumping `last_message_at`). A message may carry an optional `listingId` context card (FK `ON DELETE SET NULL`). All routes require JWT:

```
POST /api/v1/chats/messages          → send { recipientId, body?, listingId?, imagePath? }; find-or-creates the conversation
GET  /api/v1/chats                   → inbox: cursor on (lastMessageAt, id); items carry otherUser, lastMessage, unreadCount
GET  /api/v1/chats/unread-count      → { total } for the badge
GET  /api/v1/chats/with/:userId      → resolve thread with a user (read-only — never creates; conversation may be null)
GET  /api/v1/chats/:id/messages      → history (cursor=, DESC) or polling deltas (after=, ASC); meta adds latestCursor + peerLastReadAt
POST /api/v1/chats/:id/read          → bulk mark-read; returns { marked }
```

Send rejections: self (400), no body & no imagePath (400), imagePath outside `chat/{senderId}/` (400), recipient missing/soft-deleted (404), block in either direction (403 `Messaging unavailable`), listing owned by neither participant (400). Non-participants get 404 (not 403) on conversation routes — no existence oracle. Clients poll with `after = meta.latestCursor`; read receipts surface via `peerLastReadAt` (= `max(readAt)` of my messages, valid because mark-read is bulk).

`messages.created_at` and `conversations.last_message_at` are `timestamp(3)` — cursor values roundtrip through JS Dates (ms precision), so µs columns would re-deliver the boundary row on `after` polls.

### Files

`FilesModule` (`src/files/`) handles file uploads to Supabase Storage. Signed upload URLs are generated server-side; the client uploads directly to Supabase. Public URLs are returned for confirmed uploads. Bucket name is configured via `SUPABASE_STORAGE_BUCKET` (default: `listings`). `POST /files/sign` scopes: `avatar | cover | listing | chat` — `chat` paths are per-user (`chat/{userId}/…`) so ChatService can verify `imagePath` ownership by prefix.

### Adding a new feature module

1. Create `src/<feature>/{feature}.module.ts`, `.service.ts`, `.controller.ts`.
2. Add DTOs to `src/<feature>/dto/`.
3. Import the module in `AppModule`.
4. Mark public endpoints with `@Public()`. Everything else requires a valid JWT automatically.
5. Do **not** import `DbModule` or `SupabaseModule`; their providers are available globally.

**For admin-only features**, add the controller + service to `AdminModule` instead of creating a separate module. Register them in `src/admin/admin.module.ts`. The controller uses `@Roles('admin')` (guard is inherited from `AdminModule` or applied at the controller level if the feature has its own module).

### Repository history note

The admin dashboard originally lived at `apps/admin` and was renamed to `apps/web`. The old `apps/admin` directory was a nested git repo, which prevented `git mv` — it was moved with plain `mv` + `git add -A`. If you see stale references to `apps/admin` or `pnpm --filter admin`, mentally substitute `apps/web` / `pnpm --filter web`.

### Admin API (`/api/v1/admin/*`)

`AdminModule` (`src/admin/admin.module.ts`) registers all admin controllers. Every route requires `@Roles('admin')` + `RolesGuard` (enforced globally — no `@Public()` on admin routes). The admin surface covers:

| Controller                     | Routes                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `AdminController`              | `GET /admin/stats`, `GET /admin/stats/timeseries`, `GET/POST /admin/users`, `GET/PATCH/DELETE /admin/users/:id`    |
| `AdminCategoriesController`    | CRUD `GET/POST/PATCH/DELETE /admin/categories` (+ translations)                                                    |
| `AdminSubcategoriesController` | CRUD `GET/POST/PATCH/DELETE /admin/subcategories` (+ translations)                                                 |
| `AdminBrandsController`        | CRUD `GET/POST/PATCH/DELETE /admin/brands`                                                                         |
| `AdminModelsController`        | CRUD `GET/POST/PATCH/DELETE /admin/models`                                                                         |
| `AdminAttributesController`    | `GET/POST/PATCH/DELETE /admin/attributes/:type` (generic — `type` discriminates: colors, rams, cpus, bodytypes, …) |
| `SubscriptionConfigController` | CRUD for subscription categories/plans/packages/terms (4-tier cascade)                                             |
| `UserSubscriptionsController`  | `GET /admin/user-subscriptions`, `POST` grant, `DELETE :id`                                                        |
| `ReportsController`            | `GET /admin/reports/reasons`, `GET/PATCH/DELETE /admin/reports/users`, `/admin/reports/listings`                   |

**Admin stats** (`AdminService.getStats`): 4 card metrics (`totalUsers`, `newUsers`, `totalListings`, `activeListings`), each with `{value, changePct, trend}` comparing current 30d vs prior 30d. `getTimeseries(range)` returns daily `{date, newUsers, newListings}` bucketed in ICT (UTC+7) via `date_trunc(... AT TIME ZONE 'Asia/Phnom_Penh')`.

**Admin user management** (`AdminService.listUsers`): offset-paginated with filters (`q`, `role`, `status`). Premium derivation via EXISTS on active `user_subscriptions` (expiresAt > now) → `accountType: 'Premium'|'Normal'`. Create/update handles password hashing (bcrypt, 10 rounds) and phone rows in a transaction. Delete is soft-delete: frees `user_phones` rows, sets `status='deleted'` + `deletedAt`.

**Admin seed bootstrap:** The seed (`src/db/seed.ts`) upserts an admin user when `ADMIN_SEED_USERNAME` + `ADMIN_SEED_PASSWORD` are set in the environment. The user gets `role: 'admin'` and a bcrypt `passwordHash` — this is the only path to create the initial admin (phone-OTP users have no password).

## Web app architecture (admin dashboard)

The `apps/web` Next.js 16 app is the admin dashboard. It runs on port **3001** and talks to the backend at `http://localhost:3000/api/v1` (configurable via `API_URL` env, default baked into `lib/api/client.ts`).

### Auth flow

1. `actions/login.ts` (server action) calls `POST /api/v1/auth/login` with `{identifier, password}`, verifies `user.role === 'admin'`, then calls `setSession()` to persist `accessToken` + `refreshToken` in **httpOnly cookies** (`admin_access_token` / `admin_refresh_token`).
2. `proxy.ts` (Next.js 16 replacement for `middleware.ts`) guards `/dashboard/**` — if no `admin_access_token` cookie, redirects to `/login`. It composes with `next-intl` middleware (locale prefix routing).
3. `serverFetch<T>(path, init?)` in `lib/api/client.ts` reads the httpOnly cookie, injects `Authorization: Bearer`, unwraps the `{success, data, meta}` envelope, and **transparently refreshes** on 401 (calls `POST /auth/refresh`, sets new cookies, retries once). On refresh failure, clears session. Throws `ApiError` on non-ok responses.
4. `clearSession()` on 401 failure in `serverFetch` — cookie writes throw during RSC render (read-only context), which is caught and swallowed (token persists until next mutation).

### Data fetching patterns

- **TanStack Query** (`@tanstack/react-query`) for client-side reads/mutations. `QueryClientProvider` mounted in `app/providers.tsx` with `staleTime: 30s`, `retry: 1`.
- **Server actions** (`actions/*.ts`, all `"use server"`) call `serverFetch` and return typed data. Mutations return `{success, error?}`; queries return the data directly.
- **Verbose-adapter pattern:** The admin UI types (`types/user.ts`, `types/reportuser.ts`, etc.) have a different shape than backend DTOs. Each page maps backend rows → UI types inside the `queryFn` (e.g. `ReportUserRow` extends `ReportUser` with `_reporterName`/`_targetName` internal fields). The adapter lives inline in the page, not in a separate file.
- **Batch-lookup pattern** (avoiding Drizzle double-JOIN alias issues): When a query needs names from the `users` table for two different FKs (e.g. reporter + target), collect all IDs → single `inArray` query → `Map<id, name>` in JS. Used in `ReportsService.listUserReports()` and `listListingReports()`.

### Page conventions

Admin pages under `app/[locale]/(admin)/dashboard/` are `"use client"` components using:

- `useQuery` with a `["admin", <domain>, ...]` key for initial fetch
- Client-side search + tab filtering + pagination on the full dataset (no server-side re-fetch per keystroke)
- `useQueryClient().invalidateQueries(...)` after mutations
- `toast.success`/`toast.error` from `@/components/ui/sonner` for mutation feedback

### Key files

| File                                  | Purpose                                                    |
| ------------------------------------- | ---------------------------------------------------------- |
| `lib/api/client.ts`                   | `serverFetch<T>()` — typed API client with auth + refresh  |
| `lib/api/adapters.ts`                 | `BackendUser` interface + `toUiUser()` mapping             |
| `lib/auth/session.ts`                 | Cookie get/set/clear for access & refresh tokens           |
| `proxy.ts`                            | Auth guard + `next-intl` middleware composition            |
| `app/providers.tsx`                   | `QueryClientProvider`                                      |
| `actions/login.ts`                    | Login server action (admin-only gate)                      |
| `actions/admin-users.ts`              | User CRUD actions                                          |
| `actions/admin-stats.ts`              | Dashboard stats + timeseries actions                       |
| `actions/admin-categories.ts`         | Category CRUD actions                                      |
| `actions/admin-subscriptions.ts`      | Subscription config CRUD (categories/plans/packages/terms) |
| `actions/admin-user-subscriptions.ts` | User subscription grant/delete actions                     |
| `actions/admin-reports.ts`            | Report reasons + user/listing report actions               |

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

Single generic `attribute_options` table with `type` discriminator (colors, rams, cpus, bodytypes, enginetypes, jobtypes, networks, storages, screensizes, etc. — 18 types). Unique on `(type, slug)`. Optional `categoryId` FK + `subcategoryIds` JSONB (denormalized mirror of admin UI selections). Admin CRUD at `/admin/attributes/:type`. Frontend: `<AttributeManager type title hasImage? />` generic component in `components/dashboard/attribute-manager.tsx`.

## Pipeline workflow

The `.pipeline/` directory tracks feature changes through a structured four-phase workflow:

| Phase     | File              | Purpose                                          |
| --------- | ----------------- | ------------------------------------------------ |
| 1. Spec   | `spec.md`         | Engineering spec with decisions + open questions |
| 2. Impl   | `changes.md`      | Summary of files modified and behavioral diffs   |
| 3. Test   | `test-results.md` | Test gate results (build, lint, suites, count)   |
| 4. Review | `review.md`       | Code review verdict + follow-up tickets          |

The `planner`, `coder`, `tester`, and `reviewer` agent types work through this pipeline in order. For new features, start with the planner agent to produce `spec.md`.

## Frontend listing-form specs (`spec-detail-*.md`)

`apps/backend/spec-detail-one.md` … `spec-detail-twelve.md` (12 files, ~1,120 lines) are **per-category listing-creation form specifications**, written from the frontend's perspective. They are the source of truth for each subcategory's `field_schema` (see the Categories i18n section above). Each file enumerates the form fields for the subcategories of one main category:

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
- `noImplicitAny: true` and ESLint `@typescript-eslint/no-explicit-any: error` are enforced. Use typed interfaces or `unknown` instead of `any`. For Supabase client, use `type AnySupabaseClient = SupabaseClient` and add explicit return-type annotations on storage methods to avoid TS2742.
- Express 5 changed wildcard routing: use `'{*splat}'` in `forRoutes()`, not bare `'*'`.
- `@nestjs/jwt` uses `ms.StringValue` for `expiresIn`; cast runtime string values as `value as unknown as number` when passing to `jwtService.sign()`.

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

Optional (with defaults): `PORT=3000`, `JWT_ACCESS_EXPIRES_IN=15m`, `JWT_REFRESH_EXPIRES_IN=30d`, `THROTTLE_TTL=60`, `THROTTLE_LIMIT=100`, `SUPABASE_STORAGE_BUCKET=listings`, `TELEGRAM_BOT_TOKEN`, `FRONTEND_ORIGINS` (comma-separated), `DEV_OTP_TOKEN` (dev only — bypasses Supabase SMS, accepts this fixed token for all phone OTP verifications).

Note: the pre-commit hook blocks committing any file matching `*.env*`.

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
- **Models table has admin CRUD but no seed data.** Admin UI can create models via `/admin/models`, but no models are seeded — `GET /brands/:id/models` returns `[]` until populated.
- **Car/motorcycle brands not seeded.** `GET /brands?subcategory=cars-for-sale` returns `[]` until brand lists are defined and seeded.
- **No push notifications for chat.** New messages reach clients only via polling (`after=` deltas); no FCM/APNs/WebSocket layer exists. The chat schema needs no changes to add one later.
- **Chat images are public-bucket URLs.** Same exposure as avatars/listing photos; switch to a private bucket + `createSignedDownloadUrl` if chat privacy is required.
- **Inline `field_schema` duplication.** ~10 no-Type/no-Condition subcategory forms (all of Pets, Foods, and the no-Type Furniture blocks) are byte-identical to `commonListingFields` yet re-inline all 11 fields (~75 lines each) instead of referencing the const. Consistent by current convention but heavy; a one-time systemic refactor (e.g. `fieldSchema: [...commonListingFields]` for exact-match subcats) could DRY it. Non-blocking — do it once across all categories, never per-ship.
