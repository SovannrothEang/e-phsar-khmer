---
_harness_template: "Plans.md.template"
_harness_version: "4.3.3"
---

# Plans.md - Task Tracking

> **Project**: psa-npic
> **Last updated**: 2026-10-24
> **Updated by**: Claude Code

---

## In Progress

<!-- Add tasks with cc:wip here. -->

(none)

---

## Not Started

<!-- Add tasks with cc:todo or pm:requested here. -->

### Plan: Backend background-work audit — stop the Vercel resource burn (2026-10-24)

**Purpose**: the backend runs as a container on Vercel (`Dockerfile.vercel`) and never idles, because several in-process loops run for as long as the container lives. Cut idle and per-payment background work without losing payments or retries.

**Spec skip reason**: there is no root `spec.md`. Phases 0–2 are infra and config tuning with no change to product behaviour. Phase 3 changes how fast a paid KHQR is detected, so once the option is chosen, record it in `payment/providers/bakong/README.md` and `ARCHITECTURE.md`.
**team_validation_mode**: `manual-pass` (no sub-agents were used; Product, Architecture, Security, QA and Skeptic were each considered by hand).
**Open fact, `not_observed`**: which Vercel limit was hit (Active CPU, memory, invocations or build minutes), and on which project (backend or web). Only the backend has background loops. Phase 0 confirms it.

#### Audit findings (evidence from the code)

| #   | Source                                                                                                                                                                                                           | What it does                                                                                                                                                                                                                                        | Cost shape                                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| A1  | `outbox/outbox-worker.service.ts:86`                                                                                                                                                                             | `setInterval` every `OUTBOX_POLL_INTERVAL_MS` (default **2000 ms**) wakes a worker, which runs a claim query against `outbox_events`, even when nothing is due                                                                                      | ~43,200 DB queries/day per instance while idle, and it keeps the container busy 24/7          |
| A2  | `outbox-worker.service.ts:69`, `OUTBOX_WORKER_CONCURRENCY` (default 5), `OUTBOX_BATCH_SIZE` 10                                                                                                                   | 5 loops parked on a signal. They cost little while parked, but a backlog makes all 5 claim in parallel                                                                                                                                              | Memory plus DB connections (pool `DATABASE_POOL_MAX=20`)                                      |
| A3  | `payment/outbox/payment-poll-outbox-handler.ts`, `BAKONG_POLL_INTERVAL_MS` (default **4000 ms**), `BAKONG_QR_EXPIRY_SECONDS` 300                                                                                 | Bakong has no webhook, so each pending QR makes a chain: outbox row, then BullMQ delayed job, then Bakong HTTP call, then a new outbox row. Up to **~75 rounds per checkout**, each touching Postgres, Redis and an external API                    | Scales with abandoned checkouts. This is the biggest per-user cost                            |
| A4  | BullMQ workers: `payments` (concurrency `PAYMENT_WORKER_CONCURRENCY`), `entitlements`, `chat-maintenance`                                                                                                        | Each `@Processor` holds blocking Redis connections and stalled-job timers, so Redis commands run forever                                                                                                                                            | Redis command quota; keeps the process alive                                                  |
| A5  | `subscriptions/entitlements.scheduler.ts:11`                                                                                                                                                                     | Repeatable job every 10 min                                                                                                                                                                                                                         | Small but constant                                                                            |
| A6  | `outbox-retention.service.ts` (hourly) and `users/account-purge.service.ts` (every 6 h)                                                                                                                          | Sweeps run **immediately on every boot** (`void this.sweep()`), then on a timer                                                                                                                                                                     | Cold-start amplification if Vercel restarts or scales the container                           |
| A8  | `payment/reconciler/payment-reconciler.service.ts` (**found while implementing**)                                                                                                                                | `setInterval` every `PAYMENT_RECONCILE_INTERVAL_MS` (default **15 s**): 3 DB queries per tick plus a Bakong call for each pending attempt younger than 30 min. It duplicates the 4 s poll chain in A3, so Bakong is asked twice per pending payment | ~17k queries/day per instance, idle or not, plus a Bakong call per pending attempt every tick |
| A7  | Web: `checkout/page.tsx:47` (5 s fallback refresh), `use-chat-polling.ts` (3 s active, 30 s idle, only while the tab is visible and the WS is down), `use-e2e-backup.ts:20-21` (60 s sync + 20 s approvals poll) | Browser polling hits the same backend                                                                                                                                                                                                               | Request count, not background CPU. Chat is already visibility-gated                           |

**Skeptic note**: the 5 parked outbox workers are not the main cost. Cost comes from (a) the 2 s fixed poll, (b) the 4 s per-payment poll chain, and (c) the fact that the container is always on. Lowering concurrency alone would barely help.

