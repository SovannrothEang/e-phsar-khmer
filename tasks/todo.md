# Ship log

Running log of in-flight work: what is changing, how it was verified, and open decisions. Append a
dated entry per ship (`## YYYY-MM-DD — <title>`). Once an entry has shipped, fold its outcome into
`CHANGELOG.md` and delete it from here.

The full history up to 2026-10-24 (5,364 lines, every ship since 2026-08-17) was rolled into
`CHANGELOG.md` on 2026-10-24. The original text is in git: `git show fd824a0:tasks/todo.md`.

## Open items carried over from the old log

Long-standing gaps are tracked in CLAUDE.md under **Known gaps**. These are the newer open items
from the most recent ships that aren't recorded there.

### Payments

- **Possible second outbox consumer.** The Vercel `phsar-backend` shares the Supabase DB and runs
  the same in-process outbox worker, so it may claim rows and publish into its own Redis (the
  suspected cause of the lost Bakong poll on 2026-10-14). Set `OUTBOX_WORKER_ENABLED=false` there,
  or give dev and prod separate databases. Consider storing the claiming `instanceId` on
  `markPublished`.
- Bakong `reconcile()` trusts `responseCode 0 + data`; amount, currency and receiver aren't
  cross-checked against the transaction.
- The ABA webhook ack is wrapped by `ResponseInterceptor` (`{success,data:{code:0}}`), but ABA
  reads a top-level `code`.
- Failures and expiry aren't pushed to the checkout page; it relies on the post-expiry read
  window.
- Set `ABA_PAYWAY_WEBHOOK_URL` (`…/api/v1/payments/webhooks/aba-payway`) and
  `ABA_PAYWAY_LIFETIME_MINUTES` in every environment. Drop the old `/webhooks/aba-payway` alias
  once no unresolved ABA attempt predates the switch.
- No `payment.failed` event. Payment use-case tests are blocked on ESM `effect` under Jest.
  Failed `outbox_events` and `idempotency_keys` have no retention.

### Subscriptions

- Nothing marks a purchase `failed` on its own (only lazily on checkout retry). A late payment for
  a purchase already `failed` lands as "needs manual review".
- `autoRenews` and `videos` are stored but not enforced.
- Dev data: the old test group "Auto 8137" covers nothing (its 3 subscribers get free limits), and
  most admin-owned demo listings are restricted by the free caps.
- Entitlement checks re-read config on every call (5 small queries, two checks per publish).
  Cache if it shows up in profiling.

### Moderation / audit (2026-10-23)

- Migration `0040_moderation_feedback` has not been applied to the shared dev DB. Mind the
  migration-watermark gotcha.
- No browser run yet of the moderation, report and feedback pages and dialogs, or of a live upload
  through the per-user folders.
- The owner's My Ads page doesn't explain a removal. Manage Advertisement Ads and an admin
  Payments page are not built (product decisions).
- Dead mock files: `apps/web/lib/feedbacks.ts`, `apps/web/lib/report.ts`.

### Admin backoffice audit (2026-10-24)

From `docs/admin-backoffice-audit-2026-10-24.md`, re-checked against code the same day. None of
these is fixed yet.

- **C1, check first:** the `DEV_OTP_TOKEN` SMS bypass isn't environment-gated
  (`config.validation.ts` accepts it in every `NODE_ENV`), and `apps/backend/.env.prod` sets it.
  Verify the Vercel production env, reject the variable when `NODE_ENV=production`, and rotate it.
- **C2:** `PATCH /payments/:id` changes status without a ledger entry, status history or actor.
- **C3:** deleting a subscription category (`removeCategory`) silently drops every subscriber in
  that group to the free plan, and doesn't reconcile their ads.
- **H1:** no audit trail for any privileged action. This is super-admin Phase 3
  (`docs/super-admin-todo.md`).

### Chat

- See CHANGELOG **Unreleased → Known issues**: the attachment quota uses `declaredSize`; v2
  envelopes aren't bound to the target device key; there are no safety numbers.
