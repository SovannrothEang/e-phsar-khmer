# TODO — Attributes module decoupling (2026-07-31)

**Constraint:** NO change to business logic, API signatures, or runtime behavior.
Fixes/features (hasImage null-wipe, `DELETE /files` ownership, seeding, `:type` validation) are intentionally OUT of scope — each is a behavior change.

## Plan

- [x] Read all files to move/wire (backend controller/service/DTOs, modules; web pages/index/routing)
- [x] Backend: `git mv` 4 files `src/admin/` → `src/attributes/` (renames tracked by git)
- [x] Backend: rename classes `AdminAttributes*` → `Attributes*`
- [x] Backend: create `AttributesModule` (imports `FilesModule`)
- [x] Backend: strip all attribute references from `AdminModule`
- [x] Backend: register `AttributesModule` in `AppModule`
- [x] Web: create `lib/attribute-types.ts` registry (18 types, `{type, title, hasImage}`)
- [x] Web: replace 18 one-liner pages with dynamic `attributes/[type]/page.tsx`
- [x] Web: index hub derives its links from the registry (order + titles preserved)
- [x] Verify: backend lint / build / test suite
- [x] Verify: web lint (changed files) / build — incl. baseline comparison
- [x] Verify: route surface unchanged (grep before/after)
- [x] Docs: `tasks/todo.md`, `docs/architecture.md`, CLAUDE.md note

## Verification results

| Gate                     | Result                  | Detail                                                                                                                                                                           |
| ------------------------ | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend lint             | ✅ PASS                 | `eslint --fix`, exit 0                                                                                                                                                           |
| Backend build            | ✅ PASS                 | `nest build`, exit 0                                                                                                                                                             |
| Backend tests            | ✅ PASS                 | 15 suites / 140 tests, all green                                                                                                                                                 |
| Route surface            | ✅ UNCHANGED            | `@Controller('admin/attributes/:type')` + GET/POST/PATCH/DELETE byte-identical; `admin.module.ts` has zero attribute references                                                  |
| Web lint (changed files) | ✅ PASS                 | `page.tsx`, `[type]/page.tsx`, `lib/attribute-types.ts` → exit 0                                                                                                                 |
| Web build                | ⚠️ PRE-EXISTING FAILURE | Fails on `components/testcard/ListorGrid.tsx` (`Cannot find name 'posts'`) — **proven identical on clean `main`** (stash + baseline build). My files type-check; zero new errors |
| Web lint (whole app)     | ⚠️ PRE-EXISTING FAILURE | 73 errors / 210 warnings — **proven identical on clean `main`**                                                                                                                  |
| Git history              | ✅ CLEAN RENAMES        | 4 `R` renames, no content diff in moved service/controller/DTOs beyond class-name change                                                                                         |

## Review

- **What changed**: backend attributes moved out of `AdminModule` into an owned `AttributesModule` (same routes/DTOs/logic); frontend 18 duplicate pages → 1 dynamic route + shared `ATTRIBUTE_TYPES` registry; index hub derives links from it.
- **What didn't change**: any query, validator, error message, envelope, guard, or seed; any URL, title, or rendered behavior.

---

# Ticket — Web build blockers (2026-07-31, approved plan: `.claude/plans/sleepy-napping-garden.md`)

**Problem:** `next build` on `main` failed with 821 type errors — all pre-existing & committed (proven via `git show HEAD`; attributes refactor contributes zero).

**Fixes applied:**

- Deleted `apps/web/lib/models.ts` (dead mock, 0 importers; 636 errors) — `types/model.ts` KEPT (imported by live admin Models page)
- Deleted `apps/web/components/testcard/` (`ListorGrid.tsx` + `ViewToggle.tsx`; dead scratchpad, undefined `posts`)
- Deleted `apps/web/app/[locale]/(admin)/dashboard/attributes/networks/Phone.tsx` (broken scratchpad)
- Removed stray `[x: string]: string` index signature from `Subcategory` in `apps/web/types/category.ts` (184 errors)

