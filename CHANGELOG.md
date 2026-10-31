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

### Changed

- **Bakong payments are polled on demand by one poller, not by a self-rescheduling chain** (`Plans.md`, "Bakong
  demand-driven polling"). Issuing a checkout now emits a local `payment.issued` event that arms
  `PaymentReconciler`: it checks every 5 s for the first minute, every 15 s while the checkout stays pending, and
  falls back to the 60 s safety sweep when nothing is open. The outbox → BullMQ → Bakong → outbox chain is retired,
  so a KHQR left open no longer writes up to ~25 outbox rows and Redis jobs (≈75 before back-off). An unpaid
  checkout is now abandoned at its own expiry plus 30 s (Bakong's `charge()` now stamps `expires_at`, as ABA's
  does) instead of after a flat 15 minutes; the provider is still asked first, so a payer at the deadline settles.
  Attempts we gave up on (`POLL_EXPIRED`) are re-asked about every 5 minutes inside the existing 24 h grace instead
  of on every tick. Fixed: the reconciler read candidates oldest-first with one shared limit of 100, so with many
  abandoned checkouts the payer actually waiting could be skipped; pending and recoverable attempts are now read
  newest-first with separate caps. `GET /payments/:id` also nudges an open Bakong checkout along (at most one
  Bakong call per attempt per 5 s, after the ownership check; the response still comes from the database).
  `BAKONG_POLL_INTERVAL_MS` and `ChargeResult.poll` are removed (an old value in `.env` is ignored). Rows and
  delayed jobs written before the switch are drained by a no-op handler, not retried to failure.
- **Older messages are one notice, and tabs off `/chats` keep the backup complete** (`Plans.md`, "Keep E2E, stop the
  wall"; design in `docs/e2e-encryption.md` section 9c). A run of messages sent before this device joined is now a
  single notice with a count instead of one identical note per bubble, with text that depends on whether the backup
  is locked with a passcode, ready, or locked without one. Opening such a thread on a locked device re-opens the
  passcode dialog each time; "Not now" silences it for the browser session. The leader tab also uploads pending
  plaintext when the tab is hidden. Together with the catch-up decrypt (a tab on any page caches what it
  receives), the backup now holds messages that were received but never displayed. Not browser-verified: the
  "ready" and "locked, no passcode" notice states and the flush itself.

- **A chat partner is never "not set up yet"** (`Plans.md`, "Signal-model key availability"; design in
  `docs/e2e-encryption.md` section 9b). (1) The browser registers its E2E device as part of signing in
  (password and OTP login, OTP registration), not when a layout happens to render. (2) A user who went quiet
  is still reachable: when none of a user's devices was seen within 30 days, their 2 most recently seen
  non-revoked devices stay targets (`loadTargetDevices`, the one helper behind the devices list, the bundle
  fetch and the send-path set check). (3) A message to someone with no device at all is **held** in the
  sender's browser ("Waiting for <name> to join secure chat"), retried by a loop that only runs while
  something is held, sent at most once, and shown as "not sent" after 14 days; the first one sends a
  content-free in-app nudge (`POST /chats/e2e/nudge/:userId`, 24 h per sender and recipient). (4) A visible
  tab re-runs the device heartbeat every ~6 h, asks for persistent storage, and shows a notice when the
  browser repeatedly cannot create keys. The "Ask them to open Messages once" error is gone in all six
  locales. Nothing is ever sent in the clear. Known gaps: no Telegram nudge (no messaging channel exists);
  a message to a stale device is readable only if that person returns on the same browser; the
  release-on-registration path is unit-tested but was not exercised against a real registering account.

- **Chat "share location" opens a map picker.** The Location tile opens a dialog with a map; "Use current
  location" is the only thing that asks the browser for GPS (inline messages for denied, timeout,
  unavailable and unsupported). `LocationMapCanvas` gained an optional `flyTo` prop.

- **Hidden tabs no longer poll the backend** (Vercel usage investigation; plan in `Plans.md`). The backend runs
  as a container that scales to zero within about a minute, and a hidden tab's throttled timer fired the E2E
  backup sync and approvals poll once a minute, which is just slow enough that **every call cold-started the
  whole backend (~6 s to boot, 8 boots in an 8-minute sample from one parked tab)**. `hooks/use-e2e-backup.ts`
  now runs them through `lib/polling/visible-poller.ts`: no timer or request while the tab is hidden, an
  immediate catch-up on return (only if the last run is older than the interval), and the account-level
  sync runs in one visible tab per browser (Web Locks; browsers without it keep every tab polling). The 20 s
  approvals poll stays per tab and is deliberately **not** slowed, because a poll slower than the ~30–60 s
  warm window would boot the backend on every call. The 10 s "waiting for another device" poll is gated too.
  Added `pnpm --filter web test` (Node's built-in `node:test`, no new dependency) and
  `allowImportingTsExtensions` in `apps/web/tsconfig.json` so the test can import its `.ts` module.

- **Backup and approvals are pushed over the WebSocket instead of polled** (`Plans.md`, "Push instead of poll").
  `E2eBackupService` now publishes `e2e.history_requested`, `e2e.history_resolved` and `e2e.backup_updated` as
  `notification` frames to the user's own tabs, after the write commits, with ids only (best-effort; a failed
  publish never fails the request; an idempotent repeat of a history request publishes nothing). The web hook
  (`lib/e2e/push-events.ts`) maps each to an ordinary read and ignores its own device's events. While the socket is
  up the polls drop to a 5-minute safety net (1 minute while waiting for another device to approve); with no socket
  they keep today's 20 s / 60 s / 10 s, and every (re)connect catches up because a missed frame is not replayed.
  A push only nudges the one leader tab's sync, so tabs still never pull in parallel. **Backend and web must
  deploy together**: a new web build against an old backend simply keeps its 5-minute poll and would be slow to
  notice an approval.
- **An abandoned visible tab behaves like a hidden one.** After 30 minutes without pointer, key, scroll or touch input
  (`lib/polling/attention.ts`, `ATTENTION_IDLE_MS`) the socket closes and every poller stops — the E2E ones through
  `visible-poller.ts`, and the chat fallbacks (inbox, unread badge, thread delta, checkout) through the new
  `use-tab-attention.ts`, because "socket down" alone would otherwise re-enable them in a tab nobody is looking at.
  The first input, or the tab being shown again, reopens everything and the reconnect refreshes inbox and unread. A
  message that arrives meanwhile appears on that first input, not before.

### Removed

- **New-device approval is gone; the backup passcode is the only restore path.** A device that cannot read older
  history can now only unlock the account's backup key with the passcode. Removed end to end: the
  `history-requests` API (`create` / `mine` / `pending` / `approve` / `decline` / `consume`), the
  device-to-device key envelope and its Double Ratchet handling, the `e2e.history_requested` /
  `e2e.history_resolved` push events, the approval dialog and "Ask my other device" UI, and the
  `chat.e2e_history_requests` table (migration `0041_brainy_plazm`). The only realtime hint left is
  `e2e.backup_updated` (another device uploaded segments), which still drives a sync.

### Changed

- **A backup passcode is required before the backup is usable elsewhere.** It was optional (a dismissible nudge);
  without approval, a backup with no passcode is a dead end — a new device has no way in. A device that holds the
  key and has no passcode now gets a forced, non-dismissible "Set a backup passcode" dialog. Accounts that already
  have a backup without a passcode keep working on the devices that hold the key; setting one there makes the
  history restorable on a new device. The locked-device copy now explains the passcode-only path (and what to do
  when no passcode was ever set) instead of offering approval. A locked device now asks for the passcode when the
  user first opens a conversation (once per browser session); the per-message "Restore chat history" link was
  removed, and the undecryptable-message note now points at the backup passcode instead of another device.

### Known issues

- **Bakong polling has not run against a live Bakong or a booted app.** The new poller, the throttled read and the
  legacy drain are covered by unit tests with mocked database and provider (backend `jest`, 64 suites / 860
  tests), `nest build` and `eslint`; the `payment.issued` wiring (an `EventEmitter2` injected into
  `PaymentProcessor`) and the `expires_at` stamp in Bakong's `charge()` are not unit-testable here (`effect` is
  ESM-only under Jest). Batching many MD5s into one call (`check_transaction_by_md5_list`) is **not** built: NBC's
  published guide does not document it and no source gives a schema. Also unverified: a third-party note of a daily
  request limit on the Bakong Open API — if real it caps how many checkouts can be polled, so confirm it on the
  Bakong developer portal before real traffic. A serverless instance still only polls while it is alive: a QR paid
  while nobody is on the checkout page waits for the next request or boot (`Plans.md` Task 2.1).