- **E2E multi-device Phase 3 cutover** (`tasks/plan-e2e-multi-device.md`) is not started.
  Still to do:
  - reject v1 `e2eHeader` sends (426 `E2E_CLIENT_OUTDATED`);
  - remove the v1 bundle endpoint and `user_e2e_identities`;
  - wire `components/setting/Devices.tsx` (still a mock) to a device list + revoke API.

### Web

- Filter-bar sort labels and chips are English-only.
- Pages scroll horizontally by about 395px at 390px width (navbar + card component).

## 2026-10-27 — Signal-model key availability (Plans.md K0.1, K0.2, K2.1)

### K0.1 — device census (dev DB, read-only)

Run 2026-10-27 inside `BEGIN READ ONLY`, counts only (no row content read). Non-deleted accounts
only. "Active listing" = `listings.status = 'active'`; "in a conversation" = either side of any
`chat.conversations` row. Buckets are evaluated in order, so each account lands in exactly one.

| Bucket                                         | All accounts | With active listings | In a conversation |
| ---------------------------------------------- | -----------: | -------------------: | ----------------: |
| never registered (no device row)               |           36 |                   11 |                 8 |
| all revoked                                    |            0 |                    0 |                 0 |
| stale only (non-revoked, none seen in 30 days) |            1 |                    0 |                 1 |
| targetable (≥ 1 non-revoked, seen in 30 days)  |           14 |                    7 |                14 |
| **total**                                      |       **51** |               **18** |            **23** |

**Production: unknown** — not read (owner decision D4 not taken). Before K2.1, the 1 stale-only
account got "not set up yet"; after K2.1 it is targetable through the newest-two fallback. The 36
never-registered accounts (8 of them already in a conversation) are the hold-and-send case (K3.x).

```sql
with acct as (
  select u.id,
    case
      when not exists (select 1 from chat.user_e2e_devices d where d.user_id = u.id) then 'never_registered'
      when not exists (select 1 from chat.user_e2e_devices d where d.user_id = u.id and d.revoked_at is null) then 'all_revoked'
      when not exists (select 1 from chat.user_e2e_devices d where d.user_id = u.id and d.revoked_at is null
                       and d.last_seen_at > now() - make_interval(days => 30)) then 'stale_only'
      else 'targetable'
    end as bucket,
    exists (select 1 from listings l where l.user_id = u.id and l.status = 'active') as has_active_listing,
    exists (select 1 from chat.conversations c where c.user_a_id = u.id or c.user_b_id = u.id) as in_conversation
  from users u
  where u.deleted_at is null
)
select bucket, count(*)::int as all_accounts,
  count(*) filter (where has_active_listing)::int as with_active_listings,
  count(*) filter (where in_conversation)::int as in_a_conversation
from acct group by bucket order by bucket;
```

### K2.1 — a registered account is never untargetable

- `loadTargetDevices` (`apps/backend/src/chat/e2e/e2e-devices.util.ts`) is now the only place
  that decides the device set: per user, the non-revoked devices seen within
  `DEVICE_STALE_DAYS`; if none, the `STALE_FALLBACK_DEVICES = 2` most recently seen non-revoked
  ones (ties broken by id). `activeDeviceCondition` is gone.
- Routed through it: `GET` devices (`listActiveDevices`), `loadActiveDevices`, the bundle fetch
  (`getDeviceBundle` — otherwise a listed fallback device would 404 on its bundle) and both send
  checks in `ChatService` (fast-fail read and locked in-transaction re-read).
- Verified: new specs failed first (17 red: missing exports / old query shape), then pass.
  Backend jest 62 suites / 811 tests green; `nest build` and eslint on the touched files clean.
  `tsc --noEmit` over specs still reports 2 errors at `e2e-keys.service.spec.ts:180,191` that are
  already on HEAD (untouched lines).
- Review: independent `harness:reviewer` pass returned **APPROVE** (minor notes only). Its one
  follow-up — the `fresh` column is the backend's first `sql<boolean>` and every spec mocks the
  DB — was checked on the dev DB through `postgres-js` (read-only): the expression arrives as a
  real JS `boolean` (`true`/`false`), not a string.
- Known, accepted (owner decision D3): a user with 3+ non-revoked devices that are all stale has
  only the newest two targetable; sending from an older one gets `E2E_DEVICE_INACTIVE`, which the
  client already recovers from by re-registering (strictly narrower than before K2.1).

