# Background-work audit — review of Phases 1–4 (2026-11-04)

Reviewer: this session's Lead (primary review). Plan: `Plans.md` → "Backend
background-work audit — stop the Vercel resource burn" (2026-10-24). The shipment
entry already lives in `CHANGELOG.md` → 2026-10-24.

## Verified in the tree today

| Task | Claim                                                                        | Evidence                                                                                                                                                                                            |
| ---- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1  | the outbox worker sleeps until the next due row instead of polling every 2 s | `outbox/outbox-worker.service.ts:249` calls `OutboxService.msUntilNextDue()` (`outbox.service.ts:133`); `outbox.pollIntervalMs` (`configuration.ts:64`) is the **longest** idle sleep, default 30 s |
| 2.3  | no housekeeping at boot                                                      | `outbox/outbox-retention.service.ts:11,57` and `users/account-purge.service.ts:29,72` both wait a jittered 1–2 minutes                                                                              |
| 2.4  | observability without a timer of its own                                     | `outbox-worker.service.ts:17-18` (`STATS_REPORT_EVERY_MS = 10 min`), `stats` counters at `:52-53`, incremented on drains at `:175`                                                                  |
| 2.5  | the reconciler relaxes when idle                                             | `payment/reconciler/payment-reconciler.service.ts:224,518` + `reconcile-policy.ts:85` (`idleIntervalMs`)                                                                                            |

## Not verifiable from the current tree — recorded, not silently passed

- **2.2 (Bakong poll backoff: 4 s → 8 s → 15 s, hard cap at QR expiry)** — the
  2026-10-24 entry describes it, but the Bakong plan's demand-driven rewrite
  (0.1–2.3, 2026-10-31) replaced the fixed chain with "poll only while a payment
  is open". `BAKONG_POLL_INTERVAL_MS` still exists in `.env.example:83`, so the
  knob is live, but the backoff ladder itself is no longer visible as a named
  constant. Nothing here contradicts the CHANGELOG; it simply can no longer be
  grepped for. If the ladder matters, it belongs to the demand-driven loop now.
- **4.1 / the Vercel measurements** (before/after request counts) need a Vercel
  session: `tasks/waiting-for-implements-laters.md` §5.

## Verdict

APPROVE for Phases 1–4 as shipped: the three behaviours that decide whether a
scale-to-zero container burns its budget (next-due sleep, boot-sweep delay,
idle reconciler backoff) are present and named, and the CHANGELOG records the
config changes (`OUTBOX_POLL_INTERVAL_MS` 2000 → 30000,
`PAYMENT_RECONCILE_IDLE_INTERVAL_MS` new at 60 s, the Bakong ladder). Open items
are summarised above and, where they need an environment, parked in the waiting
file.