- The cause of the high Vercel usage is inferred from a 50-row log sample and the code: per-project and
  30-day numbers need the paid Observability Plus add-on, and billing was not readable. Re-measure after
  this ships (`Plans.md`, Task 0.1 / 4.1). The `APP_ROLE` worker split (Task 2.1) and the hosting decision
  (Task 3.1) are still open. The push work is covered by unit tests but has **not been exercised in a browser or in
  production** (`Plans.md` P0.1 / P2.2 / P3.1): confirm the socket connects, then deploy backend and web together.

## 2026-10-24 — Encrypted-only chat, history restore, idle background work

### Changed

- **Background work no longer runs when there is nothing to do** (Vercel resource audit; plan in `Plans.md`).
  The outbox worker used to claim from `outbox_events` every 2 s forever; it now asks the database when the
  next row is due (`OutboxService.msUntilNextDue`), sleeps until then, and re-arms after every drain that
  handled events. `OUTBOX_POLL_INTERVAL_MS` is now the **longest** idle sleep (default 2000 → 30000), which
  only bounds the latency of a lost wakeup or a producer in another process — lower it for an API-only /
  separate-drainer topology. A failed peek falls back to a plain claim.
- **Bakong poll chain backs off.** Rounds are the base interval (4 s) for five rounds, then 2×, then 4×
  (cap 30 s), and the last round lands just after the QR expires. One abandoned checkout writes ~25
  outbox rows instead of ~75. Payloads gained optional `round` / `delayMs`; older queued payloads still work.
