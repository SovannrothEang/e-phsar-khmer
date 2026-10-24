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
