# Changes — Likes & Saved (make the like button and save work)

## Summary

Likes and Saved are real end-to-end. A new backend `reactions` domain owns two
edge tables (`listing_likes`, `listing_saves`) with toggles, list reads, and
one batched id-set read; the web seeds every card's state server-side in the
user layout, toggles optimistically through a shared client provider, and the
`/me/likes` + `/me/saved` pages list the real listings with their existing
empty states kept.

## Files modified / created

| File                                                                  | Change                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/backend/src/db/schema/reactions.schema.ts`                      | **NEW** — `listing_likes` + `listing_saves` edge tables, mirroring `user_follows` (unique pair index, reverse listing index, both FKs cascade). No self-check: liking your own listing is allowed.                                                                                                                                                                                                               |
| `apps/backend/src/db/schema/index.ts`                                 | +1 export line.                                                                                                                                                                                                                                                                                                                                                                                                  |
| `apps/backend/src/reactions/reactions.module.ts`                      | **NEW** — registers both controllers, exports the service.                                                                                                                                                                                                                                                                                                                                                       |
| `apps/backend/src/reactions/reactions.service.ts`                     | **NEW** — `likeListing`/`unlikeListing`/`saveListing`/`unsaveListing` (idempotent both ways; 404 on the POST side only; DELETE is fully idempotent, even for a hard-deleted listing), `countLikes`, `getReactionIds`, `listLikedListings`/`listSavedListings` (offset pagination, `status != 'deleted'`, newest edge first with an id tie-break, photos batch-loaded into the feed's `ListingWithPhotos` shape). |
| `apps/backend/src/reactions/listing-reactions.controller.ts`          | **NEW** — `POST\|DELETE /listings/:listingId/like\|save`.                                                                                                                                                                                                                                                                                                                                                        |
| `apps/backend/src/reactions/me-reactions.controller.ts`               | **NEW** — `GET /users/me/likes\|saves\|reactions`.                                                                                                                                                                                                                                                                                                                                                               |
| `apps/backend/src/reactions/dto/list-reactions.dto.ts`                | **NEW** — page/pageSize, mirrors `ListFollowsDto`.                                                                                                                                                                                                                                                                                                                                                               |
| `apps/backend/src/reactions/reactions.service.spec.ts`                | **NEW** — 12 tests: 404s, idempotent insert shape, delete-without-error, id sets, pagination meta, photo hydration.                                                                                                                                                                                                                                                                                              |
| `apps/backend/src/app.module.ts`                                      | +ReactionsModule import/registration.                                                                                                                                                                                                                                                                                                                                                                            |
| `apps/backend/src/listings/listings.module.ts`                        | imports ReactionsModule (no cycle — reactions never imports listings as a module).                                                                                                                                                                                                                                                                                                                               |
| `apps/backend/src/listings/listings.service.ts`                       | injects `ReactionsService`; `ListingWithPhotos.likeCount?`; `findById` resolves the count in its existing `Promise.all`.                                                                                                                                                                                                                                                                                         |
| `apps/backend/src/listings/listings.service.spec.ts`                  | `makeService` gains the third constructor arg (mock `countLikes`).                                                                                                                                                                                                                                                                                                                                               |
| `apps/backend/drizzle/migrations/0028_acoustic_chat.sql` (+ meta)     | **GENERATED** — creates only the two tables, their FKs, and the four indexes. Applied to the dev DB.                                                                                                                                                                                                                                                                                                             |
| `apps/web/components/reactions/reactions-provider.tsx`                | **NEW** — the shared reaction state: server-seeded sets, optimistic toggles with rollback + toast, per-listing pending (either kind disables), sign-in bounce, `likeCount(id, fallback)` overrides from toggle responses.                                                                                                                                                                                        |
| `apps/web/lib/api/reactions.ts`                                       | **NEW** — server-only `getMyReactionIds()` (fail-soft to empty) + `getMyReactionPage(side, page)` (rows adapted with the existing `toCardPost`).                                                                                                                                                                                                                                                                 |
| `apps/web/actions/reactions.ts`                                       | **NEW** — `likeListing`/`unlikeListing`/`saveListing`/`unsaveListing` + `loadMyReactionPage`, the `{success, error?}` house shape.                                                                                                                                                                                                                                                                               |
| `apps/web/app/[locale]/(user)/layout.tsx`                             | one batched reaction-id read for signed-in viewers; wraps children in the provider. Anonymous visitors make no extra call.                                                                                                                                                                                                                                                                                       |
| `apps/web/components/ads/GridCardPost.tsx`                            | heart is the real toggle (fill state from the provider, disabled while pending); the fake toast is gone.                                                                                                                                                                                                                                                                                                         |
| `apps/web/components/ads/ListCardPost.tsx`                            | heart + ⋮ Save are real toggles.                                                                                                                                                                                                                                                                                                                                                                                 |
| `apps/web/components/Card/ThreeDotPost.tsx`                           | ⋮ Save/Unsave is a real toggle (menu stays open — the existing `onSelect` preventDefault).                                                                                                                                                                                                                                                                                                                       |
| `apps/web/components/post/ThreeButton.tsx`                            | the detail row's Save button gets a handler it never had; label flips Save/Unsave.                                                                                                                                                                                                                                                                                                                               |
| `apps/web/components/post/PostImage.tsx`                              | the dead "0 Likes" control is live: real count (seeded from the listing, updated by toggle responses) + like toggle; the count===2 branch's duplicate markup now shares one `likesButton`.                                                                                                                                                                                                                       |
| `apps/web/components/post/Post-Detail.tsx`                            | `toPostView` carries `likeCount` into the template.                                                                                                                                                                                                                                                                                                                                                              |
| `apps/web/lib/posts.ts`, `apps/web/lib/api/categories.ts`             | `Post.likeCount?` / `BackendListing.likeCount?` — optional; feed rows do not carry it.                                                                                                                                                                                                                                                                                                                           |
| `apps/web/components/profile/reaction-ads-panel.tsx`                  | **NEW** — the liked/saved list: loading / error / empty / grid + "Load more" via the action, deduping across pages.                                                                                                                                                                                                                                                                                              |
| `apps/web/components/profile/Liked-Ads.tsx`, `Saved-Ads.tsx`          | now thin wrappers over the shared panel; the "No Result!" empty design is kept exactly.                                                                                                                                                                                                                                                                                                                          |
| `apps/web/app/[locale]/(user)/me/likes/page.tsx`, `me/saved/page.tsx` | untouched — they still render the (now real) components.                                                                                                                                                                                                                                                                                                                                                         |

## Behavioral diff

| Behavior                    | Before                        | After                                                                                                   |
| --------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| Card heart                  | local `useState` + fake toast | real optimistic toggle; survives reload (server-seeded); visitor → toast + `/login`                     |
| ⋮ menu Save / list-row Save | local state + fake toast      | real toggle; ⚠ the mock Top Ads cards (numeric ids) now error-toast on click instead of fake-succeeding |
| Detail row Save             | **no handler at all**         | real toggle, Save/Unsave label                                                                          |
| Detail "0 Likes"            | dead display                  | live count + like toggle (count driven by toggle responses)                                             |
| `/me/likes`, `/me/saved`    | static "No Result!" only      | real listings grid (existing card), empty state kept, "Load more", error state distinct from empty      |
| Backend                     | no likes/saves code           | two edge tables + 7 routes                                                                              |

## Notes / deviations from spec

- **Authored by the orchestrator.** In this environment spawned agents are
  read-only (established in prior ships), so stage mutations were performed on
  the main thread per `.pipeline/spec.md`. The planner subagent was dispatched
  with the brief; no report was received by write-up time, and nothing here
  leans on one.
- **The `/me` panels fetch client-side through the action** (mirroring
  `FollowListPanel`'s loading/error/empty discipline) rather than a
  server-fetched first page. The pages themselves are untouched; the trade is
  a brief "Loading…" instead of a server-rendered first screen.
- `isPending` is per listing (either kind in flight disables both controls) —
  which is what surfaced as a driver timing artifact during verification (see
  test-results.md; the product behavior is correct, the first driver clicked a
  disabled button).
- Route-collision review: all new routes are 3-segment with literals distinct
  from every existing `:id/...` route, so registration order cannot shadow
  them.
- The migration's ledger watermark was checked before `db:migrate` (the
  2026-09-28 repair): newest applied row is above 0027's `when`, and only
  0028 was pending.

## Not done (per spec non-goals)

- No notification to the seller on like/save (candidate follow-up; the
  follow-feature `follow.created` is the shape it would take).
- No admin-dashboard surfaces for likes/saves.
- No counts anywhere except the detail control.

## Late adjustment (during review)

- **Feed parity for `sellerUsername`.** A concurrent session added the
  seller's handle to the feed's listing rows; the `/users/me/likes` and
  `/users/me/saves` queries now resolve it with the same `leftJoin(users, …)`
  so the cards rendered on those pages carry the same handle the feed's cards
  do (the lists' own contract: "the same shape the public feed serves").
  Live-verified against the running backend (`sellerUsername: "testtest001"`
  on a liked row). Includes the spec's mock-chain stub gaining `leftJoin`.
- **Review-fix pass (planner report, four findings).** (1) Non-UUID (mock) ids
  are inert in the provider — clicking a demo heart no longer fires a request
  or error-toasts on the home page. (2) A row toggled off drops out of the
  `/me` lists live (`isToggledOff`, keyed `kind:id` — deliberately not a
  membership filter, which would blank the lists whenever the fail-soft seed
  returned empty). (3) The DELETE side no longer 404s on a missing listing;
  `POST` keeps the existence check (the spec's API table said "both verbs" —
  the toggle-end-state idiom and `unfollowUser` say DELETE should not;
  implemented per the idiom and noted here as the deviation). (4)
  `@ApiTags('reactions')` + `@ApiBearerAuth()` on both controllers.
  `reactions.service.spec.ts` updated to lock the DELETE contract (no
  existence probe; a gone-listing unlike resolves).
- **Gate-infra fix (review blocker B2).** `apps/backend` now pins
  `jest-environment-node ^30.4.1` (devDependency + lock). Why:
  `testEnvironment: "node"` resolves the environment from the project root,
  where the workspace hoist held the 29.x line after the `apps/mobile` install
  — its `ModuleMocker` lacks `clearMocksOnScope`, so every suite failed to
  start. The pin resolves the 30.4.1 copy already in the store;
  `pnpm --filter backend test` is back to 32/32 suites, 371/371 tests (the
  reviewer's B1 — the concurrent session's spec mismatch — was fixed on that
  session's side).
- **Stage-4 deep pass (F2/F7 fixed; F3/F5/F6 ticketed).** `(user)/layout.tsx`
  now keys the provider on the viewer (`key={user?.username ?? "anon"}`), so
  an in-tab login or account switch reseeds instead of carrying the previous
  viewer's sets; the reactions spec gained compiled-SQL tests pinning the
  `status != 'deleted'` filter and the `(createdAt, id)` ordering for both
  list queries (now 14/14; full suite 32/32, 373/373). Follow-ups
  (pending-guard ref, zero-photo detail like control, id-set read scale) are
  listed in `review.md`.