- **`PaymentReconciler` relaxes when idle.** With no unresolved attempt and nothing to activate or expire it
  ticks every `PAYMENT_RECONCILE_IDLE_INTERVAL_MS` (new, default 60 s) instead of every 15 s; any activity
  returns it to `PAYMENT_RECONCILE_INTERVAL_MS`. The boot tick is still immediate.
- **No housekeeping at boot.** The outbox retention sweep and the account purge no longer run the moment the
  process starts; the first run waits a jittered 1–2 minutes, so a restart loop is not a query loop.
- **Checkout fallback polling** (socket down only) backs off 5 s → 15 s and pauses while the tab is hidden.
- Outbox worker logs a one-line stats summary (due-time checks, drains, events) every 10 minutes.
- **Backup API is device-scoped.** `POST /chats/e2e/backup` and
  `GET /chats/e2e/backup/segments` now require an active `deviceId`;
  `POST /chats/e2e/history-requests/:id/consume` only succeeds for the requesting device and
  returns `404 E2E_REQUEST_NOT_FOUND` / `409 E2E_REQUEST_NOT_PENDING` instead of a silent
  `{ ok: true }`. Init, segment upload and segment list are throttled (10 / 30 / 60 per
  minute).
- **v2 send device-set check is race-free.** The active-set read is repeated inside the
  message insert transaction under per-user Postgres advisory locks shared with
  `registerDevice`, so a device registering mid-send surfaces as `409 E2E_DEVICES_MISMATCH`
  and is retried by the client instead of silently missing an envelope.
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
  row with immediate send. Quick replies are an empty-thread onboarding row: they are shown
  while a conversation has no messages, and dismissing them with the X is remembered per
  conversation in `localStorage` (`chat:quick-replies-dismissed:<scope>`), so every new chat
  introduces them again. The inbox column keeps its previous design ("Inbox" title, chevron
  collapse, 300/340px default width). Only its portaled menu and delete dialog pick up the
  panel's dark scope.

