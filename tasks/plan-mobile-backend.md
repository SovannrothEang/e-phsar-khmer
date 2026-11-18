# Mobile ↔ Backend Integration — Staged Plan

**Date:** 2026-11-01
**Status:** Approved (captain, 2026-11-01). Steps 1–11 implemented; device smoke pending.
**Scope:** `apps/mobile` (Expo SDK 54, `phsarkhmer`) wired to the existing NestJS backend, one vertical
slice at a time.

## Context

`apps/mobile` is still a mock prototype: every screen reads `constants/data/*`, `AuthContext` is
state-only with a hardcoded `DEFAULT_USER`, and there is no HTTP client, API base URL, token storage
or real session. `apps/backend` and `apps/web` are real and cover the whole marketplace. The goal is
to wire the mobile app to the existing API one vertical slice at a time, keeping the existing screens
while replacing their data sources.

The captain's rule shapes the scope: **do not build a mobile feature the web client does not already
have.** Edit post is the example — the backend has `PATCH /listings/:id`, but web has no edit UI, so
mobile must not build one. Each step below is a self-contained slice with its own viewer/user
boundary and its own exit check, so nothing is mixed together.

## Decisions taken (2026-11-01)

- **Login matches web:** a phone-shaped identifier runs password check → SMS OTP → sign-in; a
  username uses `POST /auth/login`. A new OTP screen is required.
- **Two Expo modules allowed:** `expo-secure-store` (token persistence) and `expo-image-picker`
  (ad photos).
- **Mobile-only screens are hidden, not deleted:** edit post, scan/QR, forgot-password and the demo
  social sign-in keep their files but lose every entry point while this plan runs.

## Scope contract

1. **Parity gate.** A mobile screen/action is wired only when the equivalent web surface exists and
   is backed by an existing endpoint. When web has no working feature, mobile does not build one.
2. **No backend API changes.** Every endpoint below already exists and is used by web. If a genuine
   mobile blocker appears mid-run, stop and raise it instead of adding an endpoint.
