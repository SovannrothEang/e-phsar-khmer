# Changelog

All notable changes to this monorepo (`apps/backend`, `apps/web`, `apps/mobile`) are recorded here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The project has no
version tags yet, so releases are grouped by **ship date** (the commit dates on `main`/feature
branches) instead of version numbers.

How to use this file:

- New work goes under **Unreleased** while it is uncommitted or unmerged; move it under a dated
  heading when it ships.
- The detailed per-ship notes (verification steps, data repairs, open questions) still go in
  `tasks/todo.md`. Once an entry has shipped, fold its outcome into this file and drop it from
  the log. The full historical log up to 2026-10-24 is in git (`git show fd824a0:tasks/todo.md`).
- Migrations are named by their file prefix in `apps/backend/drizzle/migrations/`.
- Plans cited below that were deleted once shipped (`tasks/plan.md`, `tasks/spec.md`,
  `tasks/plan-e2e-phase1-2.md`, `tasks/plan-tenant-subscriptions.md`) can still be read with
  `git show 5783531:<path>`. Design references were moved to `docs/`.

## [Unreleased]

### Added

- **Trusted product specs (admin-managed, in-house).** A new `product_specs`
  table (migration `0044_rapid_skaar`; one row per `models` row, grouped
  label/value `spec_groups` JSONB, `is_published`) backs GSMArena-style spec
  pages written by staff — nothing is scraped and no external link is used.
  `GET /api/v1/products?q=&limit=` (public) powers product search and the
  phones post-form picker; `GET /api/v1/products/:brandSlug/:modelSlug`
  returns page one. `/api/v1/admin/products` is `@Roles('admin')` CRUD with
  `modelId` immutable and duplicates answered `409`. `listings` gains a
  nullable `product_model_id` (FK → `models`, `ON DELETE SET NULL`); create
  and update validate that the target spec is **published**, and
  `GET /listings/:id` embeds `product: { modelId, brandSlug, brandName,
modelSlug, modelName } | null`. The `phones` `field_schema` declares a
  required `productSpec` key: the post form's picker searches the published
  catalogue, resolves a pasted product URL (`/en/product/apple/iphone-16`),
  auto-fills Brand/Model when empty, and clears the link when either changes;
  submit refuses an empty picker. The listing detail shows "View full specs",
  the search page shows a Product specs section above the ad results, and
  `/product/[brand]/[model]` renders the grouped specs plus active ads for
  that model. Admin UI: `/wanderer/dashboard/products` (Attributes → Product
  Specs) with a dynamic group/row editor. No image upload in v1 — the model's
  existing image is used through `DbImage`.
- **Trending listings replace the mock home Top Ads.** `GET /api/v1/listings/trending`
  (`limit` ≤ 20, `windowDays` ≤ 30) ranks live listings by weighted engagement from
  `listing_events` (view 1, chat/call/show_contact 3, apply_job 5 — impressions are
  deliberately excluded) plus likes/saves at 2 each (owner self-reactions excluded),
  filters through the feed's `liveConditions()`, and fills the tail with the newest live
  ads. The home carousel is now `components/ads/TrendingAds.tsx` (label "Trending" /
  "កំពុងពេញនិយម"), driven by `getTrendingListings`; the 10 `TopPosts` mocks and the
  unused `HighLightAds` component were deleted. No migration — ranking reads the
  existing tables.
- **Superadmin-managed storefront banners.** `advertisements` (migration
  `0042_omniscient_cloak`) holds one row per banner: a `placement`
  (`home | all_ads | category | subcategory | listing_detail`), the Storage image
  path, an optional click-through, alt text, sort order and an active flag.
  `GET /api/v1/advertisements?placement=` is public and returns active banners
  only; `/api/v1/admin/advertisements` is super_admin-only CRUD. The dashboard
  page is `/wanderer/dashboard/advertisements` — hidden from regular admins the
  same way Team is — and uploads through the new staff-only `advertisement` sign
  scope. On the storefront the five hardcoded banner `<Image>` blocks are
  replaced by `components/ads/AdvertisementCarousel.tsx`: an embla carousel that
  rotates when a slot holds several banners, pauses on hover/focus, honours
  `prefers-reduced-motion`, and renders nothing when a slot is empty.
- **The storage bucket allows only `image/jpeg | image/png | image/webp`**
  (5 MB cap); `image/gif` is refused with `invalid_mime_type`. Animated WebP is
  allowed, so the old 2.1 MB animated `flag-animation.gif` was re-encoded as a
  381 KB / 25-frame WebP and keeps its animation. Allowing GIF would be a
  Supabase bucket-settings change, not a code change.
