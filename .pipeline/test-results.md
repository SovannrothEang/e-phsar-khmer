# Test results — Likes & Saved

Date: 2026-10-05. All commands run from the repo root.

## Backend gates

| Gate                          | Result                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| `pnpm --filter backend build` | ✅ clean                                                                                               |
| `pnpm --filter backend lint`  | ✅ 0 errors                                                                                            |
| `pnpm --filter backend test`  | ✅ **32 suites / 371 tests passed** (was 31/359; +1 suite, +12 tests from `reactions.service.spec.ts`) |

## Web gates

| Gate                                      | Result                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| `pnpm --filter web build` (the type gate) | ✅ clean                                                                                   |
| `pnpm --filter web lint`                  | ✅ 0 errors (1 pre-existing warning, `AdminLoginForm.tsx` — same one prior ships recorded) |

Note: the `next build` was run while the dev server was live; that later wedged
the dev server (`.next` contention). Verified fix: stop dev, clear `.next`,
restart dev. No bearing on the build's own result.

## Database

| Step                                 | Result                                                                                                           |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `db:generate`                        | `0028_acoustic_chat.sql` — creates **only** `listing_likes`, `listing_saves`, their cascading FKs, and 4 indexes |
| Ledger watermark check (pre-migrate) | newest applied row `1790742092641` > 0027's `when` `1790567679888` → only 0028 pending; no re-runs               |
| `db:migrate`                         | ✅ applied                                                                                                       |
| Table verify                         | `listing_likes`, `listing_saves`, `user_follows`, `notifications` all present                                    |

## API probes (live backend, minted token for `smoketest`)

| Probe                                | Result                                                   |
| ------------------------------------ | -------------------------------------------------------- |
| `POST /listings/:id/save` → `DELETE` | `{saved:true}` → `{saved:false}`                         |
| `POST /listings/:id/like` → `DELETE` | `{liked:true,likeCount:1}` → `{liked:false,likeCount:0}` |
| `GET /users/me/reactions`            | `{liked:[],saved:[]}` after cleanup                      |
| Guard probe                          | all 4 new routes 401 without a token (present, guarded)  |

## Browser verification (headless chromium, raw CDP)

**Run 1 — signed in as `smoketest`** (`/en/all-ads` → detail → `/me/*`):

| Check                                                                                          | Result        |
| ---------------------------------------------------------------------------------------------- | ------------- |
| P1 heart fills after click                                                                     | ✅            |
| P2 like survives **reload** (server-seeded, not just client state)                             | ✅            |
| P3 `/me/likes` lists it                                                                        | ✅            |
| P4 detail count seeded ("1 Like"), unlike decrements to "0 Likes", re-like returns to "1 Like" | ✅            |
| P4 detail Save → "Unsave"                                                                      | ✅            |
| P5 `/me/saved` lists it                                                                        | ✅            |
| P6 unlike lands                                                                                | ✅            |
| P6 unsave in the same 2.5 s window                                                             | ❌ first pass |

The one ❌ was a **driver timing artifact, not a product defect**: the unsave
click landed while the prior unlike was still in flight, so the control was
correctly `disabled` and the click was ignored. Proven by (a) direct backend
probes of both verbs, and (b) run 2 below, which waits for the control to be
enabled.

**Run 2 — focused re-run with wait-for-enabled mechanics:**

| Check                                                                       | Result |
| --------------------------------------------------------------------------- | ------ |
| S1 detail Save → label "Unsave"                                             | ✅     |
| S2 `/me/saved` lists it                                                     | ✅     |
| S3 unsave → label "Save", `/me/saved` empty again                           | ✅     |
| S4 signed-out heart click → bounce to `/en/login` + "Sign in to like" toast | ✅     |

**Run 3 — the card ⋮ menu path (Radix trigger, pointerdown):**

| Check                                                | Result |
| ---------------------------------------------------- | ------ |
| M1 ⋮ trigger found on a grid card                    | ✅     |
| M2 menu opens with "Save"                            | ✅     |
| M3 Save flips to "Unsave" in place (menu stays open) | ✅     |
| M4 `/me/saved` lists it                              | ✅     |

**DB cross-check after run 3:** `savedRows: ["test 1"]` — the menu Save
persisted; after cleanup `likedRows: [], savedRows: []`.

## Residual risk

- The mock Top Ads surface (home page, numeric ids) will error-toast if a
  heart is clicked there — legacy mock cards, noted in changes.md.
- No cross-tab sync of reaction state (out of scope); lists refresh on
  navigation/reload.

## Re-verification on the moved tree (concurrent session active)

While this ship was in review, a concurrent session in this checkout
(`profile-followers-tab-swap`) landed workspace + shared-file changes
(`apps/mobile` added; `listings.service.ts`, `lib/posts.ts`,
`lib/api/categories.ts`, `ThreeDotPost.tsx` touched). Re-ran the gates on that
moved tree:

| Gate                                                                                             | Result                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter backend build`                                                                    | ✅ clean                                                                                                                                                                                                                                                                                                        |
| `pnpm --filter backend lint`                                                                     | ✅ clean                                                                                                                                                                                                                                                                                                        |
| backend jest (plain runner)                                                                      | ⛔ infrastructure: the workspace lock now resolves `jest-runtime@30.4.2` against `jest-mock`/`jest-util`/`jest-environment-node@30.4.1`, so all 32 suites fail to **start** (`TypeError: this._moduleMocker.clearMocksOnScope is not a function`) — flagged to the session that owns the mobile dependency work |
| backend jest (isolated consistent runner: `pnpm dlx jest@30.4.2`)                                | **31 suites pass / 357 tests pass / 371 total** — all 12 reactions tests pass; the 14 failures are confined to `listings.service.spec.ts`, which pins the OLD `findFeed` mock chain while that session's in-flight change adds `.leftJoin(users, …)` to the service — zero failures in this ship's files        |
| web `tsc --noEmit` (the type gate's checking half, run without disturbing the shared dev server) | ✅ clean                                                                                                                                                                                                                                                                                                        |
| web lint                                                                                         | ✅ 0 errors (1 pre-existing warning)                                                                                                                                                                                                                                                                            |

Parity integration made during this pass: the two `/users/me/likes|saves`
queries now resolve `sellerUsername` with the same `leftJoin` the concurrent
feed change introduced — the cards on those pages are the feed's cards, so
the handle must ride the same way. Live-probed: the row carries
`sellerUsername: "testtest001"`.

Why the full `next build` was not re-run here: it shares `.next` with the dev
server the concurrent session is actively using (see changes.md); `tsc
--noEmit` gives the type-gate signal without that interference. The full
build was green on this ship's own changes earlier the same evening.

## Review-fix pass (same evening)

The planner's written spec review landed after the first verification pass with
four findings; all four were accepted and fixed:

| Finding                                                                            | Fix                                                                                                                                                                                                  | Re-verified by                                                                             |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Mock (non-UUID) card ids fired a real request → 400 + error toast on the home page | provider guard: non-UUID ids are inert                                                                                                                                                               | browser T1: mock heart click on `/en` — no toast, no navigation, no state flip             |
| Unliking on `/me/likes` left the row until a reload                                | provider tracks the session's toggle-offs; the panel filters on that (deliberately **not** membership — the seed sets fail soft, so a membership filter would blank the lists when the fetch failed) | browser T2: unlike from `/me/likes` drops the row live                                     |
| `DELETE` 404'd when the listing row was gone (unlike/unsave)                       | the DELETE side no longer asserts existence; `POST` keeps it — the toggle-end-state contract (`unfollow` idiom)                                                                                      | API: DELETE on a non-existent listing → `200 {liked:false, likeCount:0}` / `{saved:false}` |
| No Swagger metadata on the new controllers                                         | `@ApiTags('reactions')` + `@ApiBearerAuth()` on both                                                                                                                                                 | build/lint green                                                                           |

Gates re-run after the fixes: backend build ✔ lint ✔ · reactions spec **12/12**
· web `tsc --noEmit` ✔ · web lint ✔ (0 errors, 1 pre-existing warning). DB
cross-check after the browser pass: `likedRows: [], savedRows: []` (net zero).

## Final gate (both blockers cleared, same night)

The stage-4 reviewer flagged two blockers, neither in the reactions code; both
are now cleared and the plain command runs clean:

- **B1** — 14 `listings.service.spec` failures: the concurrent session's
  `findFeed` gained a `leftJoin(users, …)` while that spec's mock chain stopped
  at `from → where → orderBy → limit`. Fixed on that session's side while this
  ship was in review.
- **B2** — no backend suite could start (`clearMocksOnScope`):
  `testEnvironment: "node"` resolved `jest-environment-node` from the workspace
  hoist, which the `apps/mobile` install had left on the 29.x line. Fixed by
  pinning `"jest-environment-node": "^30.4.1"` in `apps/backend`
  devDependencies (the reviewer's diagnosis) + `pnpm install`.

```
pnpm --filter backend test
Test Suites: 32 passed, 32 total
Tests:       371 passed, 371 total
```

The isolated-runner workaround described above is no longer needed.

## Stage-4 deep pass (F2–F7)

The reviewer's second pass raised five further findings; two required code,
three are ticketed (detailed in `review.md`):

- **F2 — fixed.** The provider seeds its sets once and the `(user)` layout
  survives client-side navigations, so an in-tab login/account switch kept the
  previous viewer's sets. `<ReactionsProvider>` now carries
  `key={user?.username ?? "anon"}` — a viewer change remounts it and reseeds
  from the fresh server props. (Verified by construction + type gates; the
  in-tab login flow itself would need the real login UI to drive end-to-end.)
- **F7 — fixed.** The list queries are now the only place the hide-deleted
  rule lives, so two new specs compile their SQL with `PgDialect` and pin
  `"status" <> $n` (param `'deleted'`) and the `(createdAt, id)` desc
  tie-break for both lists. Reactions suite: **14/14**.
- **F3 / F5 / F6 — ticketed** (pending-guard ref hardening; no like control
  on zero-photo detail pages; id-set read unbounded and per-page).

Final plain `pnpm --filter backend test`: **32/32 suites, 373/373 tests**.

## Final measurements (reviewer caveats closed)

The reviewer's sign-off flagged two unmeasured items; both are now measured on
the tree as it stands:

- **Full web build re-run on the final tree** (dev stopped first, per the
  `.next` note above): `pnpm --filter web build` ✅ clean — alongside the
  `tsc --noEmit` + lint passes.
- **Signed-out behavior in the browser (driver 5, fresh profile, no cookie):**
  - a _mock_ heart (numeric id) clicked while signed out is **inert** — path
    stays `/en`, no bounce, no toast (the UUID guard, by design);
  - a _real_ card heart clicked while signed out **bounces to `/en/login`**
    with the "Sign in to like" toast.