### K0.2 — does each sign-in bootstrap the E2E device without a reload?

- **Telegram: no web flow.** The "Sign in or register with Telegram" buttons in
  `components/auth/LoginForm.tsx` and `RegisterForm.tsx` have no handler; nothing to measure.
- Password, phone-OTP login and OTP registration all end identically: a server action
  (`actions/login.ts` `login`, `actions/otp.ts` `verifyOtp`) calls `setUserSession`, then the
  client does `router.push("/me")` inside the same `(user)` layout that hosts
  `E2eBackupProvider`.
- **Password: bootstrapped without reload** (2026-10-27, headless Chrome 152, fresh profile, test
  account A, before K1.1). A `window` marker set before submit survived (same document; the only
  top-level navigation was the initial `/en/login`). `npic-e2e-identity` appeared ~4 s after
  submit and a new `chat.user_e2e_devices` row ~6 s after, without visiting `/chats`. Side
  effect: A was at the 5-device cap, so its least recently seen device (Firefox, last seen
  Oct 6) was revoked by the eviction rule.
- **OTP login and OTP registration: not run** (no OTP bypass token read, no new account
  created). Same mechanism as the password flow, so expected to behave the same; K1.1 covers
  them regardless.
- **Telegram: N/A** (no web flow).

### K1.1 — registration is part of authentication

- `lib/e2e/bootstrap-after-auth.ts` `bootstrapE2eAfterAuth(userId)` (fire-and-forget
  `getE2eEngine` with 2/5/10 s retries) is called on success in `LoginForm` (password) and
  `OtpVerifyForm` (OTP login and registration). The provider stays the safety net; the
  engine promise cache means it reuses this bootstrap.
- Verified (password, test account B, fresh profile): the device row was created **0.75 s
  after submit, before the redirect to `/me`** (vs ~6 s from the layout in the K0.2
  baseline); same document, no reload, `/chats` never visited. OTP flows not run in a browser
  (same call site, `OtpVerifyForm`). `AdminLoginForm` is deliberately not wired (staff
  dashboard, no chat).

### K1.2 — visible-tab heartbeat

- `lib/e2e/heartbeat-schedule.ts` (pure; 6 h window persisted in localStorage, recorded before
  the run so concurrent callers never double-fire) + `engine-provider.ts`
  `reheartbeatE2eDevice` (re-runs `ensureDevice`: heartbeat + prekey top-up) +
  `hooks/use-e2e-engine.ts`: a `startVisiblePoller` per signed-in device checks every 15 min
  (Web Locks leader, visible tabs only, catches up on focus).
- Verified: `heartbeat-schedule.test.ts` red (module missing) then 8/8 green. **Not verified**:
  the browser half (`last_seen_at` advancing on a tab left open past 6 h).
- Known nits: a fresh browser's first page load heartbeats twice (bootstrap + first tick); a
  failed heartbeat waits a full window before retrying.

### K1.3 — storage persistence and visible bootstrap failure

- `lib/e2e/bootstrap-health.ts` counts consecutive bootstrap failures and classifies them
  (storage / server / unknown); `engine-provider.ts` records success/failure and asks once per
  page load for `navigator.storage.persist()` (result logged). `E2eBootstrapNotice` in the chat
  thread column shows one dismissible notice after 2 consecutive failures; `Chat.e2eSetup`
  strings in all 6 locales. 3 unit tests.
- Verified in headless Chrome (signed in as test account B): with `window.indexedDB` hidden
  before page scripts, `/en/chats` shows "Secure chat isn't available in this browser" with the
  storage text; with normal storage no notice, and `[e2e] persistent storage not granted` is
  logged (headless Chrome grants by engagement). A real private window was not tried (modern
  Chrome/Firefox private windows do have IndexedDB, so they no longer trigger this).

### K3.1 — held-send core

- `lib/e2e/held-sends.ts` (+ `held-sends-store.ts` IndexedDB adapter): `hold`, `release`,
  `releaseAll`, `cancel`, `list`; states `held` / `sending` / `expired`; 14-day lifetime; per-
  recipient Web Lock + re-read before each send; a non-"no devices" error is rethrown, not
  held. `held-sends.test.ts` red (module missing) then 9/9 green.

