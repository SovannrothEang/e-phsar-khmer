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
  `E2eBackupProvider`. Browser measurement pending a dev test account.