| Task | 内容                                                                                                                                                                                                                                                                                                                                                                                                                                 | DoD                                                                                                                                                                                                                                                                      | Depends           | Status                                         |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- | ---------------------------------------------- |
| 0.1  | [lane:fast] [tdd:skip:read-only] Pull Vercel usage and runtime logs for the **backend** project (MCP or dashboard) and name the limit that was exceeded, with dates                                                                                                                                                                                                                                                                  | A written note states which metric hit its cap, the project name, and top contributors. If it cannot be read, record `unknown` and why                                                                                                                                   | -                 | `blocked`                                      |
| 0.2  | [lane:fast] [tdd:skip:read-only] Count rows in `outbox_events` by `event_type` and `status` for the last 7 days, and the Redis command rate if available                                                                                                                                                                                                                                                                             | Table of event_type × count/day exists in `tasks/` or the PR. Shows what share is `payment.attempt.poll_requested`                                                                                                                                                       | -                 | `blocked`                                      |
| 1.1  | [lane:fast] [tdd:skip:env-only] Config-only relief on the Vercel backend project: `OUTBOX_POLL_INTERVAL_MS=30000`, `OUTBOX_WORKER_CONCURRENCY=2`, `BAKONG_POLL_INTERVAL_MS=8000`. Producers still wake workers instantly after commit, so only the safety-net poll slows down                                                                                                                                                        | After redeploy, the outbox "started" log line shows the new values, and 24 h later the claim-query count is ≤ 1/15 of before (from 0.2/A1 baseline)                                                                                                                      | 0.1               | `blocked`                                      |
| 2.1  | [lane:gate] [tdd:required] Replace the fixed fallback `setInterval` in `OutboxWorker` with a **next-due timer**: query `MIN(available_at)` of unpublished rows, sleep until then (capped at e.g. 60 s). Idle cost becomes about 1 query/min                                                                                                                                                                                          | New unit tests in `outbox-worker.service.spec.ts` fail first and then pass: no claim query while the table is empty, a backoff-expiring row is picked up on time, and a lost wakeup is still recovered within the cap. `pnpm --filter backend test` and `lint` are green | 1.1               | `cc:done`                                      |
| 2.2  | [lane:gate] [tdd:required] Add **backoff and a hard round cap** to the Bakong poll chain (e.g. 4 s → 8 s → 15 s, stop at QR expiry), and stop immediately when the attempt is settled, cancelled or the QR expired                                                                                                                                                                                                                   | Spec tests prove the interval grows, no new poll row is written after `expiresAt`, and a settled attempt writes none. A KHQR left open writes ≤ ~25 rows instead of ~75                                                                                                  | 0.2               | `cc:done`                                      |
| 2.3  | [lane:gate] [tdd:required] Make boot sweeps cheap: delay the first `OutboxRetention` and `AccountPurgeService` sweep (jitter ≥ 60 s after boot) and make retention daily rather than hourly                                                                                                                                                                                                                                          | Tests show no sweep at `onApplicationBootstrap`; the first sweep runs after the delay. Existing retention and purge specs stay green                                                                                                                                     | -                 | `cc:done`                                      |
| 2.5  | [lane:gate] [tdd:required] Reconciler idle back-off: when a tick finds nothing to check, stretch the next tick to an idle interval (default 60 s). Any activity returns to the 15 s base interval. The boot tick stays immediate because it recovers payments made while the app was down                                                                                                                                            | Spec tests prove the interval grows after an empty tick and resets after a non-empty one, and the boot tick still runs at once                                                                                                                                           | -                 | `cc:done`                                      |
| 2.4  | [lane:gate] [tdd:required] Add cheap observability: log or expose counters for claim queries/min, poll rounds/min and rows purged, so the next spike is visible                                                                                                                                                                                                                                                                      | A `/health`-style or log summary line prints once per N minutes. A test covers the counter increment                                                                                                                                                                     | 2.1               | `cc:done`                                      |
| 3.1  | [lane:gate] **Decision, needs the owner**: where should background work live? (a) keep it in the Vercel container with the tuning above; (b) set `OUTBOX_WORKER_ENABLED=false` on Vercel and drain from a small always-on host; (c) replace the server-side Bakong poll chain with **on-demand checks**: the checkout page's existing 5 s status call asks Bakong at most once per N seconds per attempt, plus one slow backstop job | A decision is recorded in `payment/providers/bakong/README.md` with the chosen option and the cost trade-off. Option (c) removes background payment cost while nobody is on the checkout page                                                                            | 0.1, 0.2          | `blocked`                                      |
| 3.2  | [lane:gate] [tdd:required] Implement the option chosen in 3.1                                                                                                                                                                                                                                                                                                                                                                        | Depends on the chosen option. At minimum: a paid KHQR is marked settled within the agreed latency in a manual end-to-end test, and an abandoned checkout produces no background work after expiry                                                                        | 3.1               | `blocked`                                      |
| 4.1  | [lane:fast] [tdd:skip:ui-timing] Web: back off the checkout fallback refresh (5 s → 10 s → 20 s), pause it while the tab is hidden, and read `use-e2e-backup.ts` to confirm its 20 s approvals poll is also visibility-gated                                                                                                                                                                                                         | `next build` passes. In a browser, the Network tab shows no checkout or approvals requests while the tab is hidden                                                                                                                                                       | -                 | `cc:done` (checkout) · `blocked` (backup hook) |
| 5.1  | [lane:release] Review and release: run `harness-review` over Phases 1–4 and note config changes in `CHANGELOG.md` `Unreleased`                                                                                                                                                                                                                                                                                                       | Review verdict is APPROVE, and the changelog lists new env defaults and the poll-chain change                                                                                                                                                                            | 2.1–2.4, 3.2, 4.1 | `cc:todo`                                      |