**Verification:**
| Gate | Result |
| --- | --- |
| `npx tsc --noEmit` | ✅ 0 errors (was 821) |
| `pnpm --filter web build` | ✅ PASSES (exit 0, full route compile incl. `attributes/[type]`) |
| `pnpm --filter web lint` | ⚠️ 70 errors / 208 warnings — **down from 73/210** (deletions removed 3 err + 2 warn); remaining are pre-existing, out of scope |
| Dependencies / commits | ✅ none changed / none made |

**Deferred follow-ups (user-scoped out):** web lint sweep to zero (incl. `GridCardPost.tsx` conditional-hooks runtime bug); backend files ownership hardening; attribute bugs + seed (`hasImage` null-wipe, `:type` validation, seed from field_schema unions); doc-drift cleanup.

---

# Ticket — Web lint tiers 1+2 (2026-07-31): hooks + effects errors

**Scope (user decision):** fix the genuine runtime bugs + effect-pattern errors only; warnings + cosmetic errors deferred.

**Fixes:**

- `components/ads/GridCardPost.tsx` — hoisted 3 `useState` above the `if (!user) return null` early return (conditional hooks — real runtime bug); `@ts-ignore` → `@ts-expect-error` (ban-ts-comment)
- `components/post/Profile-Sidebar.tsx` — same hooks hoist (2 `useState`)
- `components/filter/PriceFilter.tsx` — removed the set-state effect entirely; params now re-derived and used as `useState` initializers (same values, one render fewer)
- Suppressed `react-hooks/set-state-in-effect` (correct-by-construction external-sync patterns, inline disable + reason comment): `hooks/use-mobile.ts`, `components/ui/carousel.tsx`, `components/dashboard/nav-user.tsx`, `components/web/NavBar.tsx`, `components/ui/theme-switcher.tsx`, `components/filter/MoreFilters.tsx`

**Excluded (deferred):** `components/ui/sidebar.tsx` purity (`Math.random` skeleton shimmer) — fixing requires a real behavior refactor on a generated file; unused-vars warnings.

**Verification:**
| Gate | Result |
| --- | --- |
| Targeted lint (9 fixed files) | ✅ 0 errors (was 13) |
| `npx tsc --noEmit` | ✅ 0 errors |
| `pnpm --filter web build` | ✅ PASSES |
| Full `pnpm --filter web lint` | ⚠️ 57 errors / 209 warnings — **down from 70** (13 removed: 6 real fixes + 7 suppressions) |

---

# Ticket — Web lint tier 3 (2026-07-31): full lint cleanup

**Scope (user decision):** clean up ALL remaining lint problems — 57 errors + 209 warnings → 0/0.

**Fixes:**

- **Errors (57)**: 37 `no-unescaped-entities` (escaped `'`/`"` → `&apos;`/`&quot;` in ~18 files); 19 `no-explicit-any` (typed `ContactUser`/`LocalSwitcherSelect`/`ClientThemeProvider`/`theme-provider`/`i18n/request`/`SubcategoryContent`(→`Subcategory`)/`app-sidebar`(→`ComponentType`/`ComponentProps<typeof Link>`)/`checkout`); 1 `react-hooks/purity` (`sidebar.tsx` Math.random → deterministic `useId`-derived width)
- **Warnings (209)**: removed ~200 unused imports/vars across ~40 files; 5 `no-unused-expressions` (MoreFilters ternary → if/else; PostForm dead expressions removed); 4 `no-img-element` (disable + reason comment — dynamic attachment URLs / object-URL previews / static placeholder)
- **Mistakes caught & reverted during sweep**: LSPHeader `showPriceDropdown` (actually read), Forgot-PassowordForm `isLoading` (actually read), PostImage/`isSticky`/`showFilters` setters (live) — all restored as setter-only or full forms

**Verification:**
| Gate | Result |
| --- | --- |
| `pnpm --filter web lint` | ✅ **0 errors / 0 warnings — exit 0** (was 73e/210w at baseline) |
| `npx tsc --noEmit` | ✅ 0 errors |
| `pnpm --filter web build` | ✅ PASSES |

**Notes:** the 2 pre-existing Next.js serializable-prop compiler diagnostics were resolved 2026-07-31:

- **`global-error.tsx` (both files):** `unstable_retry` → **`reset`** — a real bug fix, not just a rename: verified in `node_modules/next/dist/client/components/error-boundary.js:109` that Next 16.2 passes `reset: this.reset` to error components (`unstable_retry` is the `catchError` API's prop, not the error-file convention's). The retry button previously called an always-undefined prop and did nothing; it now works.
- **`PostForm.tsx` + `sell/page.tsx`:** `onSelect` → `onSelectAction`, `onBack` → `onBackAction` (the compiler-recommended convention for client-boundary function props; renamed consistently at all 4 usage sites).

Both resolved without touching the server-action semantics or behavior beyond the retry-button fix. Full gates after: tsc 0, lint 0, build PASSES.

---

# Ticket — Image pipeline fixes (2026-08-04)

**Context:** Read-only investigation found (1) a latent image-disappearance risk — `next/image` `remotePatterns` missing the Supabase host, which would break optimization once real Storage URLs flow through user-facing `<Image>` consumers (`GridCardPost`, `ListCardPost`, `AdBanner`, `PublicProfileHeader`); (2) orphaned images on avatar/cover/listing-photo replace — admin entities already clean up via `removeByPublicUrl`, but user/listing surfaces did not; (3) a CLAUDE.md inaccuracy — models described as "text-only" when they carry an image field.

**Captain's secret-leak concern:** investigated — zero hardcoded Supabase URLs in source (only dummy test fixtures); backend already reads `SUPABASE_URL` via `ConfigService`. Fix #1 derives the host from `process.env.SUPABASE_URL` at build time (no hardcoding, server-side only).

**Fixes applied:**

1. **`apps/web/next.config.ts`** — reads `process.env.SUPABASE_URL`, parses hostname via `new URL(...)`, adds it to `remotePatterns` conditionally (`protocol: "https" as const` to satisfy Next's `RemotePattern` literal type). Removed stale `images.khmer24.co` (pre-rename scaffolding cruft). Kept `ui-avatars.com` (default avatars). Web env vars documented in CLAUDE.md (web `.env.example` blocked by the `.env*` file guard).
2. **`UsersService`** — `setProfilePhoto` / `setCoverPhoto` now read the prior URL before overwriting, then call `filesService.removeByPublicUrl(oldUrl)` after commit (best-effort, gated on actual change). `UsersModule` imports `FilesModule`. Spec `makeService` updated with FilesService mock (4th constructor arg).
3. **`ListingsService.update`** — photo-swap branch captures existing photo URLs before `delete(listingPhotos)`, then calls `removeByPublicUrl` for photos removed from the payload (kept photos untouched in storage). `ListingsModule` imports `FilesModule`. Spec `makeService` updated. Soft-delete `remove()` intentionally untouched (restore must work).
4. **`CLAUDE.md`** — models "text-only" → "each model carries an optional image; old images are cleaned up on update/delete via `removeByPublicUrl`". Added web env-var documentation paragraph.

**Pattern reuse:** avatar/cover/listing cleanup follows the identical `removeByPublicUrl`-after-commit pattern already used by 5 admin services. No new helpers added; `FilesService.removeByPublicUrl` (`files.service.ts:105-125`) reused throughout.

**Verification:**
| Gate | Result |
| --- | --- |
| Backend lint | ✅ PASS (exit 0) |
| Backend build | ✅ PASS (`nest build`, exit 0) |
| Backend tests | ✅ PASS (16 suites / 149 tests, all green) |
| Web build | ✅ PASS (full route compile, includes type-checking — resolves the `as const` RemotePattern type) |
| Web lint | ✅ PASS (exit 0) |
| Dependencies / commits | ✅ none changed / none made |

**Out of scope (flagged for follow-up):**

- Admin user soft-delete avatar/cover cleanup (`admin.service.ts:393-411`) — privacy-relevant; separate ticket.
- Listing soft-delete storage cleanup — intentionally skipped (restore must work).
- Chat image cleanup — no delete path by design.
- Orphans reaper / GC sweep — no scheduled job; pre-existing orphans not reclaimed.
- Backend `.env.example` is empty (0 lines) — real docs gap, not addressed here.