### Added

- **App-wide encrypted-history restore.** `E2eBackupProvider` now mounts in the `(user)` and
  `(chat)` layouts and owns the single backup instance (status, uploads, pulls, the
  approval prompt and the restore dialogs), so history backs up and restores even when the
  chat page is closed. A locked (new) device automatically asks the account's other devices
  for the backup key once per session, and an incoming request is approved from any page.
- **Actionable "not on this device" bubble.** A message this device cannot decrypt now
  offers `Chat.message.restoreHistory` ("Restore chat history"), opening the passcode or
  other-device restore flow instead of ending at a dead-end note. Newly decrypted plaintext
  is uploaded to the backup promptly via the `E2E_PLAINTEXT_CACHED` window event.
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

### Fixed

- **Backup-key creation race.** Two first devices creating the account backup at the same
  time could leave the loser holding a key that would never open the account backup.
  Creation now runs under a cross-tab Web Lock, re-reads the status inside it, and clears
  any stored key that fails the server `keyCheck` instead of using it.
- **An approval can no longer be stranded.** After a device approves a new device, the
  backup key is validated and saved before the one-shot ratchet step is committed and
  before the request is consumed; a pull that fails after that is retried by the ordinary
  pull cycle.
- **Backup pulls are no longer silently lossy.** An unreadable segment stops the cursor
  instead of advancing past it, and pulls no longer depend on uploads succeeding.
- A thread opened via `?to=<peer>` before the conversation existed did not fill in when the
  first inbound message created it. `chat-workspace.tsx` now reconciles the cached
  `GET /chats/with/:userId` lookup against the inbox.
- **The web project failed to build on Vercel (`NEXT_NO_VERSION`).** `.vercelignore` excluded `apps/web`, but
  that file is read by every project built from this repo, including the web project (Root Directory =
  `apps/web`), which then had no `package.json`. The exclusion is gone; the backend image build only uploads
  more (~257 MB instead of ~10 MB).

### Removed

- The no-op Archive menu item and the unused i18n keys `Chat.inbox.archive`,
  `Chat.thread.emptyTitle`, `Chat.thread.attachingListing` and `Chat.thread.sendingVoice` (all six
  locales).

### Docs

- `docs/admin-backoffice-audit-2026-10-24.md`: the admin vs super_admin backoffice audit
  (read-only, no code changes).
- `CHANGELOG.md` introduced. `tasks/todo.md` was reset to open items only, and its history
  rolled up here.
- `ARCHITECTURE.md` added and `CLAUDE.md` slimmed down; the plans under `tasks/` were checked against the code
  and the finished ones deleted (shipped outcome lives here, text in git). `Plans.md` gained the backend
  background-work audit plan.

### Known issues

- The attachment daily quota sums the client's `declaredSize`; only the per-kind cap is
  re-checked against the stored object size.
- A v2 envelope's `wrappedKey`/`header` is stored verbatim, with nothing binding it to the device
  key it claims to target. No safety-number / key-substitution protection yet.
- Backup restoration remains ciphertext-only and device-gated, but there is still no segment
  retention/size quota beyond the route throttles, no device-list/revocation management, and
  a participant still receives every device envelope of a v2 message (device ids/count are
  visible; wrapped keys stay unreadable). A revoked device keeps the backup key and can read
  messages already addressed to it; any authenticated stranger can list a user's active
  device ids and claim one-time prekeys. These are tracked as follow-ups, not fixed here.

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