3. **Reuse the existing mobile UI.** Replace data sources and gate blocks; do not redesign screens
   (captain's reuse rule). Mock files are deleted only when nothing imports them.
4. **One step = one shippable slice.** Each step ends with a usable app, a type-check + lint gate and
   a manual device check.

## Viewer vs signed-in user

| Capability                                                     | Viewer (no token)           | Signed-in user                    | Endpoints                                                                                                                                            |
| -------------------------------------------------------------- | --------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home categories, latest feed, trending, banners                | yes                         | yes                               | `GET /categories`, `GET /listings`, `GET /listings/trending`, `GET /advertisements?placement=home`                                                   |
| Browse category → subcategory, brands, models, attribute sets  | yes                         | yes                               | `GET /categories/:slug`, `GET /brands?subcategory=`, `GET /brands/:id/models?subcategory=`, `GET /attributes?subcategoryId=`                         |
| Feed filters (price, condition, year, location, attrs, search) | yes                         | yes                               | `GET /listings?…`                                                                                                                                    |
| Listing detail, contact seller, share                          | yes                         | yes                               | `GET /listings/:id`                                                                                                                                  |
| Public seller profile + their active ads                       | yes                         | yes                               | `GET /users/by-username/:username`, `GET /listings?userId=`                                                                                          |
| Follower / following lists                                     | no                          | yes                               | `GET /users/:id/followers`, `GET /users/:id/following`                                                                                               |
| Product spec page                                              | web only (no mobile screen) | web only                          | `GET /products/:brandSlug/:modelSlug`                                                                                                                |
| Report reasons                                                 | yes                         | yes                               | `GET /reports/reasons?targetType=`                                                                                                                   |
| Like / save / report submit / follow                           | no                          | yes                               | `POST/DELETE /listings/:id/like`, `POST/DELETE /listings/:id/save`, `POST /reports/listings`, `POST /reports/users`, `POST/DELETE /users/:id/follow` |
| Chat                                                           | no                          | yes (deferred — see out of scope) | `GET/POST /chats…`                                                                                                                                   |
| Notifications                                                  | no                          | yes                               | `GET/PATCH/DELETE /notifications…`                                                                                                                   |
| Post ad, manage ads                                            | no                          | yes                               | `POST /listings`, `POST /listings/:id/publish`, `GET /listings/me/all`, `DELETE /listings/:id`                                                       |
| My likes / saves, my profile, settings                         | no                          | yes                               | `GET /users/me/likes`, `GET /users/me/saves`, `GET/PATCH /users/me`                                                                                  |
| Subscriptions / checkout                                       | no                          | yes (web only — deferred)         | `GET /subscriptions/me`, `POST /subscriptions/checkout`                                                                                              |

> **Superseded 2026-11-10:** the Product spec page is no longer web-only — the mobile listing
> detail links the published spec at `/spec/<brandSlug>/<modelSlug>` (see `ARCHITECTURE.md`).

Everything in the lower half is gated by `isAuthenticated` today in the tab layout; the Account tab
is the one open surface and already shows a sign-in CTA.

## Steps

The order is deliberate: the listing detail works before any feed renders real cards, and the
category screens work before the home page links to them, so no step leaves real data opening a mock
dead end.

### Step 1 — API foundation (no visible change) — code done, device probe pending

- `lib/api/config.ts`: `EXPO_PUBLIC_API_URL` wins; otherwise a dev build derives the backend host
  from Metro's own `Constants.expoConfig.hostUri` (`http://<same-host>:3000/api/v1`), so Expo Go on
  a phone reaches the machine without a per-device env. The env value is inlined at bundle time.
- `lib/api/client.ts`: `apiFetch<T>()` — JSON headers, `Accept-Language` from `LanguageContext`
  (`ko` falls back to `en`; `zh` passes through because the backend stores `en|km|zh`), Bearer
  injection, device headers on authenticated calls, unwrap `{success,data,meta}`, map
  `{success:false,error}` to a typed error, and one transparent refresh on 401
  (`POST /auth/refresh`) then retry; a failed refresh clears the session.
- `lib/auth/token-store.ts`: `expo-secure-store` wrapper for `accessToken`, `refreshToken` and a
  persisted device id (kept across logout). SecureStore has no web implementation, so a
  `Platform.OS === "web"` branch falls back to memory (Expo Go on a phone is the real target).
- `lib/api/device.ts`: `x-device-id` (must match `^[A-Za-z0-9._:-]{8,128}$`), `x-device-name`,
  `x-device-info` (`{type:'app', model, osName, osVersion, clientVersion}`, URL-encoded).
  `hooks/useDeviceInfo.ts` only returns display fields, so this is its own builder.
- Raise React Query defaults: `queries.retry: 1` only — mutations must never auto-retry, or a lost
  response on `POST /listings` creates a second draft. Add a dev-only API probe.

**Exit:** app boots; the probe reaches `GET /categories` on the target device; the token store
round-trips a value through SecureStore. (Session restore is Step 2 — there is no token yet.)

### Step 2 — Session & auth (viewer ↔ user) — code done, device flow pending

- Rewrite `AuthContext` to a real session: restore from secure store on boot, `GET /auth/me`,
  `isLoading`/`isAuthenticated`/`user`, login, register, logout; expose a `requireAuth` helper.
  Keep the exported `UserProfile` shape and adapt the backend user into it, so the existing
  consumers keep compiling without being rewritten in this step: `(tabs)/account.tsx` (and its
  in-app login modal), `(auth)/sign-in.tsx`, `(auth)/sign-up.tsx`, `(auth)/settings.tsx`.
- Normalize every phone input to E.164 (`^\+?[1-9]\d{6,14}$`) before calling the API — the screens
  take free text today, and `/auth/register`, `/auth/otp/*` and the phone endpoints reject anything
  else.
- Sign-in screen: phone-shaped identifier → `POST /auth/otp/login` (password ≥ 8) → new
  `(auth)/otp.tsx` → `POST /auth/otp/verify` with `{phone, token, password}` — the password is sent
  again, not just the token; username → `POST /auth/login` (password ≥ 6). Both store tokens + device
  headers.
- Sign-up screen: `POST /auth/register` then OTP verify with password + first/last name (split the
  current full-name field); remove the client-side 4-character mock rule.
- Logout: `POST /auth/logout`, clear secure store, return to the signed-out shell.
- Hide the Forgot Password link and every demo `SocialAuthSection` usage (sign-in, sign-up, welcome,
  the account modal), per decision.

**Exit:** register → OTP → signed in; sign out; app restart restores the session; wrong password and
expired OTP show real errors; the five existing `AuthContext` consumers still compile.

### Step 3 — Listing detail (viewer) — code done, device render pending

- `product/[id]` from `GET /listings/:id`: gallery, title, price with discount/original, specs grid
  from stored attributes (English values; `nameKm` on `/km` where available), seller card, contact
  actions (call + email via `Linking`), share sheet, and the expired notice for lapsed ads. Web's
  seller card offers `tel:` and `mailto:` only, and `listings` has no Telegram column, so SMS and
  Telegram are dropped.
- Wire `GET /users/:id/follow` for the follow state later (Step 7); for now the detail is read-only.
- **Remove the Edit entry points** (top bar, title row, seller tools), **Mark as Sold** and **Bump
  Ad** — web has no sold status, and renew lives only in Manage Ads (parity gate).
- **Remove the "Chat Now" button** — chat is deferred; the route itself is gated in Step 11.
- Report button stays but requires a session (anonymous → sign-in), matching web.

**Exit:** a known listing UUID and a feed row both open the real ad; contact actions open the phone /
email app; no Edit, Sold, Bump or Chat control is reachable.

### Step 4 — Catalog browse + filters (viewer) — code done, device render pending

- Category page: subcategories from `GET /categories/:slug`.
- Subcategory page: brands from `GET /brands?subcategory=<slug>`, models from
  `GET /brands/:id/models?subcategory=<slug>`, attribute sets/type picker from
  `GET /attributes?subcategoryId=<uuid>`, feed from `GET /listings` with the same URL vocabulary the
  web uses (`categorySlug`, `subcategorySlug`, `brand`, `bodyType`, `attrKey`/`attrValue`, `attrs`,
  `minPrice`/`maxPrice`, `condition`, `sort`, `postedWithin`, `provinceSlug`/`districtSlug`).
- Filters screen: replace the hardcoded sort/condition/storage/property lists with the subcategory's
  schema `select` fields and the real province/district/commune cascade
  (`GET /locations/provinces/...`).
- Preserve the existing brand/type drill-down routes and map a tile click onto the same feed params.

**Exit:** a viewer can browse all 12 categories → subcategories → brand/type, every filter changes the
result set, and every card opens the real detail from Step 3.

### Step 5 — Home (viewer) — code done, device render pending

- Categories from `GET /categories`; keep local images keyed by slug with a neutral fallback icon.
- Latest feed from `GET /listings?limit=`; Trending from `GET /listings/trending`; banner from
  `GET /advertisements?placement=home`.
- Keep the `LatestAds` layout and feed it real rows; `NearbySection` (static map placeholder) and
  `PromoCard` (static "post your ad" CTA) have no web data source and stay as they are.
- The home grid currently uses mock ids (`car-and-vehicles`); switch every route to the backend slug
  (`cars-and-vehicles`).
- Verify the duplicate `/` mapping the router manifest reports (`app/index.tsx` redirects to
  `/(tabs)`, and `(tabs)/index` also resolves to `/`) on a device before wiring the home screen.

**Exit:** home renders real categories, trending and live ads for a signed-out user; a category tap
lands on the real Step-4 page and a feed card opens the real Step-3 detail.

### Step 6 — Search (viewer) — code done, device render pending

- `GET /categories` chips + `GET /listings?q=` with debounce and pagination; keep the existing search
  screen and its list/grid modes.
- The web's product-spec matches (`GET /products?q=`) have no mobile search screen — leave them out. The single spec page now has a mobile screen at `/spec/<brand>/<model>` (2026-11-10).

**Exit:** a keyword returns real rows and opens the real detail.

### Step 7 — Reactions, follow, report (user) — code done, device render pending

- Load `GET /users/me/reactions` once per session into a `ReactionsProvider`; like/save toggles call
  `POST/DELETE /listings/:id/like` and `POST/DELETE /listings/:id/save` optimistically and roll back
  on error; hearts on cards and detail read the same provider. Show `likeCount` from the detail.
- Seller profile `(categories)/user/[id]` → `GET /users/by-username/:username` plus the seller's ads
  (`GET /listings?userId=`), follow/unfollow (`POST/DELETE /users/:id/follow`), follow counts, and
  the follower/following lists (`GET /users/:id/followers`, `GET /users/:id/following`). The profile
  header and ads are viewable anonymously; the lists are user-only (web gates them at the profile
  layout), so anonymous taps route to sign-in.
- Report screen: `GET /reports/reasons?targetType=listing|user`, `POST /reports/listings`,
  `POST /reports/users`; evidence uploads may be deferred (the API keeps them optional).
- Blocks are not enforced by reports (`reports.service.ts` has no block check) — they gate chat
  sends, which are deferred, so this step does no block handling.

**Exit:** taps persist across reload; anonymous taps route to sign-in.

### Step 8 — Notifications (user) — code done, device render pending

- Replace the mock `NotificationContext` with `GET /notifications` (offset pagination),
  `GET /notifications/unread-count`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`,
  `DELETE /notifications/:id`, `DELETE /notifications`.
- Badge reads the real unread count; refresh on tab focus and after actions (no push channel exists).

**Exit:** a new follow/listing notification appears with a real badge; read and delete persist.

### Step 9 — Sell / post ad (user) — code done, device flow pending

Split into five sub-slices so the biggest surface is not mixed with the rest. Two prerequisites come
from the web form and must be part of 9a:

- `GET /subscriptions/entitlements?subcategoryId=<uuid>` — the effective photo cap is
  `min(schema photos.max, plan.limits.photos)`, and the ads allowance is pre-checked before create.
- `GET /products?family=<family>&limit=200` — the required `productSpec` picker for the five families
  that declare it (`cars-for-sale`, `motorcycles-for-sale`, `phones`, `tablets`, `smart-watches`).

Sub-slices (web's form is 1,607 lines; keep each slice reviewable):

- **9a Schema gating + common blocks.** Read the schema from
  `GET /categories/:slug/subcategories/:subSlug` — it returns `field_schema` plus the category and
  subcategory **UUIDs** that `POST /listings` needs. Render title, price/discount, description, the
  three-level location cascade, address and the contact trio, each gated on its schema key exactly
  like `ListingPostForm`. The contact trio starts empty (web prefills from the profile). No map
  pin: mobile has no map picker, so `latitude`/`longitude` are omitted and the detail page's map
  stays inert for ads created here.
- **9b Pickers and option resolution.** Every starred picker web enforces must exist: brand, model
  (options from `GET /brands/:id/models?subcategory=<slug>`, disabled until a brand is chosen),
  year, condition, color, taxType, vehicleType, type, accessory, network, jobType, experience,
  screenSize, storage (required only on laptops/desktops/all-in-one), ram, cpu, vga. Options resolve
  by web's rules: `PICKER_ATTR_TYPES`, the managed/global `forSub` rule, the three-source
  `vehicleKinds` rule, generated `years`, and the `CONDITION_SLOT` / `STORAGE_REQUIRED` /
  `TYPE_OPTIONAL` exceptions.
- **9c Per-family blocks.** Jobs (jobType + experience + the `company` block at the top of Contact,
  posted top-level), vehicles (engine/body/transmission/tax), and the required `productSpec` picker
  on the five families.
- **9d Photos.** `expo-image-picker` → `POST /files/sign` (scope `listing`) → PUT to the signed URL →
  `{url,path,sort}` in the payload; enforce `min(schema photos.max, entitlement photos)`. The bucket
  takes only JPEG/PNG/WebP ≤ 5 MB and there is no server-side check, so re-encode iOS HEIC to JPEG,
  set the PUT `Content-Type`, and add the picker's config plugin with the photo-permission strings.
- **9e Create + publish.** Mint an `Idempotency-Key` (UUID) per create attempt and reuse it on a
  manual retry; `POST /listings` (draft) then `POST /listings/:id/publish`; on a publish refusal
  delete the draft (web's rollback), and surface plan-allowance errors verbatim. The mutation is
  never auto-retried.

**Exit:** a new ad is visible in the public feed and in Manage Ads; over-limit publish shows the
backend message and never leaves an orphan draft.

### Step 10 — Account surfaces (user) — code done, device flow pending

Two sub-slices: wiring rows the account screen already renders, then the list screens it does not
have yet (web has them, so this is UI work, not a new feature).

- **10a Existing rows.** Profile header: `GET /users/me` (the follower/like/save counts come from
  Step 7's `GET /users/me/follow-counts` and reactions read). Settings: edit profile
  `PATCH /users/me`, avatar `POST /users/me/avatar` and cover `POST /users/me/cover` (both
  multipart, field `file`, ≤ 5 MB), username `PATCH /users/me/username`, password
  `PATCH /users/me/password`, privacy flags `PATCH /users/me`, devices `GET /auth/devices` +
  revoke, delete account `DELETE /users/me` (body `{password}`; soft delete with a 90-day purge
  window). Hide every row this slice does not
  wire: linked accounts (Google/Facebook/Telegram/Apple — deferred native OAuth), Passkeys (web
  stub), Billing Address, Membership Information, Subscription, Resume (CV) and Insights.
- **10b New list screens.** Manage Ads (`GET /listings/me/all` — offset pagination with the
  `status` filter over `draft | active | expired | deleted | restricted`, including the
  Hidden/`restricted` tab; renew `POST /listings/:id/publish`, delete `DELETE /listings/:id`),
  likes/saves (`GET /users/me/likes` and `GET /users/me/saves`, offset `page`/`pageSize`, not
  cursor), and the phone-change OTP flow (`POST /users/me/phones/otp` + verify). Each replaces an
  Alert placeholder with a real screen.

**Exit:** every account entry shows real data; a deleted ad disappears from the feed and the list.

### Step 11 — Cleanup + verification — code done, device smoke pending

- Hide the Chat tab (deferred E2E work) **and gate the `/chat` route itself** — Step 3 removes the
  detail page's Chat button, and a direct visit must redirect home so the mock inbox cannot be
  reached. Hide the Subscription menu item (deferred checkout).
- Delete the mock modules that nothing imports any more (`constants/data/*`, unused demo profiles).
- Hide remaining unreachable entries; confirm no route reaches edit-post/scan/forgot-password.
- Update `apps/mobile/README.md`, this plan, `tasks/todo.md`, and CLAUDE.md's mobile "mock prototype"
  known gap.
- Run the gates and the device smoke matrix (viewer/user).

## Explicitly out of scope

- **Edit post** — web has no edit UI (backend `PATCH /listings/:id` exists but is unused by web).
- **Forgot password / password reset** — the web page is a stub with no backend flow.
- **Scan / QR** — no web counterpart.
- **Social sign-in and linked accounts** — only a demo on mobile; native OAuth would need a backend
  redirect allow-list change, so it waits for a separate decision. Apple has no backend provider.
- **Chat** — was deferred here and implemented separately on 2026-11-01: v2 multi-device E2E text
  with REST polling (see `lib/e2e/`). Encrypted attachments, history backup/restore and the
  WebSocket remain out of scope.
- **Subscriptions / checkout** — mobile has only a placeholder entry; deferred, entry hidden.
- **Resume, Insights, job applications, billing addresses, admin and product-spec pages** —
  deferred. Mobile has placeholder rows or screens for some of them; Step 10 hides those entries
  rather than wiring them. Product-spec pages shipped separately on 2026-11-10 at
  `/spec/<brand>/<model>`; the rest stay deferred.
- **Push notifications** — no FCM/APNs backend exists.

## Backend / environment notes

- No migration, no endpoint, no DTO change is planned.
- Dev needs the backend on `:3000`, Postgres, and `DEV_OTP_TOKEN=000000` for OTP testing; the backend
  must be restarted after changing that token. Auth routes are throttled 5/min (SMS) and 10/min
  (credentials), so repeated manual OTP tests will 429 — space them out.
- Dev HTTP is cleartext over the LAN: fine for dev-OTP test accounts, not for real passwords. The
  OTP screen holds the password in memory only — never persist or log it.
- Uploads: the storage bucket accepts `image/jpeg|png|webp` ≤ 5 MB and `/files/sign` does no
  server-side MIME/size check, so the client must enforce both (HEIC is rejected).
- Device headers are what make the existing per-device session revocation work — send them on login,
  OTP verify, refresh and authenticated calls (`/auth/devices` uses them for `isCurrent`).

## Verification

Per step: `pnpm --filter phsarkhmer exec tsc --noEmit` and `pnpm --filter phsarkhmer lint` (the app
has no test framework). Manual device checks with Expo Go: viewer flows signed out, user flows on a
real dev-OTP account, and a created listing visible in both the mobile feed and the web `/me`.

## Deliverables

- This document is the repo copy of the approved plan; `tasks/todo.md` carries the step checklist.
- Each step is implemented and verified before the next one starts; nothing is committed without the
  captain's word.

## Follow-ups for the captain

- `expo-secure-store` is installed; `expo-image-picker` is added at Step 9d.
- Decide later whether native social OAuth (Google/Facebook) is wanted; it needs a backend change.
