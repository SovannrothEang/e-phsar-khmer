# Review — Likes & Saved

**Verdict: approve.** No correctness defect was found in the likes/saves
domain — confirmed by two independent adversarial reads (the stage-1 planner's
written review and the stage-4 reviewer agent's report, whose deep pass raised
five further findings). Everything fixable in scope was fixed and re-verified;
the remainder is small, specific follow-up tickets. Nothing is committed or
merged — the working tree is the review surface.

**Provenance.** The stage-4 reviewer agent's report was received (snapshot
23:33 ICT) and is folded in, including its deep pass. Its closing section was
received: it confirmed the DELETE-side contract change is correctly recorded in
`CLAUDE.md` and `changes.md`, and flagged one stale line in `changes.md`'s file
table (fixed). Its F7 "currently RED" reading was a pre-fix snapshot — the same
helper fix it prescribed landed before the message arrived, and the suite is
green (32/32 suites, 373/373). Both reviews read a
tree that moved during the night: a concurrent session is active in this
checkout (its changes are noted where they touch this ship).

## Verdict history

1. Stage-1 planner review → four findings; all fixed and re-verified (below).
2. Stage-4 reviewer agent → "approve the feature — but do NOT call the gate
   green until B1/B2 are cleared." **Both cleared** (below).
3. Stage-4 deep pass → F2–F7 (below): **F2 and F7 fixed; F3/F5/F6 ticketed.**
   The verdict is unchanged: **approve**.

## Findings — all fixed and re-verified

| #   | Severity                                   | Finding                                                                                                                                                                                                           | Resolution                                                                                                                                                                                                                                                     | Verification                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | High (regression on the most-visited page) | Mock cards (home Top Ads; non-UUID detail slugs) rendered live hearts: a signed-in visitor's click fired a real request → `ParseUUIDPipe` 400 → red "Validation failed" toast, where the old mock fake-succeeded. | Provider guard: non-UUID ids are inert — no request, no toast, no flip.                                                                                                                                                                                        | Browser: mock heart clicked on `/en` — no toast, no navigation, no state change. Reviewer independently re-checked (**covered**), with one accepted nuance: a _signed-out_ visitor clicking a mock heart now gets nothing rather than the sign-in bounce, because the UUID guard runs before the signed-in check — knowingly accepted: a demo surface should not drag anyone to sign-in. |
| 2   | Medium (stale UI)                          | Unliking on `/me/likes` (or unsaving on `/me/saved`) left the row until a reload.                                                                                                                                 | Provider records the session's toggle-offs (`isToggledOff`, keyed `kind:id`); the panel filters on that — deliberately **not** on membership, since the seed sets fail soft to empty and a membership filter would blank the lists whenever that fetch failed. | Browser: unlike from `/me/likes` drops the row live; the empty state shows when it was the last row. Reviewer traced the rollback path and marked covered.                                                                                                                                                                                                                               |
| 3   | Low (contract inconsistency)               | `DELETE`-side toggles asserted the listing exists → a stale unlike of a hard-deleted listing 404'd (error toast + rollback), against the repo's toggle idiom (`unfollowUser` never 404s).                         | The DELETE side no longer asserts existence; `POST` keeps it. Spec said "both verbs" — deviation recorded in `changes.md` and `CLAUDE.md`, implemented per the idiom.                                                                                          | API: DELETE on a non-existent listing → `200 {liked:false, likeCount:0}` / `{saved:false}`; unit tests lock the no-probe path. Reviewer marked covered.                                                                                                                                                                                                                                  |
| 4   | Info (docs)                                | Neither new controller carried `@ApiTags` / `@ApiBearerAuth`.                                                                                                                                                     | Added to both.                                                                                                                                                                                                                                                 | build / lint green. Reviewer marked covered.                                                                                                                                                                                                                                                                                                                                             |

Integration item caught cross-session: the feed's listing rows now carry
`sellerUsername` (the concurrent change), so `/users/me/likes|saves` resolve it
with the same `leftJoin` — the cards on those pages are the feed's cards.
Live-verified (`sellerUsername: "testtest001"` on a liked row).

## Stage-4 deep pass — F2–F7

- **F2 — MEDIUM-LOW, fixed.** Provider state is seeded once
  (`useState(() => new Set(initialLiked))`) and the `(user)` layout survives
  client-side navigations, so later `initialLiked`/`initialSaved` props were
  ignored: an in-tab login/account switch kept the previous viewer's sets
  (repro: A likes X → log out → log in as B without a hard reload → X's heart
  shows filled for B). `<ReactionsProvider>` now carries
  `key={user?.username ?? "anon"}` — a viewer change remounts it and reseeds
  from the fresh server props. Verified by construction + type gates; the
  in-tab login flow itself is not CDP-driven (it needs the real login UI).
