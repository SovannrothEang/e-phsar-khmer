# Payment module

Handles payment processing (talking to a gateway) and posts settled money
movement to an internal double-entry ledger. The two are deliberately kept
as separate table clusters — see [Architecture](#architecture) for why.

## Architecture

### The ledger boundary

A gateway integration is inherently messy: a card gets declined and retried,
a webhook arrives twice, a provider takes eleven seconds and the client
already gave up. That mess needs somewhere to live — it lives in the
**processing layer**. The **ledger** can't be messy: every transaction's
debits must equal its credits, nothing is ever edited in place (only
reversed with a new entry), and the record must read the same regardless of
which gateway or retry path produced it.

So the ledger is a separate cluster that is only written to once a
`payment_transaction` actually reaches a terminal success state — never
while it's still in flight.

| Layer      | Table                         | Purpose                                                                                                                            |
| ---------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Processing | `payment_transactions`        | One row per operation (payment / capture / refund / void). The seam: the only table the API queries directly.                      |
| Processing | `payment_attempts`            | One row per try against a provider. A transaction can have several (declined card, retried method, retried after timeout).         |
| Processing | `payment_status_history`      | Audit trail of every status transition on a transaction, and who/what caused it.                                                   |
| Processing | `payment_provider_events`     | Inbound webhook intake, deduped on `(provider, providerEventId)`. The provider's inbox — mirror image of `outbox_events`.          |
| Processing | `payment_transaction_details` | 1:1 satellite for bulky/sensitive provider payload (masked account, redirect URL, raw response) — keeps the hot table lean.        |
| Processing | `payment_logs`                | Free-form operational/debug trail. Distinct from `payment_status_history`, which only ever records a business-state change.        |
| Ledger     | `ledger_accounts`             | Chart of accounts — what an entry can post against (customer wallets, platform revenue, provider clearing, tax payable).           |
| Ledger     | `ledger_transactions`         | A posted (or reversed) unit of bookkeeping. Created once, when a `payment_transaction` settles.                                    |
| Ledger     | `ledger_entries`              | The debit/credit lines under a `ledger_transaction`; must net to zero per currency — enforced in the service layer, not by the DB. |

Full field-level definitions are in [`entity/`](./entity).

### Entity map

```mermaid
erDiagram
    payment_transaction ||--o{ payment_attempt : "has attempts"
    payment_transaction ||--o{ payment_status_history : "audit trail"
    payment_transaction ||--o| payment_transaction_detail : "extends (1:1)"
    payment_transaction ||--o{ payment_log : "processing logs"
    payment_transaction ||--o| ledger_transaction : "posts to, once settled"
    payment_attempt ||--o{ payment_provider_event : "webhook correlates to"
    payment_attempt ||--o{ payment_log : "attempt-scoped logs"
    ledger_transaction ||--|{ ledger_entry : "2+ balanced lines"
    ledger_entry }o--|| ledger_account : "posted against"
```

### Where the queue and the outbox fit

- **BullMQ `payments` queue** (`PAYMENT_QUEUE`, registered in
  `payment.module.ts` against the shared Redis connection from
  `app.module.ts`) is the async work queue for gateway calls and webhook
  handling — dispatching a `payment_attempt`, processing a
  `payment_provider_event`, retrying a failed attempt. Its retry policy
  (`PAYMENT_JOB_ATTEMPTS` / `PAYMENT_JOB_BACKOFF_MS` /
  `PAYMENT_WORKER_CONCURRENCY`) is BullMQ-side and independent of the
  outbox's own attempt budget.
- **The transactional outbox** (`outbox_events`, `src/outbox/`) is how a
  settled payment tells the rest of the system — e.g. an
  `payment.succeeded` / `payment.refunded` event that notifications or other
  modules subscribe to, written in the same DB transaction as the
  `payment_transaction` update. It is not for gateway-facing traffic; that's
  what `payment_provider_events` is for. **Not wired yet** — see
  [Current state](#current-state).
- **Notification emission is end-of-life only, and it's asymmetric with the
  outbox.** On the happy path, settlement writes an `outbox_event` _and_
  emits a notification — the outbox row is the durable "something happened"
  fact other modules can subscribe to later; the notification emit is the
  immediate "tell this user now" side effect. On the terminal-failure path
  there's no ledger posting, so there's no `outbox_event` either — failure
  notifications are emitted directly off the queue. A retryable failure
  (new `payment_attempt`, transaction still `pending`) never notifies; the
  transaction hasn't reached end-of-life yet.

### Balance invariant

Nothing in the schema enforces that a `ledger_transaction`'s entries sum to
zero per currency — a Postgres `CHECK` constraint can't see sibling rows.
This has to be a single service-layer write path that always inserts
debit/credit pairs inside one DB transaction.

## Lifecycle, end to end

```mermaid
sequenceDiagram
    participant Client
    participant PaymentsController
    participant BullMQ as BullMQ (payments)
    participant Provider
    participant Postgres
    participant Ledger as Ledger posting
    participant Notifier as Notification / Outbox

    Client->>PaymentsController: POST /payments
    PaymentsController->>Postgres: insert payment_transaction (pending)
    PaymentsController->>Postgres: insert payment_attempt (pending)
    PaymentsController->>BullMQ: enqueue attempt job
    PaymentsController-->>Client: 202 (transaction id)

    %% === Attempt processing ===
    BullMQ->>Provider: charge request
    Provider-->>BullMQ: sync response / redirect
    BullMQ->>Postgres: update payment_attempt (status, response)

    %% === Webhook path (async, possibly duplicated) ===
    Provider-->>PaymentsController: webhook (async)
    PaymentsController->>Postgres: insert payment_provider_event<br/>(dedupe on providerEventId)
    PaymentsController->>BullMQ: enqueue event-processing job

    %% === Event processing job ===
    BullMQ->>Postgres: insert payment_status_history

    alt Happy path (attempt succeeded)
        BullMQ->>Postgres: update payment_transaction<br/>(succeeded, completedAt)
        BullMQ->>Ledger: post settlement
        Ledger->>Postgres: insert ledger_transaction (posted)
        Ledger->>Postgres: insert ledger_entry x2 (debit + credit)
        Ledger->>Postgres: insert outbox_event (payment.succeeded)
        Ledger->>Notifier: emit notification (payment.succeeded)
    else Attempt failed (retryable)
        Note over BullMQ,Postgres: Loop back — create new payment_attempt<br/>(transaction stays pending)
        BullMQ->>Postgres: insert payment_attempt (pending)
        BullMQ->>BullMQ: enqueue new attempt job
    else Terminal failure (max attempts / hard fail / expired)
        BullMQ->>Postgres: update payment_transaction<br/>(failed / expired / cancelled)
        BullMQ->>Notifier: emit notification (payment.failed)
    end

    Note over Client,Notifier: Notification is emitted only when<br/>payment_transaction reaches end-of-life<br/>(happy or sad path)
```

Key properties this gives us:

- **Nothing in the ledger cluster is touched until the last step.** Retries,
  duplicate webhooks, and abandoned attempts all play out entirely inside
  the processing layer.
- **A `payment_transaction` never regresses out of a terminal state.** A
  refund or a void is a _new_ `payment_transaction` row (type `refund` /
  `void`), not a mutation of the original `payment` row — so the ledger
  always has one clean posting per operation.
- **Webhook idempotency is structural, not application logic.** The unique
  index on `(provider, providerEventId)` in `payment_provider_events` is
  what makes a duplicated webhook a no-op.
- **A retryable failure is invisible outside the processing layer.** It
  produces a new `payment_attempt` row and nothing else — no status
  history entry beyond the attempt itself, no notification, no ledger
  touch. Only a transition of the `payment_transaction` row itself (to
  `succeeded`, `failed`, `expired`, or `cancelled`) is end-of-life.
- **The notification fires exactly once per transaction, on exactly one of
  two paths.** Success routes through the ledger (outbox row + notify);
  terminal failure notifies directly off the queue, with no ledger or
  outbox involvement — there's nothing to post.

## Current state

| Piece                                     | Status                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| Entities (`entity/*.ts`)                  | Done — all 9 tables, wired into `src/db/schema/index.ts`, migrated.       |
| `PaymentsController` / DTOs / service     | Not started — controller is an empty stub.                                |
| BullMQ `payments` queue                   | Registered, no processor/consumer yet.                                    |
| Provider integration (gateway client)     | Not started.                                                              |
| Outbox integration (`payment.*` events)   | Not started.                                                              |
| Ledger posting service                    | Not started.                                                              |
| Notification emission (success / failure) | Not started — no `Notifier`/consumer exists; diagram is the target shape. |

## Open items

- `payment_transactions.tenantId` and `.orderId` are plain UUIDs with no FK
  — there's no `tenants` or `orders` table in this codebase yet.
- No admin/reporting surface for the ledger (e.g. a trial-balance view) —
  out of scope until the posting service exists.
- **Notification delivery mechanism is undecided.** The lifecycle diagram
  fixes _when_ a notification fires (once, at end-of-life, on either the
  success or terminal-failure path) but not _how_ — whether "Notifier" ends
  up being a consumer of `outbox_events`, a direct call from the queue
  processor, or its own module. The failure path in particular has no
  outbox row to key off, so it can't simply be "subscribe to the outbox."