- **Expiry warnings for ads.** An hourly `ListingExpiryService` sweep (BullMQ
  `listing-expiry` queue) notifies an ad's owner through the existing
  notification feed at T-3 days (`listing.expiring`, "expires in N days") and
  once after the lapse (`listing.expired`, only for ads that expired in the
  last 24 h so a deploy never notifies every historical lapse). Each notice is
  deduped by `(listingId, expiresAt)` in `notifications.data`, so a renewal —
  which moves the date — earns a fresh warning. Manage Ads shows the same
  3-day warning as an "Expires in N days" chip on Active rows. No migration;
  the sweep only reads listings and writes notification rows.

### Changed

- **Admin catalogue tables rebuilt on a shared kit.** Models, Brands, Categories and
  Subcategories drop the raw-UUID ID column (Copy ID now sits in each row's menu), lead
  with a logo/initial + name cell, show category and sub-category chips and one formatted
  Updated date, and gain click-to-sort headers, whole-row search (name, slug, brand,
  category, sub category), category filters (plus brand on Models) and a shared
  pagination footer — `components/dashboard/admin-table.tsx` plus `admin-page.tsx`.
  `getAdminModels` now derives a model's category from its own subcategory rows instead of
  a brand's first link (the bug that listed phones under "Computers & Accessories"), and
  Brands lists every category a brand spans. The Models delete dialog no longer says
  "Delete Brand"; the Subcategories one no longer says "Delete Category".
- **Admin Users rebuilt on the same shared table.** Seven columns instead of ten (the ID moved
  into the row menu, the constant Role column dropped, Created/Updated collapsed into one
  Joined date), a round avatar + name + email cell, `@username`, click-to-sort headers,
  pagination at 20, and the All / Premium / Normal tabs kept. Two real fixes: the phone column
  no longer doubles the `+` (`++855…` → `+855…`), and the row menu's View no longer
  concatenates the username with the UUID — it opens the public profile at
  `/{locale}/{username}`.
- **Admin report queues rebuilt.** Report Users and Report Posts share one status badge, drop
  the report-UUID and reviewer-UUID columns, show the reviewer under the status, format the
  created date, clamp the description with the evidence thumbnails beneath it, and move the
  actions into the shared row menu (View profile/post, Approve, Reject, Copy ID). Fixes: the
  created column no longer prints a raw ISO string, the reviewer column shows the reviewer's
  name, and Report Users' View Profile opens `/{locale}/{username}` instead of concatenating
  the display name with the target's UUID.
- **Admin navbar: storefront-style language picker and a real notification queue.** The language
  trigger is now the current locale's flag with a flag radio list (`/flag/uk.png`,
  `/flag/khmer.png`), matching the storefront selector while keeping the admin cookie switch. The
  bell no longer shows hardcoded mock entries: it counts pending user/listing reports (same
  react-query keys as the queues) and opens a right-side drawer of report cards that link to the
  owning queue.
- **Admin sidebar logo no longer clips in the icon rail.** `SidebarHeader` drops to 7 px padding
  while the sidebar is collapsed (`group-data-[collapsible=icon]:p-[7px]`) and centres the mark,
  so the 32 px tile no longer overflows through the old 16 px padding; the expanded header is
  unchanged.
- **Collapsed admin sidebar groups now open a dropdown.** In the icon rail the sidebar primitive
  hides inline sub-lists, so Attributes, Manage Users, Subscriptions and Reports expanded into
  nothing; each now opens its children in a right-side menu from the icon, while the expanded
  sidebar keeps the inline collapsible.
- **Job applications: hiring is a conversation, not a row action.** Both `/me` job lists drop
  the application-status machinery — the poster's rows keep only View Resume + Message, the
  status pills (New/Viewed/Hired/Rejected) and both status filters are gone — because applying
  already opened the chat thread, which is where the recruiter/interviewer decides. The button
  label now reads "View Resume".
- **Body Types (and the other attribute pages) rebuilt on the shared admin table.** Six columns
  instead of ten — icon/initial + name (+ Khmer name), slug, category chip, sub-category chips,
  formatted updated date, row menu — with sorting, search and pagination from the kit. The
  add/edit dialog and the Years read-only mode are unchanged.
- **Team page rebuilt on the shared admin table.** Member (avatar + name + email), @username,
  phone, role badge (Super Admin/Admin), status, one Joined date and the standard row menu
  replace the raw-UUID ten-column table; sorting, search, tabs and pagination come from the kit.
- **Advertisements: admin page on the shared kit, storefront dots on the brand colour.** The
  admin table now has a 4:1 banner thumbnail with alt text and a Live/Hidden line, placement
  chips, a truncated link, order, the brand-blue active switch and the standard row menu, with
  search, sorting and pagination; the storefront carousel's active dot uses `#00a0e9` instead of
  white.