### K3.4 — content-free nudge

- `POST /chats/e2e/nudge/:userId` (`e2e-nudge.controller.ts` / `.service.ts`, optional
  `listingId`): 404 unknown user → 403 blocked either way → no-op `{ sent: false }` if a
  `chat.e2e_nudge` notification from this sender exists in the last 24 h (jsonb
  `data->>'senderId'` on `notifications`, no migration) → `NotificationsService.notify()` with
  no body, a fixed title or the listing's own title. Web action `actions/e2e-nudge.ts`.
  `ChatModule` ↔ `NotificationsModule` now use `forwardRef` on both sides.
- Verified: 5 specs red (stub) then green; backend 63 suites / 827 tests; `nest build` clean;
  the running dev backend rebooted cleanly with the new module graph.
- **Gap vs the task text:** no Telegram delivery. The codebase has no Telegram messaging
  channel at all (Telegram is login-only), so "plus Telegram when linked" needs a new channel.

### Location picker 6.1–6.5

- 6.1: nothing assumes `accuracyMeters` (`chat-content.ts` validates it only when present;
  `location-card.tsx` never reads it; the composer chip guards it).
- 6.2: `LocationMapCanvas` gained an optional `flyTo { lat, lng, zoom?, nonce }` that pans the
  existing map (no rebuild); the post form never passes it.
- 6.3/6.4: `components/chat/location-picker-dialog.tsx`; the composer's Location tile opens it
  (no geolocation call outside it; `git grep geolocation apps/web/components/chat` hits only the
  dialog). 6.5: 6 keys added, `locationReady`/`locationError` removed, parity across 6 locales.
- Browser checks (6.6) pending.

## 2026-10-27 (later) — verification run, held sends wired, H-plan hunks

### Corrections to the entries above

- The two browser profiles: **`qwer` is on port 9333, `asdf` on 9334** (the K1.1 sign-in replaced
  the original `asdf` session on 9333). So the held-send and location runs below were sent **as
  `qwer`** (the K3.4 nudge row's `senderId` is `qwer`'s id). The K0.2 baseline and K1.1 numbers
  above are unaffected (A = `asdf` before K1.1, B = `qwer` after).
- "K1.3 — notice in a real private window" was not tried; the check hides `window.indexedDB`
  instead (see K1.3 above).

### K3.2 / K3.3 — hold and retry, verified in the browser (sender `qwer`, recipient `booksverify`, a never-registered QA account)

- Send → bubble "Waiting for booksverify to join secure chat. It will send automatically." with
  Cancel, no error toast; `npic-e2e-held-sends` holds 1 item (`held`, text, 13 chars).
- Reload → the bubble is still there. Cancel → bubble and store entry gone.
- 85 s with one item held: it stays `held` (never stuck in `sending`), no toast, retry ticks show
  up only as ordinary server-action POSTs; the dev log has no new "held send failed" lines.
- Server side (read-only SQL): one `chat.e2e_nudge` notification for `booksverify`, title
  "Someone wants to chat with you", `body` null, `data` = sender id only; **0 messages** exist
  from the sender in that conversation.
- **Not verified: release on registration** (a recipient registering a device while a message is
  held, then exactly-one delivery and decryption). I tried to get a recipient I could sign in as
  by revoking `qwer`'s device rows on the shared dev DB; the auto-mode classifier refused the
  write (shared resource) and I did not work around it. Covered by `held-sends.test.ts` (9 tests:
  holds, releases, race on `clientMessageId`, 14-day expiry, order, error surfaced) only.
  To close it: sign in on a fresh profile as an account whose devices are all revoked/missing,
  then check the sender's tab delivers the held message once within ~2 min.
- First attempt hit a bug in my own probe, not the app: opening `npic-e2e-held-sends` without a
  version created an empty v1 DB and the app then failed with "object store not found". A store
  that tolerates an externally created empty DB would be sturdier (same pattern in
  `catch-up-store.ts`); not done.

### Bug found and fixed on the way