#### Run log (2026-10-24, `/harness-work all`)

- **Done and verified**: 2.1–2.5 and the checkout half of 4.1. Backend `jest`: 62 suites / 797 tests green. `eslint` is clean on every file touched. Web `tsc` and `eslint` are clean for the checkout page.
- **Not verified**: the SQL in `OutboxService.msUntilNextDue` has only run against a mock. There is no Postgres here (Docker daemon off, no `psql`), and the prod URL is a secret. A broken peek degrades to a plain claim, so it cannot strand rows, but it should be run once against the dev DB.
- **0.1 blocked**: the Vercel MCP can list projects (`phsar-backend`, `phsar-web-portal`) but reading project details or billing needs `authorize_team_access` for the account. Only the owner can approve that.
- **0.2 blocked**: it needs a read-only query on the production database, which means reading `DATABASE_URL` (a secret-read stop).
- **1.1 blocked**: changing production env vars needs the owner's explicit go-ahead. Code defaults already moved (`OUTBOX_POLL_INTERVAL_MS` 2000 → 30000, plus the new `PAYMENT_RECONCILE_IDLE_INTERVAL_MS`). The remaining env-only levers are `OUTBOX_WORKER_CONCURRENCY=2` and `BAKONG_POLL_INTERVAL_MS=8000`.
- **2.3 changed from plan**: retention stays **hourly**. Daily would not save anything (one cheap query/hour) and would cut the 50k-rows-per-sweep cap to 50k/day. Only the boot-time sweeps were removed.
- **3.1 / 3.2 blocked**: they need the owner's choice of option (a), (b) or (c).
- **4.1 backup hook, not edited**: `use-e2e-backup.ts` has uncommitted work. Its 60 s sync (upload plus pull) and 20 s approvals poll are **not** gated on tab visibility, and the new `E2eBackupProvider` mounts them in the app-wide layout, so every open tab polls. Gate on `document.visibilityState`, slow the approvals poll, or push it over the socket.
- **Not observed**: whether the chat WebSocket connects in production. If it does not, chat falls back to 3 s inbox polling for every signed-in user, which would dwarf the server-side findings.
- **5.1 pending**: no independent review has run; the self-review above is the only one.

**Classification**: Required: 0.1, 0.2, 1.1, 2.1, 2.2. Recommended: 2.3, 2.4, 3.1/3.2, 4.1. Optional: 5.1 changelog polish. Reject: lowering outbox _worker count_ alone (little effect), and removing the outbox for payments (it is the durability guarantee).

#### 事前確認

- 事項: external-send — change environment variables on the Vercel backend project and redeploy
  理由: Task 1.1 sets the outbox and Bakong poll intervals
  scope: Phase 1 / Task 1.1
- 事項: external-send — read Vercel usage and runtime logs through the Vercel MCP / dashboard
  理由: Task 0.1 identifies which limit was exceeded
  scope: Phase 0 / Task 0.1
- 事項: external-send — read-only SQL against the production database (`outbox_events`, `payment_attempts`)
  理由: Task 0.2 measures the actual row volume by event type
  scope: Phase 0 / Task 0.2

---

## Completed

<!-- Add tasks with cc:done or pm:approved here. -->

- [x] Introduce the Harness Plans.md workflow `pm:approved` (2026-10-24)

---

## Archive

<!-- Move older completed tasks here. -->

---

## Status Marker Legend

These markers are protocol values used by Harness tooling. Keep them unchanged
unless the project has tested parser aliases.

| Marker         | Meaning                                                     |
| -------------- | ----------------------------------------------------------- |
| `pm:requested` | PM requested work                                           |
| `cc:todo`      | Not started by Claude Code                                  |
| `cc:wip`       | Claude Code is working                                      |
| `cc:done`      | Claude Code completed the task and is awaiting confirmation |
| `pm:approved`  | PM confirmed completion                                     |
| `blocked`      | Blocked; include the reason next to the task                |

---

## Last Update

- **Updated at**: 2026-10-24
- **Last session owner**: Claude Code
- **Branch**: prod