- **Admin dialogs cap at the viewport and scroll internally, with one button language.** Every
  `DialogContent` is now `max-h-[calc(100svh-2rem)]` with an internal scroll, and the footer is an
  in-flow bar at the end of the form sharing the dialog's surface — symmetric around its buttons,
  never overlapped by content — so a long form no longer stretches the dialog past the screen.
  Cancel buttons are the neutral outline (the red/blue fills across the Attributes, Users, Team
  and Feedback dialogs are gone) and primary actions use the theme blue.
- **Manage Ads: the ad list is split from the controls card and rows gain an
  actions menu.** The header, plan stats and Active/Expired tabs keep their own
  card; the ads (and the loading/empty states) render in a separate section
  below it. Each row's three-dot menu offers **View ad**, **Renew ad**
  (re-publish — 30 more days, one plan renewal, confirm dialog), **Share**
  (copy-link dialog) and **Delete ad** (soft-delete, confirm dialog), wired to
  the existing backend endpoints; a successful action reloads the tab and the
  plan summary. The page also renders through the existing `Me.manageAds`
  namespace (en/km) after reading as hardcoded English since the merge.
  Edit-listing ("no edit flow yet") and "mark as sold" (no such status) are
  deliberately absent.
- **Profile tabs render populated results as list rows.** Likes, Saved and
  Manage Ads moved from the 2–4 column card grid to full-width rows
  (thumbnail, title, location, price — plus a like/save toggle on Likes and
  Saved), matching the captain's reference. Empty tabs keep the centred
  "No Result!" card; the Jobs and Subscriptions tabs were already lists.
- **Listing detail's seller button reads "Chat"; the owner sees a note instead.**
  `Chat.messageSeller` (the default label of `ContactSellerButton`) is now
  "Chat" (km was already "ជជែក"), and the own-ad note on the seller card reads
  "This is your own ads - buyers will see 'Chat' here" (`Post.ownAdNote`; the
  km copy now quotes 'ជជែក'). Labels only — the chat flow is unchanged.
- **Typography scale trimmed: page titles 20px, section titles 16px.** The
  captain found the 2026-10-23 scale too large away from the landing page.
  `type-page-title` is now 20/600/28 and `type-section-title` 16/600/24 (base
  `h1`/`h2` follow); the homepage alone keeps the display sizes — 24/32 and
  20/28 — through a `home-type` context class on its wrapper. Ten page-title
  `h1`s that still hard-coded `text-2xl` (the subscription dashboard, listings,
  feedback and users-subscription pages, `/feedback`, `/settings`,
  `/me/membership`) now use the role class, so no non-home page title exceeds
  20px.
- **`super_admin` is now a governance tier, not a bigger admin tier.** The
  captain's rule: a superadmin manages the dashboard & stats, reports, team &
  roles, advertisements and feedback — nothing else. `RolesGuard` matches roles
  literally, so `@Roles('admin')` now **excludes** a `super_admin`; the
  catalogue, subcategories, brands, models, listings, attributes, subscription
  config, user-subscriptions and the admin payment route were narrowed to
  `@Roles('admin')`. `AdminController` (stats **and** users) and
  `ReportsController` still name both roles — the Team page is built on
  `/admin/users`, so that endpoint cannot be closed to super_admin without
  breaking team management (the staff-vs-user boundary there stays enforced by
  `assertCanManageUser`). The admin sidebar mirrors the split: each menu item
  declares a `roles` list, and the Subscriptions group is admin-only. A
  dedicated `superadmin` account was created for this tier; `admin` and `asdf1`
  remain plain admins.

- **Chat is encrypted-only for new messages.** `ChatService.sendMessage` rejects a payload
  with neither `e2eHeader` (v1) nor `e2e` (v2) (`Encrypted messages are required`), requires a
  body, and refuses the legacy public-bucket `imagePath`
  (`Unencrypted chat images are not accepted`). The public-image path (`SupabaseService`/`ConfigService` dependency, `bucket`
  getter, `assertOwnedChatImagePath`) is removed. Historical plaintext and image rows still
  read normally.
- **Web send path has no plaintext fallback.** Images and voice notes need
  `E2E_ATTACHMENTS_ENABLED` and a registered v2 device; otherwise the bubble fails visibly with
  `E2E_UNAVAILABLE`. `createOutboxEntry` (images + optional voice blob) replaces
  `createImageOutboxEntry` in `lib/e2e/attachments/send.ts`.
- **Chat thread redesign.** The workspace stays inside the normal app shell (the `(chat)`
  layout still mounts `NavBar`) and takes the viewport minus the navbar, as a dark two-pane
  panel. The thread pane gains quick replies above the composer and a compact pending-listing
  row with immediate send. The inbox column keeps its previous design ("Inbox" title, chevron
  collapse, 300/340px default width). Only its portaled menu and delete dialog pick up the
  panel's dark scope.

### Added

