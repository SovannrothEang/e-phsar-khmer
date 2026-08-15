# PSA-NPIC System Architecture Map

> Generated 2026-07-31 from a full read-through of the repository (verified against code, not just CLAUDE.md). Section 9 lists where CLAUDE.md has drifted from reality — read that first if you're using CLAUDE.md as your source of truth.

## 0. System overview

**Stack:** pnpm 9 + Turborepo 2 monorepo · NestJS 11 backend (`apps/backend`) · Next.js 16.2 App Router frontend (`apps/web`) · Postgres via Drizzle ORM (`casing: snake_case`) · Supabase (auth/OTP/storage).

One app serves both the admin dashboard **and** the full public marketplace — the backend is the only real data source; the marketplace UI runs on hardcoded mocks.

## 1. Module & package layout

```
apps/backend   NestJS 11 API — 139 files, 15 feature dirs, 29 tables, 12 migrations
apps/web       Next.js 16.2 admin dashboard + public marketplace — 382 files
apps/admin     EMPTY leftover dir (renamed → web)          apps/docs: absent
packages/ui    @repo/ui — 3 components (button, card, code), per-file exports
packages/eslint-config, packages/typescript-config — presets (web does NOT use either)
.pipeline/     spec.md → changes.md → test-results.md → review.md (planner/coder/tester/reviewer agents)
apps/backend/docs/spec-detail-*.md — 12 per-category listing-form specs (1,117 lines)
```

**Key fact: `apps/web` is fully standalone.** It has zero `@repo/*` deps — its tsconfig extends nothing (own `@/*` alias), its eslint uses `eslint-config-next` directly. The monorepo packages are effectively vestigial for the only two real apps.

## 2. Backend core responsibilities