- **F7 — LOW (test quality), fixed.** The list queries are now the only place
  the hide-deleted rule lives (the DELETE side no longer probes existence), so
  two new specs compile their SQL with `PgDialect` and pin
  `"status" <> $n` (param `'deleted'`) and the `(createdAt, id)` desc
  tie-break for both lists. Reactions suite: **14/14**.
- **F3 — LOW, ticketed.** The pending guard reads render-time state; two
  clicks delivered in one tick could compute the same `next`. Idempotent
  server-side, React flushes discrete events between physical clicks, and the
  house's `FollowButton` has the same shape — hardening with a `useRef`
  in-flight set is the ticket if it is ever observed.
- **F5 — LOW, ticketed.** A listing with zero photos renders no `PostImage`,
  so its detail page shows no like control (cards still work). The right fix
  is a design decision for a photo-less listing's detail, not a flag flip.
- **F6 — LOW, ticketed.** The id-set read is unbounded, unfiltered, and
  fetched on every signed-in page (+1 round trip per navigation). The
  unfiltered read is _deliberate_ (a restored listing's like stays lit);
  filtering on `status != 'deleted'` and/or a cap is a scale ticket.

## Gate blockers (raised by the stage-4 reviewer; both cleared)

- **B1 — 14 `listings.service.spec` failures.** The concurrent session's
  `findFeed` gained `.leftJoin(users, …)` while that spec's mock chain stopped
  at `from → where → orderBy → limit`. Not the reactions code. **Cleared on
  that session's side while this ship was in review** (confirmed from both
  sides).
- **B2 — no backend suite could start** (`TypeError:
this._moduleMocker.clearMocksOnScope is not a function`).
  `testEnvironment: "node"` resolved `jest-environment-node` from the workspace
  hoist, which an `apps/mobile` install had left on the 29.x line. **Cleared by
  pinning `"jest-environment-node": "^30.4.1"` in `apps/backend`
  devDependencies** (the reviewer's diagnosis) + `pnpm install`. This
  package.json + lock touch is the ship's one workspace-level change.

**Final gate on the settled tree:**

```
pnpm --filter backend test
Test Suites: 32 passed, 32 total
Tests:       373 passed, 373 total
```

Backend build/lint clean · reactions suite 14/14 · full `next build` + web `tsc --noEmit` + lint
clean · migration applied after a ledger check · browser pass (like from a
card — fills and survives reload; `/me/likes` lists it; detail count seeds and
moves with toggles; Save/Unsave from the detail and the ⋮ menu; `/me/saved`
add/drop; signed-out real-heart click bounces to `/en/login` with the toast;
signed-out **mock**-heart click is inert (the UUID guard, by design); live
row-drop).

## Checks performed (orchestrator)

- **Route registration:** every new route is 3-segment with literals distinct
  from all existing `:id/...` routes on `listings` and `users` — registration
  order cannot shadow them.
- **Idempotency:** `POST` rides `onConflictDoNothing` on the unique pair;
  `DELETE` never 404s; the only 404 is a missing listing row on POST —
  mirroring `findById`, which serves any status. Unit tests lock each branch,
  and compiled-SQL tests pin the list filters.
- **FK semantics:** both FKs CASCADE (user and listing), honoring
  `AccountPurgeService` exactly as `user_follows` does.
- **Provider state machine:** seeded once, remounted per viewer (F2);
  optimistic flip + rollback; per-kind pending; `toggledOff` invariant =
  `!membership` for session-touched edges only; UUID guard short-circuits mock
  ids first.
- **Lists:** exact totals + id tie-break, `status != 'deleted'` (pinned by
  compiled SQL), batched photo hydration (three queries per page), dedupe
  across "Load more", error state distinct from empty.

## Follow-up tickets (small, non-blocking)

1. **Like/save notifications for the seller** — deliberately excluded; the
   follow feature's `follow.created` is the shape it would take.
2. **Mock-card hearts could be removed outright** — currently inert by guard;
   a design decision for the demo surface.
3. **Cross-tab reaction sync** — accepted limitation; lists refresh on
   navigation/reload.
4. **Pending-guard hardening (F3)** — a `useRef` in-flight set if a
   same-tick double-fire is ever observed.
5. **Zero-photo listing detail (F5)** — a design decision for where the like
   control lives when there is no gallery.
6. **Id-set read scale (F6)** — filter/cap the per-page `GET /users/me/reactions`
   if account histories grow large.

## What this review did not cover

- Nothing pending from the reviewer: its closing section arrived and is folded
  into the provenance note above (contract-change recording confirmed; the one
  stale line it found in `changes.md` is fixed).
- The in-tab login/account-switch flow as a browser test (fix F2 is the
  standard remount idiom, verified by construction + type gates).
- Anything outside the diff: the concurrent session's other changes and the
  `apps/mobile` deps are flagged separately in `test-results.md` and the task
  log.