- **Encrypted rich content** (`lib/e2e/chat-content.ts`, marker `khmer24-chat-content` v1):
  shared locations and listing-only messages are sealed inside the ciphertext. New
  `location-card.tsx` (OSM link, no map tiles).
- **Voice notes**: MediaRecorder capture in the composer (60 s / 8 MB caps, MIME negotiation,
  tracks stopped on stop/unmount), sent as an encrypted `kind: "file"` with
  `purpose: "voice-note"` and `durationMs`. Inbox previews read "Voice note" / "Shared
  location" instead of the decrypted JSON.
- **Voice note controls** (`components/chat/voice-player.tsx`, shared by the received bubble and
  the composer preview):
  - play/pause, a draggable seek bar, elapsed/total time and a 1× / 1.5× / 2× speed toggle;
  - download on received notes;
  - only one note plays at a time;
  - a duration probe so MediaRecorder WebM files (which report `duration = Infinity`) can seek.

  Recording shows `0:12 / 1:00` against the cap and has a Cancel button that discards the take.
  New i18n keys `Chat.voice.*` and `Chat.composer.cancelRecording` in all six locales.

- **Location sharing** on an explicit click only (`enableHighAccuracy`, 10 s timeout), with a
  staged preview like images and voice.
- **"Last active …"** in the thread header from `ChatUserSummary.lastSeenAt`
  (`users.last_seen_at`, coarse — 5-minute activity throttle).
- **Browse More Filters: the mock's vehicle block, wired end to end.** On a vehicle
  subcategory the shared dialog now shows Brand, Model (disabled until a brand is picked),
  Year (minimum/maximum), Tax Type, Condition, Colour, Transmission, Engine Type and Body
  Type — each gated on that subcategory's own `field_schema` and sourced exactly like the
  grid/form (linked `bodytypes`, the managed/global `colors` rule, `enginetypes`, the
  generated `years`). Every field edits the same URL params the browse grids and the bar
  chips use, so a grid pick shows up in the dialog and counts on its badge, and a dialog
  pick updates the grids/chips. `GET /listings` gains four additive optional filters —
  `model`, `taxType`, `color`, `transmission` (display-name equality on `attributes`, values
  bound as parameters) — so the fields really filter. The header follows the mock (✕ left,
  centred title, Clear right), controls are h-11, and the segmented groups use the sampled
  mock colours (`#00a0e9` selected / `#707685` rest).

### Fixed

- **Editing an attribute with an empty Khmer name no longer 500s.** The admin web action sends
  `nameKm: null` for an empty field, and `AttributesService.update` called `.trim()` on it; update
  now mirrors create's null-safe trim (null clears the Khmer name). The same guard was added to
  the category/subcategory update paths, and a regression spec pins both cases.
- **Chat ignored the site theme.** The workspace forced the `dark` token scope on its panel
  (hardcoded `bg-[#1b1b1b]` / `border-white/10`, plus `dark` re-applied to the portaled delete
  menu and dialog), so `/chats` stayed dark in light mode. The panel now uses the normal theme
  tokens (`bg-card`, `border-border`, `bg-muted`) and follows the visitor's light/dark choice;
  the Suspense fallback matches.
- A thread opened via `?to=<peer>` before the conversation existed did not fill in when the
  first inbound message created it. `chat-workspace.tsx` now reconciles the cached
  `GET /chats/with/:userId` lookup against the inbox.
- **Accounts without an uploaded photo rendered a broken avatar.** The shared fallback pointed at
  `ui-avatars.com`, which now answers with `image/svg+xml`; Next's optimizer rejects SVG unless
  `dangerouslyAllowSVG` is set, so every no-photo avatar (navbar account menu, `/me` header,
  public profiles, follower lists, the listing seller card, settings) came back 400 and printed
  its alt text inside the circle. The new `components/common/UserAvatar.tsx` renders the photo
  through `DbImage` and falls back to a brand-blue initials circle instead — no third-party
  request, no broken `<img>`. The `ui-avatars.com` remotePattern is gone.
- **Browse filters gave no visible selection, and the header search ignored the category page.**
  Picking a brand (e.g. MG) hid the whole Brand grid and swapped in its models, so nothing showed
  which brand was applied except the breadcrumb. The pick now surfaces where the other applied
  filters do: the More Filters dialog's Brand select and its badge count it. The brand click
  itself stays a drill-in (grid steps aside, models appear) — like a body-type pick, not a
  toggle. The header search bar's scope chip now follows the page: a category or subcategory page
  reads that category ("Cars For Sale" / "រថយន្តសម្រាប់លក់") and a submit from there searches inside
  it (`/search?q=…&category=…&sub=…`), instead of always starting from "All Categories".

