# Test results: Fix admin category/subcategory image disappearance

## Gates

| Command                       | Result           | Notes                                                                                                                                                          |
| ----------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter backend test`  | PASS             | 16/16 suites, 149/149 tests, 2.034s — pure regression signal; no backend source behavior changed                                                               |
| `pnpm --filter backend build` | PASS             | nest build clean; type-checks the narrowed `onConflictDoUpdate` SET in seed.ts                                                                                 |
| `pnpm --filter backend lint`  | PASS             | eslint --fix clean (no output)                                                                                                                                 |
| `pnpm --filter web build`     | PASS             | Full type gate (web has no check-types script); route table compiled incl. /wanderer/dashboard/categories and /subcategories — type-checks both ternary guards |
| `pnpm --filter web lint`      | PASS (1 warning) | `apps/web/components/auth/AdminLoginForm.tsx:12 'FieldDescription' is defined but never used` — pre-existing, file NOT touched by this change                  |

## Coverage assessment

No-new-tests claim verified with file evidence:

1. `apps/backend/src/db/seed.ts:116-119` is a top-level `seed().catch(...)`; `seed()` opens a real `postgres()` connection (line 22) gated only on `DATABASE_URL`. Importing it from a Jest spec would run the entire seed. Non-importable without the refactor the spec explicitly deferred — so the changed upsert (lines 38-41) cannot be executed by any suite.
2. `apps/web/package.json` scripts are exactly `dev`, `build`, `start`, `lint`; no jest/vitest/playwright anywhere in deps. No test infrastructure exists.
3. Both edited web files are `"use server"` modules (`actions/category.ts:1`, `actions/subcaetgory.ts:1`); there is no server-action test pattern in apps/web to extend.

Incidental coverage: none, and structurally impossible for the changed lines. Probed adjacent paths: `apps/backend/src/admin/admin-categories.service.spec.ts` and `apps/backend/src/categories/categories.service.spec.ts` both do not exist — no spec touches categories icon handling (backend service code unmodified anyway; `files.service.spec.ts` covers the unchanged `removeByPublicUrl` the self-heal path relies on).

## Risk assessment

- **seed.ts SET narrowing (line 40):** only removed behavior is "re-seed nulls every category icon" — the bug itself. Insert-side (line 35) untouched; brand-new rows identical; `sortOrder` reset unchanged (pre-existing, out of scope). Jest cannot execute this file, so the suite proves nothing about it; build proves only compilation. Live-DB proof not performed.
- **Ternary guards (category.ts:43-46, subcaetgory.ts:45-48):** strictly value-narrowing — output identical to old `|| null` for every input except exactly `"/placeholder.svg"` → null. `""` still maps to null (X-remove preserved; `cateIcon`/`subIcon` are bare `z.string()` so `""` validates). Placeholder literal byte-identical across all four sites (`admin-categories.ts:32`, `admin-subcategories.ts:33`, both guards). Backend `icon: null` is a pre-existing proven path: `UpdateCategoryDto.icon` `@IsOptional() @IsString()` (null skips validation), patch gate `dto.icon !== undefined` writes it (`admin-categories.service.ts:99`, `admin-subcategories.service.ts:111`), cleanup gate fires `removeByPublicUrl(oldIcon)` only when oldIcon truthy+changed — for polluted rows healing to null that calls `removeByPublicUrl("/placeholder.svg")`, which `files.service.ts:108-118` silently skips. Real-icon rows round-trip identical URLs via `iconToSrc` pass-through → no storage delete; replace/delete flows unchanged. No plausible breakage of existing behavior found. Minor pre-existing quirk (not a regression): a non-URL short identifier in `icon` was already clobbered on edit (with the placeholder); now clobbered with null — same clobber, honest value.

## Verdict

**PASS** — all gates green; the three edits are strictly behavior-narrowing, backend `icon: null` handling verified as a pre-existing proven path, and no existing suite or server-action path is affected. The single web lint warning (`AdminLoginForm.tsx` unused `FieldDescription`) is pre-existing in an untouched file — explicitly out of scope.

## Uncovered risks

- No live-DB seed idempotency run: the primary fix (icons survive `db:seed` re-run) is verified by code reading + build only, not execution. The spec's optional manual check (PATCH icon → re-seed → confirm `GET /admin/categories` keeps it) was not performed.
- No browser-level verification of the edit-form round-trip (placeholder → null on save; self-heal of polluted rows).
- Already-nulled category icons are not restored by this fix (manual re-link / ops script — spec follow-up).
- Polluted rows self-heal only on next edit; one-off SQL cleanup remains a follow-up.
- Future seed-defined category icons will not propagate to existing rows on re-seed (accepted in spec; matches subcategory convention).