| Module                        | Responsibility                                                                                                                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth/`                       | Password + phone-OTP + Telegram login, social callbacks, dual JWT (`{sub, role}`, 15m/30d), `mirrorSupabaseUser` upserts, soft-delete enforcement at 3 entry points           |
| `users/`                      | Profile CRUD, phone management (≤1 primary), avatar/cover upload, blocks, username generation (`base2`, `base3`… suffix loop, NFC-lowercase)                                  |
| `listings/`                   | Marketplace feed (cursor on `(createdAt, id)` base64) + owner feed (offset), slug short-circuit `[]`, publish (30d expiry), photos in 2nd batch, soft-delete                  |
| `categories/`                 | 4-table i18n (`en/km/zh`), dual LEFT JOIN + JS COALESCE, `field_schema` JSONB (`FieldDef[]`) seeded but never read at runtime                                                 |
| `chat/`                       | REST + polling, per-contact threads (canonical `userA < userB` pair, upsert), 6-step send rejections, cursor + `after=` deltas, bulk read receipts                            |
| `files/`                      | Signed uploads to Supabase (9 scopes), no confirmation endpoint, no content validation                                                                                        |
| `locations/` + `brands/`      | Public read-only lookups (provinces/districts/communes; brands/models/links)                                                                                                  |
| `admin/`                      | The 9-controller admin surface: stats/timeseries, users, categories, subcategories, brands, models, subscriptions (4-tier), user-subscriptions, reports, reasons                |
| `attributes/`                 | Admin-scoped CRUD for `attribute_options` (route `/admin/attributes/:type`), decoupled from `AdminModule` — own module registered in `AppModule`, imports `FilesModule` for image cleanup |
| `activity/`                   | `LastSeenInterceptor` → in-memory 5-min throttle touch                                                                                                                        |
| `common/`                     | Response envelope, exception filter, idempotency middleware, decorators, Supabase client                                                                                      |
| `db/` + `config/` + `health/` | Global Drizzle/PG clients, Zod env validation, `GET /health`                                                                                                                  |

## 3. Key API contracts

**Envelope** — everything returns `{success, data, meta?}`; errors `{success: false, error: {code, message, details?}}`. Strings pass through unwrapped. Validation errors: `code: BAD_REQUEST`, `message: 'Validation failed'`, array `details`.

**Request lifecycle** — `IdempotencyMiddleware` (POST/PATCH/PUT, key+method+path+user scope, SHA-256 body hash) → `ThrottlerGuard` (60s/100, in-memory) → `JwtAuthGuard` (skipped by `@Public()`) → `ValidationPipe` (whitelist + transform + `forbidNonWhitelisted` + implicit conversion) → handler → `ResponseInterceptor` → `GlobalExceptionFilter`.

**Auth** — JWT payload exactly `{sub, role}`; `req.user = {id, role}`; refresh token 30d on separate secret; **no logout/revocation** (stateless JWTs); admin = `@Roles('admin')` + `RolesGuard` (per-controller, not inherited from module).

**Public endpoints** — health, locations, brands, categories, listings feed + detail. Everything else requires JWT; admin routes require `admin` role.

**Files** — `POST /files/sign {filename, scope}` → `{signedUrl, path, token, publicUrl}`; client PUTs bytes directly to Supabase; `path` is recorded in domain rows; public URLs derived server-side.

## 4. Major data flows

1. **Login/registration** — password (`/auth/login`) or phone OTP (register → `otp/verify` → `mirrorSupabaseUser` upsert on `primaryPhone`/`email` w/ `targetWhere: isNull(deletedAt)` → tokens) or Telegram (HMAC widget check) → admin gate in `actions/login.ts`.
2. **Dashboard** — RSC `serverFetch` (cookie-injected Bearer) → transparent 401 refresh (once) → TanStack Query client refetch (`staleTime 30s`); mutations → server actions → invalidate.
3. **Listing creation** — client uploads photos to Supabase via signed URL → `POST /listings` with `photo.path`s → photos batch-inserted → `publish` sets `active` + `expiresAt +30d`.
4. **Chat** — send finds-or-creates conversation (single upsert bumping `lastMessageAt`) → message insert; client polls `GET /chats/:id/messages?after=latestCursor` (strictly `gt`, timestamp(3) precision); mark-read bulk-sets `readAt`.
5. **Idempotent POST** — INSERT ON CONFLICT DO NOTHING RETURNING → owned=proceed; replay completed→cached response; processing+diff-hash→422; processing+same-hash<30s→409; failed→reclaim.

## 5. Core call chains

```
RSC/admin page → server action (serverFetch) → GET /api/v1/admin/* (RolesGuard→JwtAuthGuard→ValidationPipe)
  → AdminService/Admin*Service (Drizzle queries + batch-lookup maps) → envelope → {success,data}

POST /chats/messages → IdempotencyMiddleware → Throttler → JwtAuthGuard → ChatService.sendMessage
  → 6 rejections (self / empty / path-prefix / recipient / blocks / listing ownership)
  → canonical pair → upsert conversation → insert message → {success,data}

GET /api/v1/listings?categorySlug=… → resolveQueryFilters (slug→id, unknown→[] short-circuit)
  → cursor decode {createdAt,id} → lt/and(eq,lt) → limit+1 → batchLoadPhotos → nextCursor encode
```

## 6. Database (29 tables, 12 enums, 12 migrations 0000–0011)

- **Users core**: `users` (3 partial uniques `WHERE deleted_at is null` — soft-delete frees identifiers), `user_phones` (global unique + ≤1 primary partial), `user_auth_providers`, `user_blocks` (directional, not-self CHECK).
- **Geography**: `provinces` (25) / `districts` (25) / `communes` (0 — **no unique constraint**, only an index).
- **Categories**: `categories` + `subcategories` + 2 translation tables; `fieldSchema` JSONB on 146 subcategories.
- **Listings**: `listings` (cursor index `(status, created_at, id)`, 4 CHECKs, `attributes` JSONB free-form) + `listing_photos` (backfilled from JSONB in migration 0003).
- **Chat**: `conversations` (pair CHECK + unique) + `messages` (timestamp(3), unread partial index, listing FK set-null).
- **Lookups**: `brands`/`models`/`brand_subcategory_links`; `attribute_options` (type+slug unique, categoryId FK, subcategoryIds JSONB).
- **Subscriptions**: 4-tier config cascade + `user_subscriptions` (status derived from `expiresAt`).
- **Reports**: `report_reasons` (picklist), `user_reports`/`listing_reports` (no unique constraints).
- **Idempotency**: `idempotency_keys` (`NULLS NOT DISTINCT` dedupe incl. anonymous).
- **Seeds**: 12 categories / 146 subcategories (all with `field_schema`, **en-only**), 67 brands, 25/25/0 geography, 8 report reasons + 1 sample row, env-gated admin.

## 7. Technical debt

### Data-loss / correctness bugs

1. **Admin `hasImage` bug** — attribute edits for non-image types send `image: null`, backend `update` writes it (null ≠ undefined) → wipes image on every edit.
2. **`DELETE /files` has no ownership check** — any authenticated user can delete any path in the bucket.
3. **Signed uploads skip validation** — no `image/*`/5MB check; the file never passes through the backend.
4. **Reports seed not idempotent** — `user_reports` has no unique constraint → re-seeding duplicates the sample row.
5. **No uniqueness on communes** — potential duplicate slugs, and 0 seeded.

### Stale / dead code

6. **16 orphaned server actions + schemas + types + mock libs** — the whole per-attribute CRUD layer is dead (AttributeManager uses `admin-attributes.ts`).
7. **`SupabaseStrategy` dead** (with latent bug `const token = ''`); **`@Idempotent()` dead metadata**; **`@repo/*` packages unused by web**; **`apps/admin/` empty leftover**; **`networks/Phone.tsx` broken file**; **`lib/colors.ts` + `createSignedDownloadUrl` unused**; `app/api/api.ts` empty.
8. **`apps/web/README.md` has unresolved merge-conflict markers** (needs attention before any release).

### Missing features (all 13 CLAUDE.md known gaps verified still true)

Feedback table, km/zh seed translations, idempotency completed-hash check, primary-phone reassignment, delete-account flow, geography i18n, `PublicUser` over-exposure, communes, models seed, car brands, push notifications, chat private bucket, `field_schema` unused at runtime.

### Operational debt

9. **No CI** — zero GitHub workflows; **no pre-commit hook** (despite CLAUDE.md claim — `.gitignore` only); `.env.example` is 0 bytes.
10. **No tests for the admin surface** — the largest feature area (stats, users CRUD, subscriptions, reports, attributes) has zero coverage; only 12 spec files total (97 tests).
11. **Idempotency `cleanupExpired()` never scheduled** — lazy-only cleanup; TTL relies on per-key requests.
12. **In-memory throttler** — single-instance only; no Redis.
13. **No logout endpoint** — stateless refresh tokens can't be revoked.
14. **`PublicUser` leaks** `deletedAt`, verification timestamps cross-user.

## 8. Engineering constraints for future refactoring

1. **Response contract is sacred.** All non-string responses must be `{success, data, meta?}`; errors `{success: false, error:{code,message,details?}}`. New endpoints must use the envelope; do not unwrap/re-wrap inside handlers.
2. **Never import `DbModule`/`SupabaseModule`** — they are `@Global()`; inject `@Inject(DRIZZLE)`/`@Inject(PG_CLIENT)`/`SupabaseService` directly.
3. **Keep the auth model intact.** JWT payload is exactly `{sub, role}`; `req.user` is `RequestUser {id, role}`; `@Public()` is the only bypass; soft-delete enforced at login/refresh/`JwtStrategy.validate`; admin via `@Roles('admin')` + `RolesGuard` per-controller.
4. **Idempotency middleware stays unconditional** on POST/PATCH/PUT — do not add new `@Idempotent()` gates; fix the completed-hash gap inside the middleware only.
5. **Slug + i18n conventions.** `SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/` everywhere; locales `en|km|zh` (backend) — the web's 6 locales is an artifact, not a contract; category lookups use the dual-JOIN + COALESCE pattern; slug-unknown → `[]` (not 404) for list feeds, 404 for single lookups.
6. **Cursor pagination invariant.** Cursors encode `{createdAt, id}`; ordering `(createdAt desc, id desc)`; always `lt/gt` with `and(eq, lt)` tie-break; timestamps must stay `timestamp(3)` for delta polling; invalid cursors are ignored, never error.
7. **Soft-delete semantics.** `users` partial uniques `WHERE deleted_at is null`; upserts must pass `targetWhere: isNull(users.deletedAt)`; lookups must filter it; `user_phones.phone` is globally unique and never freed.
8. **Seeds are upserts, never truncate** — `onConflictDoUpdate` on slugs / `onConflictDoNothing` on composites; re-running `db:seed` must be a no-op.
9. **Money is `numeric` stored as strings** (`price` `numeric(14,2)`, `priceUsd` snapshot); `Math.max(0, round2)` for discount math.
10. **Files flow stays client-direct-to-Supabase**: `POST /files/sign` → PUT bytes → record `path`; server derives `publicUrl`. Don't add a proxy upload path. (But fix the ownership/validation gaps — those are bugs, not conventions.)
11. **Admin features extend `AdminModule`** — add controllers/services there (don't create sibling modules); keep `@Roles('admin')` + `RolesGuard` at controller level. Exception: the attributes feature owns `src/attributes/` (admin-scoped routes, registered in `AppModule`) — the pattern for features that will grow a public surface.
12. **TypeScript discipline** — `noImplicitAny` + `no-explicit-any: error` in backend; no `.js` extensions on relative imports (CJS, `module: nodenext`); `crypto.randomUUID()` only (no `uuid` dep); Express 5 wildcard `'{*splat}'`.
13. **Casing** — schema columns camelCase → DB `snake_case` automatically via Drizzle `casing`; raw SQL must use snake_case. All ID FKs are UUIDs.
14. **Admin UI patterns** — server actions + `serverFetch`, `["admin", <domain>]` query keys, `invalidateQueries` after mutations, `toast` feedback, verbose-adapter mapping (backend → UI types inside `queryFn`), batch-lookup `inArray` → `Map` for dual-FK name joins.

## 9. CLAUDE.md drift (verified 2026-07-31)

| #   | CLAUDE.md says                                                                    | Reality                                                                                                                   |
| --- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | Migrations `0000`–`0009`                                                          | 12 migrations exist: `0000`–`0011` (`0010` adds subcategory icon + model image; `0011` widens icon/image to varchar(500)) |
| 2   | "pre-commit hook blocks `*.env*`"                                                 | No hooks installed — `.gitignore` does the blocking                                                                       |
| 3   | `apps/docs` exists (port 3002)                                                    | Absent entirely                                                                                                           |
| 4   | Spec-details at `apps/backend/spec-detail-*.md`                                   | Actually `apps/backend/docs/spec-detail-*.md`                                                                             |
| 5   | Web imports `@repo/ui`, extends `@repo/typescript-config` + `@repo/eslint-config` | False — web has zero `@repo/*` deps, standalone tsconfig/eslint                                                           |
| 6   | `POST /files/sign` scopes `avatar\|cover\|listing\|chat`                          | Code allows 9: + `category, subcategory, brand, model, attribute`                                                         |
| 7   | RolesGuard "inherited from AdminModule"                                           | Applied per-controller on all 9 admin controllers; AdminModule registers none                                             |
| 8   | Web scripts `check-types` + `eslint --max-warnings 0`                             | Neither exists; lint is plain `eslint`                                                                                    |
| 9   | Communes "unique on `(district_id, slug)`"                                        | Only a non-unique index; no unique constraint                                                                             |
| 10  | Premium derivation "via EXISTS"                                                   | Batch `inArray` + `selectDistinct` over the page's users                                                                  |
| 11  | Seed order "geography → categories → brands"                                      | Also runs admin + reports seeds                                                                                           |
| 12  | Dev OTP fake user "deterministic SHA-256 UUID from phone"                         | Literal `{ id: 'dev', phone }` — same id for every phone                                                                  |
| 13  | Seed doc "12 categories" table says "12,155-line file" (implied)                  | 146 subcategories, 146 `fieldSchema:` blocks, en-only (`km:`/`zh:` count = 0)                                             |
| 14  | `apps/backend/.env.example` has documented vars                                   | File exists but is **0 bytes**                                                                                            |
| 15  | ValidationPipe "whitelist + transform"                                            | Also `forbidNonWhitelisted: true` + `enableImplicitConversion: true` (stricter)                                           |

Additional findings not in CLAUDE.md: `@Idempotent()` decorator is dead metadata (middleware is unconditional); `SupabaseStrategy` registered but never wired to a guard (latent `const token = ''` bug); idempotency `cleanupExpired()` never scheduled; no logout endpoint (stateless refresh tokens); `apps/web/README.md` has unresolved merge-conflict markers; `app/api/api.ts` is an empty file; web i18n has 6 locales (en, km, zh, ko, id, vi) while backend supports 3.