- **Expired listings vanished from browse while still reading as live.** Nothing flips
  `listings.status` when the 30-day window closes, so a lapsed ad dropped out of every feed
  (`liveConditions()`) but `GET /listings/:id` still served it with `status: "active"`, Manage Ads
  still counted it under Active (its Expired tab asked for a status no row ever has), and the
  detail page offered contact as if the offer were live. `findPublicById` now reports the derived
  `expired` status and 404s drafts and owner-deleted ads; `findMine` derives the same status and
  maps the Active/Expired filters to date ranges (`active` excludes lapsed rows, `expired` includes
  both stored-expired and lapsed-active ones); the web detail page shows an expired notice and
  disables contact/apply, and the Expired tab renders the ads with a badge. Unit tests pin the
  derivation and both filters.

- **Product Spec picker: a pasted link now explains itself.** The phones form's field advertised
  "search or paste a product link", but only a published PhsarKhmer product URL resolves; an
  external (GSMArena) link or a product page that is not published failed silently and the list
  just read "No match found". A URL-shaped paste that does not resolve now toasts "That link
  isn't a published PhsarKhmer product…", the placeholder names the source ("paste a PhsarKhmer
  product link"), and the focused field (not only the open panel's search box) accepts a
  keyboard paste.

- **A price of 0 can no longer be submitted.** The price field accepted `0` (`min={0}`, and
  submit only rejected `priceNum < 0`), so a real ad could be published at `$0`. The field now
  requires a value greater than 0 (`min={0.01}`, submit `<= 0`) with the message "Enter a price
  greater than 0". The fix applies to every subcategory that declares a price; existing ads keep
  their stored price until edited.

- **A zero/negative discount no longer renders as a discount.** `"0.00"` is a truthy string, so
  the card and detail mappings treated any non-null discount as real: a `-0%` / `$0 OFF` badge
  and a strikethrough price equal to the price. `toCardPost` and `toPostView` now require a
  positive discount value before setting `oldPrice` or the percentage label, and the form never
  sends a discount unless it is greater than 0.

- **Number fields no longer change on scroll.** Chrome edits a focused `type="number"` input on
  wheel, so scrolling the long post form with the cursor over the price/discount field silently
  walked `1` → `0` (the reported `$0` ads and the stray `0%` discount). The shared `TextInput`
  (number mode) and the discount input now blur on wheel, so the scroll moves the page instead
  of the value.

### Removed

- The no-op Archive menu item and the unused i18n keys `Chat.inbox.archive`,
  `Chat.thread.emptyTitle`, `Chat.thread.attachingListing` and `Chat.thread.sendingVoice` (all six
  locales).

### Docs

- `docs/admin-backoffice-audit-2026-10-24.md`: the admin vs super_admin backoffice audit
  (read-only, no code changes).
- `CHANGELOG.md` introduced. `tasks/todo.md` was reset to open items only, and its history
  rolled up here.

### Known issues

- The attachment daily quota sums the client's `declaredSize`; only the per-kind cap is
  re-checked against the stored object size.
- A v2 envelope's `wrappedKey`/`header` is stored verbatim, with nothing binding it to the device
  key it claims to target. No safety-number / key-substitution protection yet.

## 2026-10-23 — Security audit, moderation, reports, feedback

### Security

- **Admin escalation closed.** A plain admin could reset a super_admin's password, demote,
  suspend or delete one. Every admin user mutation now goes through `assertCanManageUser`
  (`admin/admin-user-policy.ts`): only super_admin manages staff accounts, nobody can
  delete/demote/suspend themselves, and the last active super_admin can't be removed (counted
  under a row lock). Stable error codes (`ONLY_SUPER_ADMIN_CAN_MANAGE_ADMINS`,
  `CANNOT_CHANGE_OWN_ROLE`, `LAST_SUPER_ADMIN`, …). This is Phase 1 of
  `docs/super-admin-todo.md`. The audit log, advertisement ads and workspace settings phases are
  not started.
- **Auth throttles per route**: login/verify/social/telegram 10/min; register, OTP request and
  OTP login 5/min (each sends a paid SMS); refresh 30/min. Telegram payloads are shape-checked.
  Login also matches the lowercased username.
- **Uploads**: user scopes sign into `{scope}/{userId}/`; catalog scopes are staff-only;
  `DELETE /files` is owner-only for non-staff with traversal rejected. Listing photos must be the
  owner's own uploads. Multipart uploads are capped at 5 MB and limited to raster types (SVG was
  accepted before, a stored-XSS risk).
- **Idempotency**: 422 for a different body on completed rows too, 5xx recorded as `failed`
  (not cached), and reclaim of failed/stale rows conditional on `lockedAt`.

### Added

- **Listing moderation** (migration `0040_moderation_feedback`): `GET /admin/listings`,
  `POST /admin/listings/:id/remove|restore`, and the `/wanderer/dashboard/listings` page. Approving
  a listing report removes the listing; approving a user report suspends the account.