- `/chats` returned 500 (`ReferenceError: window is not defined`): `location-picker-dialog.tsx`
  imported `DEFAULT_CENTER` as a value from the Leaflet module, defeating `dynamic(ssr:false)`.
  The earlier picker check had passed on a stale dev-server module graph. Fixed in `a071cb6`
  (`lib/map/default-center.ts`). `LocationMapPicker.tsx` (post form) has the same import pattern
  and was left alone.
- The web dev server had been wedged by a broken stdout pipe (`write EPIPE`) after its background
  task was stopped; restarted detached with file logging.

### 6.6 — location picker (sender `qwer`, receiver `asdf`)

- Opening the dialog makes 0 geolocation calls; "Use current location" with permission granted
  makes 1 and moves the pin (emulated Siem Reap fix, receiver's card shows 13.36330, 103.85640);
  a hand-picked point (Phnom Penh default) arrives as 11.55640, 104.92820.
- Permission denied: inline "Location access is blocked. Change the site's location permission to use this."; the map and "Send location" stay usable.
- 390x844 dark: confirm button fully on screen (bottom 721 of 844, right 358 of 390), 0 px
  horizontal overflow.
- **Escape**: a CDP key event does not close either the picker or the existing ad picker in
  headless Chrome, while a synthetic `keydown` closes the picker, so it is the harness rather than
  the picker; a real-keyboard check is still open.

### K4.1 — browser matrix, honest status

| Scenario                                                                | Result                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. New account: device row before any other page                        | **Not run** (registration needs an OTP). Password sign-in covered by K1.1.                                                                                                                                                                                           |
| 2. Buyer messages a no-device seller; seller signs in; one copy arrives | **Half**: hold, persistence, cancel, nudge verified; release-on-registration **not verified** (see above).                                                                                                                                                           |
| 3. Seller's device older than 30 days: buyer's message accepted         | **Verified** with the existing stale-only account `testtesttest12` (one device, last seen 2026-09-24): sent as `qwer`, accepted, tick shown, no toast, 5 envelopes incl. exactly 1 to that account's device, no `E2E_DEVICES_MISMATCH` loop. No DB write was needed. |
| 4. Private window: notice shown                                         | **Simulated** with `window.indexedDB` hidden (K1.3); real private window not tried.                                                                                                                                                                                  |

### H-plan hunks (uncommitted: they sit on top of the owner's staged WIP)

- **H1.2** (owner's WIP): verified. `asdf` parked on `/en`, `qwer` sent 3 messages; the three
  plaintexts appeared in `asdf`'s `npic-e2e-v2` `decrypted` store with `/chats` never opened.
  (First probe counted the wrong DB, `npic-e2e`.) The backup upload that should follow was not checked.
- **H3.1** `lib/chat/group-unavailable.ts` (+ test, red then green), **H3.2** state-aware text,
  **H3.3** passcode re-prompt with a session "Not now", **H1.3** flush backup on
  `visibilitychange`/`pagehide` (leader tab only): written by a worker, merged by the lead, gates
  green (web 64 tests, tsc, eslint, 6-locale key parity). Browser (locked device, `asdf` thread
  with qwer): runs collapse into counted notice rows ("...see these 11 messages." plus an inline
  "Enter backup passcode" button, no per-bubble notes left); the prompt opens when the thread opens,
  returns after a plain dismiss and reload, "Not now" sets `chat:e2e-restore-snoozed` and the prompt
  stays away after a reload; the inline button reopens it. **Not verified**: the "ready" and
  "locked, no passcode" notice states, and H1.3's flush in a browser (`pagehide` can be killed
  mid-request on a real close; `visibilitychange` is the dependable trigger).
- These cannot be committed separately until the staged WIP is committed.

### Not done in this run, and why

- Backend audit plan 0.1/0.2/1.1/3.x, Vercel usage plan 0.1/2.1/3.x, push plan P0.1/P2.2/P3.1:
  need production access, a deploy or an owner decision (marked blocked/needs-browser in Plans.md).
- H2.1/H2.2 (backup reset): owner decision D1. H4.1/H4.2: need the WIP committed first and a
  two-profile restore run.