- **User reports**: `GET /reports/reasons`, `POST /reports/listings|users`. The report dialogs on
  the storefront submit for real (they were mock).
- **Feedback**: `src/feedback/` (public multipart `POST /feedback`, admin list/delete), with the
  public form and admin page wired.

### Changed

- **Phones**: `addPhone` is transactional and syncs `users.primaryPhone`; `removePhone` promotes
  another phone and refuses to remove the last one.
- Listing create/update are transactional; dropped-photo cleanup touches only the owner's folder.
- Web `serverActions.bodySizeLimit` raised to 32 MB (avatars over 1 MB were rejected by Next).
- **Subscription review fixes** (`f074f5e`, per `docs/subscriptions-review-todo.md`):
  - `reconcileListings` only restores rows still `restricted` and only restricts rows still
    `active`, scoped to the owner, and counts from `RETURNING`.
  - Admin scope and free-plan edits enqueue one coalesced BullMQ job
    (`reconcile-on-config-change` via `EntitlementsScheduler`), replacing the fire-and-forget
    sweep.
  - A concurrent free-plan save returns an honest 409 instead of "Slug already in use".
  - `supersededReason` is typed end to end (`subscription-status.ts`).
  - Shared helpers: `toFreePlanSettings`, `groupBucket`, `describeBucket` and
    `use-admin-category-tree`.
  - User-facing fields renamed to `group*`.
  - New specs for scope/free-plan updates and revoke.
- **Outbox wakeup** (`7f3477c`, per `docs/outbox-wakeup-signal-spec.md`): the generic
  `Channel<T>` is replaced by a small `WakeupSignal`.
  - One process-level fallback timer makes one claim per interval, whatever the worker count.
  - A fallback claim that finds backlog wakes idle peers.
  - A worker stuck in a handler no longer stops polling.
  - Shutdown releases parked workers.
- **CI**: the deploy workflow deploys only the apps the push affects.

### Fixed

- Admin Report Users rendered storage paths as `<img src>`; it now receives `imageUrls`. Report
  Posts "View" opened post `0`; it now opens the real listing.

## 2026-10-14 → 2026-10-21 — Subscriptions and payments

### Added

- **Subscription entitlements** (`entitlements.service.ts`): photo, active-ad and renew limits
  enforced on create/update/publish with `PLAN_LIMIT_*` 403s. A lapsed plan restricts ads instead
  of deleting them (new `restricted` listing status, migration `0037`), with a 10-minute
  reconciliation sweep. `GET /subscriptions/entitlements`.
- **Subscription purchases + KHQR checkout** (migration `0035`), Manage Ads, and plan-aware
  subscription screens. Membership is folded into Subscriptions.
- **Per-group subscriptions (Khmer24 model)** (migrations `0038`, `0039`): one current
  subscription per (user, group); admin-ticked group scope
  (`PUT /admin/subscriptions/categories/:id/scope`); admin-configured free plan with per-category
  ad caps (`GET/PUT /admin/subscriptions/free-plan`); seed `db:seed:subscriptions`.
- **`PaymentReconciler`**: a 15-second Postgres sweep that activates settled-but-pending
  purchases, reconciles Bakong attempts, accepts late payments within 24 h, and expires
  webhook-only attempts. Runs once at boot.
- **Push notifications over the shared WebSocket** (`RealtimeNotificationChannel`); checkout
  settles on push instead of status polling.
- **ABA PayWay**: webhook-only settlement with a checkout `lifetime`
  (`ABA_PAYWAY_LIFETIME_MINUTES`); on a phone, checkout opens ABA Mobile via deeplink.
- Data-driven subscription filters in the admin.
- Together these deliver the goal of `tasks/plan-tenant-subscriptions.md`: self-serve paid plans
  through the payment module, with enforced limits and admin comp grants. They use a per-user
  model instead of the plan's tenant layer, which was dropped. The plan's order expiry was not
  built.

### Changed

- Upgrade checkout charges the target term prorated to the remaining time, minus unused-value
  credit. Purchases are final (no refunds).
- The ABA webhook moved into `PaymentModule` at `POST /api/v1/payments/webhooks/aba-payway`.
  The old `/api/v1/webhooks/aba-payway` path stays as an alias. **Set `ABA_PAYWAY_WEBHOOK_URL` in
  every environment.**
- Premium account pages follow Khmer24's layout. Web fonts are self-hosted.
- `payment_transactions.tenant_id` dropped (migration `0036`).

### Fixed

- ABA webhooks were all settled `ignored_unconfirmed`: `reconcile()` read `status` under `data`
  when the live API returns it as a sibling.
- The Bakong poll checked expiry before asking the provider, so a payment made at the deadline was
  lost.
- **Graceful shutdown** (`d465bdf`, 2026-10-17): `app.enableShutdownHooks()`. SIGTERM, which
  happens on every Vercel scale-down and redeploy, used to kill the process without running
  lifecycle hooks, so BullMQ workers never closed, Redis pub/sub connections never quit and the
  outbox shutdown grace never ran.
- Long-lived WebSocket sessions held stale state. Completed BullMQ jobs are now removed, and queue
  config is centralised.

## 2026-10-02 → 2026-10-06 — Social features, profiles, deployment

### Added

- **Likes & saves** (`src/reactions/`, migration `0034_acoustic_chat`): idempotent toggles,
  `/users/me/likes|saves|reactions`, and real `/me/likes` + `/me/saved` panels.
- **Follow / unfollow** (migration `0033_add_user_follows`): public profile by username,
  followers/following lists, and `follow.created` notifications. Followers and following swap in
  place on a profile.
- **A seller's post history on the public profile**, with a category strip modelled on the
  homepage tiles.
- **Expo mobile app** (`apps/mobile`).
- **Deployment**: backend Dockerfile, Vercel deploy, a CI deploy workflow with smoke tests, and a
  backoffice subdomain.
- super_admin docs (`docs/super-admin-*.md`).

### Changed

- Account menu items link to their pages. The card "…" menu rows are aligned, and View Profile
  goes to the real seller.
- The grid card heart is red, the list heart is bottom-aligned, and price rows line up across a
  row.
- The "Your Ad" badge was removed from the detail seller card.

### Fixed

- The seller card invented a handle from the contact name, so every profile link 404'd. It now
  shows the seller's actual profile.
- Chat no longer gets stuck on "Decrypting…", and the page reloads when E2E becomes unavailable.
- The backend Jest version skew is fixed workspace-wide (the suite is green on the plain command).

## 2026-09-27 → 2026-09-30 — Full post-form catalogue, search, chat E2E v2

### Added

- **The real post form covers the whole catalogue (146/146 subcategories)**: Services, Fashion &
  Beauty, Furniture & Decor, Books/Sports/Hobbies, Pets and Foods all opted in.
- **Search**: the `/search?q=` page, header search bar, tokenised title + description matching
  with trigram indexes (migration `0031_listing_search`), `effective_price` (price after
  discount) filters, sorts including Best match, a typo fallback, date-posted and delivery
  filters, per-category facet counts, and a sort-aware keyset cursor. The filter bar now drives the
  feed on every page (it was UI-only before), and All Ads uses the real feed.
- **`/settings` made real**: profile, password, username and phone change via OTP, delete account
  with a 90-day purge (`AccountPurgeService`).
- **Designed storefront 404 page.**
- **Chat E2E v2** (`603aa33`, 2026-09-29, per `tasks/plan-e2e-multi-device.md`; Phases 0–2 and
  4/5 done):
  - multi-device (migration `0027`);
  - encrypted history backup with a passcode or device approval (`0028`, `0029`);
  - WebSocket ack/error frames and live read receipts.

  The plan's Phase 3 cutover is still open: rejecting v1 sends, and a real devices page.

- **Encrypted chat attachments** (migration `0030`; `e222daa`/`28e1d37`/`72d5102`, 2026-09-29,
  per `docs/e2e-attachments.md`, P1–P4): a private `chat-files` bucket, AES-256-GCM per
  file, 5-minute signed URLs, an hourly cleanup job, a download button, and a resizable chat
  sidebar.
- **Outbox retention sweep** (`OUTBOX_RETENTION_DAYS` was parsed but never read).
- Ledger amount rules plus a DB `CHECK (amount > 0)` (migration `0032`).
- A Job Type grid on the Jobs category page.

### Fixed

- E2E chat could not decrypt after an identity rotation (stale one-time prekeys).
- The chat composer deleted its own image draft, so images could not be sent.
- Duplicate message keys when the WebSocket echo arrived before the send response.
- "Upgrade Account" pointed at a `/membership` route that never existed.
- Search: date-posted hid listings without `published_at`; expired ads now leave the feed.
- The Show More bars are equal on the left and right.

## 2026-09-18 → 2026-09-24 — Post form families, notifications, chat

### Added

- **Real post form for Phones & Tablets, Computers & Accessories, Electronics & Appliances, Home &
  Land and Jobs.** New blocks: storage/accessory/network, the computers spec cluster,
  bedroom/bathroom/facing/size, and jobType/experience/company. Labels, photo max and Type options
  are read from each subcategory's `field_schema`.
- **Models scoped to subcategories** (`model_subcategory_links`, migrations `0019`, `0020`); a
  slug-collision guard in the model seed.
- **Attribute-grid filters**: `GET /listings` gained `attrKey` + `attrValue`, so clicking a Type,
  Accessory or other tile filters the feed (it used to return nothing).
- **In-app notifications** (migration `0024`).
- **Chat E2E v1**: the key schema and key-management endpoints landed first (2026-09-19,
  `cb0bc4a`/`4d28133`, per `tasks/plan-e2e-phase1-2.md`; migration `0021`). Then a separate
  Ed25519 signing key (`0022`) and X3DH + Double Ratchet over `@noble/curves` (2026-09-21,
  `64c1414`, per `docs/e2e-encryption.md`).
- **Chat production hardening**, delivered on a different path from `tasks/plan.md`:
  - cross-instance realtime push over Redis pub/sub;
  - WebSocket auth and rate-limit parity, and user-keyed throttling;
  - `clientMessageId` dedupe (`0023`);
  - WebSocket tickets, and a heartbeat that records client pongs (`c33fb24`);
  - in-process send-latency metrics at `GET /admin/chat-metrics` (`b9222f9`).
- **Chat UX**: attached-ad cards, draft image management, grouped images (`0026`) and per-side
  conversation delete (`0025`).
- Listings without a price read "Negotiable" instead of `$0`.

### Changed

- The category name is "Phones & Tablets" (it was singular, which broke its i18n lookup).
- A job's company sits on the seller card, not the specs grid. The seller card hides rows with no
  data.
- The icon-vs-text tile design is declared per attribute set instead of sniffed from the rows.

### Fixed

- Description, Location and Address were starred but not enforced, so a listing could publish
  with no location and be invisible to location search.
- Plain Galaxy S21–S25 models were dropped by a `+` slug collision.

## 2026-09-08 → 2026-09-17 — Payments, geography, post form

### Added

- **Payment module** (Effect use-cases, double-entry ledger, `payment` Postgres schema via
  migrations `0014`, `0015`): ABA PayWay and Bakong providers, outbox-driven queue processing,
  and `payment.succeeded` announced on settlement. Fails closed when a provider is unconfigured.
- **Transactional outbox** (`src/outbox/`, migration `0013`).
- Chat tables moved to a `chat` Postgres schema (migration `0016`).
- **Cambodian geography**: 25 provinces, 208 districts and 1,652 communes with Khmer names
  (migrations `0017`, `0018` — geo FKs are `ON DELETE RESTRICT`), and the three-level Location
  picker on the post form.
- **Location map picker** on Leaflet + OpenStreetMap (no Google key), with the pin re-rendered
  on the listing detail.
- **Schema-gated `ListingPostForm`** for all 10 Cars & Vehicles subcategories, plus a cars form
  redesign and real categories in post step 1.
- `DbImage`: only Supabase Storage objects render as images; anything else shows the "no image"
  state.

### Changed

- `vehicletypes` is retired in favour of `bodytypes`. Unticking an attribute in the admin is
  authoritative (`forSub` managed-set rule). Colours are scoped to the subcategories that
  declare them.
- An applied attribute set steps aside, a pick scrolls to the top, and Back walks the drill-down.
- Searchable-picker scrolling: whole rows, a visible scrollbar, and no page scroll-through.

## 2026-08-17 → 2026-09-05 — Storefront goes real

### Added

- **Phone OTP registration and login**: OTP verify page, Cambodia-local phone input,
  phone + password → OTP login, password/names/username set at registration, and `/me` as the
  post-login landing page.
- **Backend-driven storefront**: homepage Browse By Category, category and subcategory pages,
  live brand/model/body-type grids (91 car brands, 31 motorcycle brands), real listing feeds for
  every category, real listing detail with a specs grid and carrier icons, and the unified sticky
  filter bar with grid/list toggle.
- **Ad creation**: `POST /listings` + publish, photo uploads through signed URLs, and a demo
  listings seed.
- Split admin (`/wanderer/*`) and user sessions with separate httpOnly cookies.

### Fixed

- `db:seed` wiped category icons and polluted them with placeholders.

## 2026-06-19 → 2026-08-16 — Foundation

### Added

- Turborepo + pnpm monorepo scaffold.
- **NestJS backend**: Drizzle ORM + Supabase, JWT access/refresh auth, `@Public()`, global
  response envelope and exception filter, idempotency middleware, categories with translations,
  users and phones, listings, brands, files, and the admin API.
- **Chat**: 1:1 conversations, inbox, messages and read receipts over REST.
- **Admin dashboard** (Next.js, later moved from `apps/admin` to `apps/web`): stats, users,
  categories, subcategories, brands, models, attributes, subscription config and reports.
- **`super_admin` role** (2026-08-15, `f008db6`, migration `0012_blushing_sentinel`). It
  satisfies every admin guard; only super_admin may assign staff roles, and the Team page is
  super_admin-only (server redirect + hidden sidebar link).
