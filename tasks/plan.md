# Chat Module Production Architecture — Implementation Plan

**Status:** Proposed implementation plan (documentation task — no code changes in this task)
**Spec measured against:** `tasks/spec.md` (90 sections; untracked in git, read from `/mnt/d/Programming/workplace/psa-npic/tasks/spec.md`)
**Gap-analysis report:** `/home/admin/firstmate/data/psa-npic-spec-verification/report.md` (2026-09-02)
**Branch target:** `origin/main` (`adda2e1`) — REST-only chat. The WebSocket layer, outbox and queue modules exist only on the unmerged `rothh/feat/notifications` commit (`48e5009`) and on the divergent `feat/notifications` line (`33e1220`, dangling). Both are read as **reference implementations**, not merged wholesale.

---

## 0. Captain's decisions (settled — baked into this plan, not re-litigated)

1. **Durable publication = spec §25 Option C.** PostgreSQL is the primary/authoritative store for the command, idempotency and outbox publication intent, all committed in **one transaction** (transactional outbox). Message history _may_ later move to ScyllaDB behind an idempotent worker, but PostgreSQL remains the command/idempotency/outbox authority even then.
2. **Outbox = `eventType`-based shape** (`outbox_events`, the design on the divergent `feat/notifications` line at `33e1220`), and dispatch is **triggered by events** (enqueue wakeup) rather than an interval poll timer. A **bounded worker pool is still required**; only the _trigger_ is event-driven.
3. **Message ordering = `(createdAt, id)` where `id` is a monotonic bigint/serial** (not a random UUID), so ordering is deterministic, sortable, and supports gap detection / sequence-based resume.

---

## 1. Current state (condensed from the gap-analysis report)

### 1.1 `origin/main` (this branch's base — what the implementation starts from)

| Area                           | State                                                                                                                                                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chat                           | REST + polling only. `apps/backend/src/chat/{chat.controller,chat.service,chat.module,chat.types}.ts` + `dto/{send-message,query-chats,query-messages}.dto.ts`. 6 endpoints under `/api/v1/chats`.                                                |
| Schema                         | `apps/backend/src/db/schema/chat.schema.ts`: `conversations` (uuid PK, pair-unique + `user_a < user_b` CHECK, `lastMessageAt` timestamp(3)); `messages` (**uuid `defaultRandom()` PK**, `createdAt` timestamp(3), `readAt`, 3 CHECKs, 3 indexes). |
| Outbox / queue / notifications | **Absent.** No `src/outbox/`, `src/queue/`, `src/notifications/` directories.                                                                                                                                                                     |
| WS layer                       | **Absent.** No `@nestjs/platform-ws`, `ws`, or `@nestjs/websockets` in `apps/backend/package.json`.                                                                                                                                               |
| `main.ts`                      | No `enableShutdownHooks()`, no WS adapter (report §3, row §47 → "Violated" invariant I13).                                                                                                                                                        |
| Idempotency                    | Transport-level `IdempotencyMiddleware` only (body-hash, `apps/backend/src/common/middleware/idempotency.middleware.ts`) — **not** the spec's model; WS has nothing (report §3, rows §14/§13.2; invariant I2 violated).                           |
| Ordering                       | Keyset `(createdAt, id)` with **uuid tie-break** (report §3, row §15; invariant I8 "satisfied with caveat").                                                                                                                                      |
| Migrations                     | Latest is `0012_blushing_sentinel.sql` → the next migration on this base is **`0013`**.                                                                                                                                                           |

### 1.2 Reference implementations (read from the primary checkout, not merged)

- **`rothh/feat/notifications` = `origin/main` + `48e5009`** (verified `merge-base` = `adda2e1`): adds `chat.gateway.ts` (manual JWT auth from query/header/cookie, `send_message` → `ChatService.sendMessage` → direct in-process push), `connection-registry.ts` (in-process `Map`), `heartbeat.service.ts` (30 s ping sweep; **`lastPongAt` is set at connect and never updated → every socket force-closed ~60 s after connect**, report gap #2), a **topic-based** `outbox/` (`outbox_messages`) with a bounded pool of 5 + `Channel` capacity-1 wakeup + 1500 ms poll fallback + reclaim timer + `OnModuleDestroy` 10 s drain — **built but unmounted** (`app.module.ts` imports `QueueModule`, not `OutboxModule`; zero `enqueue`/`register` call sites), `utils/channel.ts` (bounded `Channel<T>`), migration `0013` (`outbox_messages`), `main.ts` + `WsAdapter`, `jwt-auth.guard.ts:13` `if (context.getType() === 'ws') return true;`, and chat-service hardening (UUID_RE cursor guard, structural `assertOwnedChatImagePath`, DB-clock `lastMessageAt` + monotonic-max watermark, `@Throttle` on send).
- **`feat/notifications` line (`33e1220`, dangling commit):** the **eventType-based** outbox the captain selected — `outbox_events` schema, `OutboxService` (`enqueue(executor, event)` with `onConflictDoNothing` dedupe, `claimDue`/`claimById` via `FOR UPDATE SKIP LOCKED` with claim-side stale-lease reclamation, `markPublished`/`markRetry`/`markFailed` with handler `redact()`), `OutboxDispatcher` (sequential batch, unregistered-type = retryable, retry-budget → `markFailed` + `onAbandoned`), `OutboxWorker` (recursive `setTimeout` poller, unref'd, in-flight drain), `OutboxRegistry` (duplicate registration throws), `outbox.types.ts`, `backoff.util.ts` (pure, unjittered — SKIP LOCKED claim order removes the thundering herd), config keys `OUTBOX_*`. **Wired and unit-tested on that line** (report §6 ambiguity #1: the two outboxes cannot both survive — the captain picked the eventType one).

### 1.3 What this plan deliberately does NOT do

- Do **not** merge `rothh/feat/notifications` wholesale: it carries the topic-based outbox, the heartbeat bug, no shutdown hooks, and an unmounted dispatcher. Its pieces are re-landed selectively below, in the new shapes.
- Do **not** introduce ScyllaDB, Redis, or a broker now (spec §3.2, §78, §90; see §5.3 deferral criteria).

---

## 2. Concept & architecture

### 2.1 The end-state

```text
                    REST client                 WebSocket client
                         |                             |
                         v                             v
              POST /chats/messages              /ws/chat (send_message)
                         |                             |
                         +------------+----------------+
                                      |
                                      v
                             ChatService.sendMessage
                                      |
         ┌────────────────────────────┴─────────────────────────────┐
         │  ONE PostgreSQL transaction (read committed, short)      │
         │   1. upsert conversations (find-or-create + recency bump)│
         │   2. INSERT messages (id = bigint identity,              │
         │      clientMessageId unique per (conversation, sender))  │
         │   3. INSERT outbox_events  (chat.message.sent,           │
         │      dedupeKey = message id)                             │
         │  all three commit atomically — or none do                │
         └────────────────────────────┬─────────────────────────────┘
                                      | commit
                          EventEmitter 'outbox.wakeup'  (local, non-durable)
                                      |
                                      v
                    OutboxWorker: N bounded workers (default 5)
                    claimDue → FOR UPDATE SKIP LOCKED → dispatch
                                      |
                                      v
                    chat.message.sent handler (registered via OutboxRegistry)
                                      |
                                      v
                    ConnectionRegistry (in-process now; Redis fan-out later)
                                      |
                                      v
                    push {type:'message.created'} to recipient sockets
                    (recipient offline ⇒ event marked published anyway;
                     recovery = client polls GET .../messages?after=cursor)
```

The same path serves REST and WS: the gateway's `send_message` calls the identical `ChatService.sendMessage` and never touches the recipient's sockets itself. There is exactly **one** delivery path, and it is event-driven (captain decision 2).

### 2.2 Why Option C (PostgreSQL command/idempotency/outbox authority) over A and B

Spec §25 offers three designs. The chosen one:

| Option                                             | Design                                                                                                                        | Rejected because                                                                                                                                                                                              |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — Scylla-native publication state                | Persist message + publication record in Scylla together                                                                       | Scylla has **no cross-partition transactions**: "message saved ⟺ publication-intent saved" cannot be made atomic. Loses the core invariant spec §4.6/§25 demand.                                              |
| B — durable broker/write protocol                  | Broker write participates in the message write path                                                                           | Reintroduces the **dual-write problem** (two systems, no shared transaction) and makes the broker a hard dependency of the hot send path.                                                                     |
| **C — PG as command/idempotency/outbox authority** | Command + idempotency + publication intent commit in one PG transaction; durable message written through an idempotent worker | **Chosen.** Maximizes correctness, not raw write throughput: `message saved ⟺ publication intent saved` holds atomically. Spec §25 explicitly names this design and requires documenting it — this plan does. |

Option C scales adequately here because PostgreSQL carries only **small, short-lived** command/idempotency/outbox rows (the outbox row is scrubbed/purged once published, §4.5), while the high-volume message history can move to ScyllaDB later **behind an idempotent worker** without disturbing the command authority. The trade-off — an extra hop before the durable message store sees the write — is the price of the atomic invariant, and it is explicitly accepted (spec §90: add a component only for a concrete capability; the capability here is _recoverable publication_, which the current code lacks entirely: report §3 rows §25/§70 — "built but dead outbox, send not transactional").

The state machine Option C "introduces" (spec §25) is the outbox `pending → processing → published | failed` lifecycle with retry/backoff and reclaim — specified in §4 (outbox), with reconciliation in §4.5.

### 2.3 Ordering model: `(createdAt, bigint id)`

Captain decision 3. The `messages.id` column changes from `uuid defaultRandom()` to **`bigint GENERATED ALWAYS AS IDENTITY`** (Drizzle `bigint(..., { mode: 'number' }).generatedAlwaysAsIdentity()`):

- **Monotonic:** identity values increase in insert order, so `(createdAt, id)` is a total order that is deterministic, sortable, and free of the UUID tie-break caveat in report invariant I8.
- **Sequence-based resume:** `GET /chats/:conversationId/messages?after={cursor}` already resumes after a boundary; with a monotonic id the boundary is meaningful across restarts and reconnects (spec §19's `lastReceivedSequence` becomes the cursor's `id` component).
- **Gap detection:** a global identity is monotonic **per conversation** (ids of one conversation's messages are strictly increasing) but **not contiguous**. Exact contiguity (`id ≠ prevId+1` ⇒ gap) would require a per-conversation `sequence` counter. That is deliberately deferred (spec §15: "prefer the weakest ordering guarantee that satisfies the product requirement"); see Open Question OQ-8.
- **Clock discipline:** `createdAt` keeps `precision: 3` (ms) so cursors round-trip through JS `Date` (existing comment in `chat.schema.ts`), and every ordering-relevant timestamp is written with the **DB clock** (`now()`/column defaults), never the Node clock — the rothh hardening already moved `conversations.lastMessageAt` this way.
- **`2^53` note:** Drizzle `mode: 'number'` maps int8 to JS number; safe up to 2^53 (~9×10¹⁵) messages — not a practical bound. Serialization stays a JSON number; revisit if ever approached (OQ-3).

**Migration recipe (Increment A, `0013`):** the column swap must preserve history order. (1) Add `id_new bigint`; (2) backfill in `(created_at ASC, id ASC)` order so existing rows keep their relative position — e.g. `UPDATE messages SET id_new = nextval('messages_id_new_seq')` driven by a `row_number() OVER (ORDER BY created_at, id)` window, then `setval` to the max; (3) drop the old uuid PK, drop the uuid column, rename `id_new → id`, attach the identity/sequence default, re-add the PK; (4) recreate `messages_conversation_created_idx` on the new column. Volume is tiny (chat is new), so a rebuild via `INSERT … SELECT` is an acceptable alternative; the invariant is that **relative order of existing rows is unchanged**.

### 2.4 What "durable accepted" means after this plan

Per spec §53 (failure matrix A–F) and invariants I1/I2/I6/I7:

- A send returns success only after the one transaction commits (message + outbox intent) — `I1` holds.
- The same `clientMessageId` repeated (network timeout, WS reconnect, mobile backgrounding) returns the **existing** message and enqueues nothing — `I2` holds.
- WS delivery is transient; a missed push is recovered by `after=` polling against Postgres — `I6`/`I7` hold (delivery nodes are never message stores, spec §16).
- A crashed worker leaves rows `processing` under a lease; the claim predicate reclaims them after `OUTBOX_LEASE_TIMEOUT_SECONDS` — no publication intent is ever orphaned (spec §52 "Worker crashes").

---

## 3. The three fixes, specified precisely

### 3.1 Fix 1 — Chat idempotency: `clientMessageId` on the send path (REST + WS)

**Affected files**

| File                                                                   | Change                                                                                               |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `apps/backend/src/chat/dto/send-message.dto.ts`                        | Add required `clientMessageId`.                                                                      |
| `apps/backend/src/db/schema/chat.schema.ts`                            | Add `clientMessageId` column + partial unique index.                                                 |
| `apps/backend/drizzle/migrations/0013_*.sql`                           | Add column + index (the ordering column swap in §2.3 shares this migration — see Increment A in §5). |
| `apps/backend/src/chat/chat.service.ts`                                | Wrap send in one transaction; conflict → return existing message.                                    |
| `apps/backend/src/chat/chat.types.ts`                                  | `sendMessage` return gains `duplicate: boolean`.                                                     |
| `apps/backend/src/chat/chat.controller.ts`                             | No route change (same `POST /chats/messages`).                                                       |
| `apps/backend/src/chat/chat.gateway.ts`                                | WS `send_message` sends the same DTO (field rides for free) + explicit ack.                          |
| `apps/web/actions/chat.ts`, `apps/web/components/chat/*` (rothh state) | Generate a UUID per pending message, keep it stable across retries/reconnect resends.                |
| `apps/backend/src/chat/chat.service.spec.ts` (+ integration)           | New idempotency tests (§8).                                                                          |

**Schema**

```ts
// chat.schema.ts — messages table
clientMessageId: varchar('client_message_id', { length: 64 }),
// table extra:
uniqueIndex('messages_client_msg_id_uq')
  .on(t.conversationId, t.senderId, t.clientMessageId)
  .where(sql`client_message_id is not null`),
```

- The column is **nullable in the DB** (legacy rows have no value; there is nothing to backfill) but **required by the DTO** — every new message carries one, and the partial index is exactly the captain's shape. The `WHERE ... IS NOT NULL` clause keeps legacy NULLs out of the uniqueness domain (same pattern as `users_username_active_uq` in `apps/backend/src/db/schema/users.schema.ts:112-114`).
- DTO validation: `@IsString() @IsNotEmpty() @Matches(/^[A-Za-z0-9._:-]{8,64}$/)`. Clients generate `crypto.randomUUID()`.

**Service logic (the whole send becomes one transaction)**

```text
validate (self / content / imagePath via assertOwnedChatImagePath)
load recipient, block state, listing context      (reads, before or inside tx)
db.transaction(async tx => {
  upsert conversations (onConflictDoUpdate, lastMessageAt = now())     — unchanged
  INSERT messages (..., clientMessageId)
    .onConflictDoNothing({
      target: [conversationId, senderId, clientMessageId],
      targetWhere: sql`client_message_id is not null`,   // matches the partial index
    })
    .returning()
  if row returned:
      monotonic-max watermark update (existing rothh logic, inside tx)
      OutboxService.enqueue(tx, chat.message.sent event)   — see §4
      duplicate := false
  else:
      SELECT the existing row by (conversationId, senderId, clientMessageId)
      duplicate := true        // no watermark bump, no outbox row: never re-publish
})
wakeupAfterCommit()            // only when a row was created
return { conversationId, message, duplicate }
```

Why this is safe: `ON CONFLICT DO NOTHING ... RETURNING` makes the winner/loser split **atomic** — no check-then-insert race, no 23505 exception handling. The loser's follow-up `SELECT` runs after the winner's commit is visible (READ COMMITTED snapshot per statement), so it returns the winner's message. The loser enqueues **no** outbox event: the duplicate never re-delivers (invariant I2 end-to-end, including fan-out).

**REST:** unchanged route; the transport-level `Idempotency-Key` middleware remains as an orthogonal layer (body-hash based; its known completed-hash gap is a separate ticket and does not block this).

**WebSocket:** `send_message` envelope stays `{ payload: SendMessageDto }` — the new required field propagates. The gateway must **ack the sender** (rothh only pushes to the recipient): reply `{ type: 'message.ack', clientMessageId, message }`. On reconnect/timeout the client resends the _same_ `clientMessageId` and receives the same message; the `duplicate` flag lets the UI reconcile (dedupe by message `id` client-side regardless).

**Note on interplay with §4 (outbox):** idempotency and the outbox enqueue are entangled by design — the outbox event is enqueued **only on the created path**, inside the same transaction. Fix 1 ships before the outbox (§4) with the enqueue line absent; §4 adds exactly that line. The transaction boundary is introduced here.

### 3.2 Fix 2 — WebSocket heartbeat: update `lastPongAt` on client pong

Reference: `apps/backend/src/chat/heartbeat.service.ts:18` (rothh state) reads `conn.lastPongAt` which is set **only** at connect (`chat.gateway.ts:46`: `lastPongAt: Date.now()`). The sweep closes any socket with `now - lastPongAt > 30s + 10s`, so every connection is force-closed on the second sweep (~60 s after connect) — report gap #2.

**Fix (in `apps/backend/src/chat/chat.gateway.ts`, `handleConnection`):**

```ts
const conn = { socket, userId: claims.sub, lastPongAt: Date.now() };
this.registry.add(claims.sub, conn);
// The ws library emits 'pong' for every protocol pong frame the client
// sends (browsers auto-reply to server pings) — this line is the fix:
socket.on("pong", () => {
  conn.lastPongAt = Date.now();
});
```

- `HeartbeatService` keeps its 30 s ping / 40 s deadline sweep; with the update, only genuinely dead peers get closed.
- Replace `(socket as any)._conn` with an explicit `Map<WebSocket, ConnectionInfo>` (or symbol-keyed field) so the `pong` listener and `handleDisconnect` share a typed handle and the listener is removed on disconnect (no leak across reconnects).
- Test: a gateway/h heartbeat unit test driving a fake socket — emit `pong` at t=35 s, assert not closed at the 60 s sweep; without pong, assert closed. (The sweep currently has no tests at all — report §3 row §58: outbox/WS zero tests.)

### 3.3 Fix 3 — Graceful shutdown

Reference state: `main.ts` (worktree) has no `enableShutdownHooks()`; `HeartbeatService`'s `setInterval` is never cleared; no gateway destroy hook; the outbox dispatcher's `OnModuleDestroy` exists but is unmounted — report invariant **I13 violated**.

| File                                               | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/backend/src/main.ts`                         | `app.enableShutdownHooks()` after `await app.listen(...)` (Nest lifecycle events docs; triggers `onModuleDestroy`/`beforeApplicationShutdown` on SIGTERM/SIGINT, then closes HTTP + WS servers).                                                                                                                                                                                                                                                                       |
| `apps/backend/src/chat/heartbeat.service.ts`       | Store the interval id; add `OnModuleDestroy` → `clearInterval`.                                                                                                                                                                                                                                                                                                                                                                                                        |
| `apps/backend/src/chat/chat.gateway.ts`            | Add `OnModuleDestroy`: close every registered socket with code `1001` ("going away"), then clear the registry.                                                                                                                                                                                                                                                                                                                                                         |
| `apps/backend/src/outbox/outbox-worker.service.ts` | Drain: set `stopped`, clear timers, `channel.complete()`, await in-flight dispatches under a 10 s grace (`Promise.race` + log on timeout — rothh's `SHUTDOWN_GRACE_MS` pattern, `outbox.dispatcher.ts:59-116`). Rows still `processing` at exit are reclaimed by another instance via the stale-lease claim predicate — **graceful drain is best-effort by design; durability comes from the outbox, not from finishing the drain** (spec §47 + §52 "Worker crashes"). |
| `apps/backend/src/app.module.ts`                   | Import `EventEmitterModule.forRoot()` + `OutboxModule` (replaces the empty `QueueModule` placeholder — delete `apps/backend/src/queue/queue.module.ts`).                                                                                                                                                                                                                                                                                                               |

Shutdown order (spec §47): gateway stops WS intake and closes sockets → heartbeat interval cleared → outbox worker drains → Nest closes stores. Nest runs `onModuleDestroy` hooks in reverse module-init order; the gateway/worker hooks are all idempotent so exact ordering between them is not load-bearing.

---

## 4. The outbox, specified precisely (captain decision 2)

### 4.1 Schema — `outbox_events` (eventType-based, verbatim design from `33e1220`)

New file `apps/backend/src/db/schema/outbox.schema.ts`, re-exported from `apps/backend/src/db/schema/index.ts`:

- `outbox_events` table, exactly the `33e1220` shape (migration `0014_salty_unus.sql` on that line): `id uuid defaultRandom()` (**= the integration event id — consumers dedupe on this**), `eventType varchar(80)` (free text, dotted namespace `chat.message.sent`; deliberately not a pgEnum so a new event type is a code change, not a migration), `aggregateType varchar(40)`, `aggregateId uuid`, `dedupeKey varchar(200)` + `uniqueIndex` (NULLs distinct), `payload jsonb`, `status` enum `outbox_event_status('pending','processing','published','failed')`, `attempts`, `maxAttempts` (default 5), `availableAt` (backoff gate), `lockedAt`/`lockedBy` (lease), `lastError`, `publishedAt`, `createdAt`. Indexes: `(status, availableAt)` claim index, `(aggregateType, aggregateId)`, dedupe unique, plus **one addition for retention**: `index('outbox_events_published_at_idx').on(t.publishedAt).where(sql\`status in ('published','failed')\`)`.
- The captain's event-driven trigger does **not** change the schema; it changes only how the worker is woken (§4.3).

### 4.2 Module files (new `apps/backend/src/outbox/`)

Ports from `33e1220` (the wired, tested line) — these files exist there and are unit-tested; they are re-landed onto `origin/main` with the worker architecture swapped per §4.3:

| File                           | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ----------------------------------------------------------------------------- |
| `outbox.module.ts`             | Providers/exports `OutboxService`, `OutboxRegistry`, `OutboxDispatcher`, `OutboxWorker`. **Not `@Global()`** — importing it is an architectural choice, visible in `ChatModule` (comment in `33e1220` preserved).                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `outbox.types.ts`              | `TxClient`/`DbExecutor`, `IntegrationEvent`, `HandlerOutcome {published                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | retry | failed}`, `OutboxHandler {handle, onAbandoned?, redact?}`, `DispatchOutcome`. |
| `outbox.service.ts`            | `enqueue(executor, event)` (`onConflictDoNothing` on `dedupeKey`, return existing on miss); `claimDue(limit)` = `UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED ...)` with the due predicate `(pending AND availableAt <= now()) OR (processing AND lockedAt < now() - lease)` — **claim-side stale-lease reclamation** (crashed-dispatcher recovery needs no separate reclaim timer); `claimById` (inline fast-path); `markPublished(eventId, redactedPayload)`, `markRetry(eventId, error, delayMs)` (sets `availableAt` forward), `markFailed`; `instanceId` = `hostname:pid:uuid8` lease attribution. All timestamps via `sql\`now()\`` (DB clock). |
| `outbox-registry.service.ts`   | `Map<eventType, OutboxHandler>`; `register` throws on duplicate; `get`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `outbox-dispatcher.service.ts` | `dispatchDue(limit)` (sequential batch — a batch usually targets one provider, firing it concurrently is how you get rate-limited); `dispatchById(eventId)` (inline claim-or-null); `run`: unregistered type ⇒ `retry` (rolling-deploy safe — producer may ship before consumer); thrown handler ⇒ `retry`; `settle`: `published` ⇒ `markPublished(+ redact)`, `failed` ⇒ `markFailed`, `retry` with `attempts >= maxAttempts` ⇒ `markFailed` + `handler.onAbandoned`; else `markRetry` with `computeBackoffMs`.                                                                                                                                                   |
| `backoff.util.ts`              | `computeBackoffMs(attempts, {baseMs, factor, maxMs})` — pure, **unjittered** (SKIP LOCKED claim order removes the herd; `33e1220` comment preserved).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `outbox-events.ts`             | `OUTBOX_WAKEUP_EVENT = 'outbox.wakeup'`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `outbox-wakeup.listener.ts`    | `@OnEvent(OUTBOX_WAKEUP_EVENT)` → `channel.tryWrite(WAKE)` (capacity-1: a full buffer means a wakeup is already pending — coalescing, spec §64).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `outbox-worker.service.ts`     | Bounded worker pool + event-driven trigger (§4.3).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

`apps/backend/src/utils/channel.ts` is ported unchanged from `rothh/feat/notifications` (bounded `Channel<T>`, spec §29: in-memory = execution mechanism only; all work is recoverable from `outbox_events`).

### 4.3 Worker: event-driven trigger, bounded pool

The captain's rule: **trigger by events, keep the bounded pool.** Synthesis of the two reference designs — `33e1220`'s schema/service/registry with the wakeup-channel + worker-pool architecture of rothh's dispatcher (which `33e1220` replaced with a single sequential `setTimeout` worker):

- **Pool:** `N = OUTBOX_WORKER_CONCURRENCY` (default 5) concurrent worker loops; each loop: wait for wakeup **or** poll-fallback timeout → `dispatcher.dispatchDue(OUTBOX_BATCH_SIZE)` → repeat. A full batch loops immediately (backlog drain); otherwise back to waiting.
- **Trigger:** producer calls `OutboxService.wakeupAfterCommit()` (EventEmitter, local non-durable — spec §30's exact permitted use) **after the transaction commits**; the listener writes the capacity-1 wakeup token.
- **Poll fallback (kept deliberately):** `OUTBOX_POLL_INTERVAL_MS` (default 2000) is the safety net for a lost wakeup (EventEmitter is non-durable by rule §30) and the steady-state heartbeat that picks up rows whose `availableAt` backoff expired while nothing new enqueued. The captain's decision removes the _interval as the trigger_; it does not forbid the fallback.
- **Boundedness (invariant I11):** capacity-1 channel, fixed pool, batch cap — memory is `O(N + batch)`; durable backlog lives in `outbox_events`, never in RAM.
- **Shutdown:** §3.3 drain.

### 4.4 Config (`apps/backend/src/config/configuration.ts` + `config.validation.ts`)

`33e1220` key set + one new key, all defaulted:

```text
OUTBOX_WORKER_ENABLED        = true       (false ⇒ API-only instance, no drainer)
OUTBOX_WORKER_CONCURRENCY    = 5          (NEW — the bounded pool size)
OUTBOX_POLL_INTERVAL_MS      = 2000
OUTBOX_BATCH_SIZE            = 10
OUTBOX_MAX_ATTEMPTS          = 5
OUTBOX_LEASE_TIMEOUT_SECONDS = 60         (must exceed slowest handler; channel timeout 5 s)
OUTBOX_BACKOFF_BASE_MS       = 1000
OUTBOX_BACKOFF_FACTOR        = 5
OUTBOX_BACKOFF_MAX_MS        = 900000
OUTBOX_RETENTION_DAYS        = 7          (NEW — retention sweep, §4.5)
```

### 4.5 Producer + handler: `chat.message.sent`

**Producer** (in `ChatService.sendMessage`, the created path of Fix 1's transaction):

```ts
outbox.enqueue(tx, {
  eventType: "chat.message.sent",
  aggregateType: "conversation",
  aggregateId: conversationId,
  dedupeKey: `chat.message.sent:${message.id}`, // one event per message, ever (stringified bigint)
  payload: {
    messageId: message.id,
    conversationId,
    senderId,
    recipientId: dto.recipientId,
    createdAt: message.createdAt,
    schemaVersion: 1, // spec §56/§57
  },
});
```

**Handler** (`ChatMessageSentHandler` in the chat module, registered via `OutboxRegistry.register` in `onModuleInit`): push `{ type: 'message.created', eventId, schemaVersion, payload: message }` to every socket in `ConnectionRegistry.connectionsFor(recipientId)`. Semantics (spec §49/§63):

- Recipient offline ⇒ still return `{ status: 'published' }` — delivery is a **transient real-time signal**; the durable message + the `after=` poll are the recovery path. Never retry-forever on "recipient offline".
- `socket.send` throwing ⇒ `{ status: 'retry', error }` (transient), bounded by the outbox budget → `failed` + alert. `redact()` strips nothing here (no secrets in the payload) but the hook exists.
- Consumer idempotency (spec §27): event id = message id; the WS client dedupes on message `id`; a future durable consumer records `eventId` before acting. The outbox `dedupeKey` guarantees the event itself is never double-enqueued (report §3 row §27).

**Retention/reconciliation (§50/§81):** a scheduled sweep deletes `published`/`failed` rows older than `OUTBOX_RETENTION_DAYS` (uses the new index). Crash recovery needs no job — it is the claim-side stale-lease predicate. A periodic "stuck `processing` older than lease" alert completes the loop (report gap #7).

### 4.6 Observability (report gap #13; spec §43-45)

Emit at least: `chat_messages_accepted_total{duplicate}`, `chat_message_write_latency`, `outbox_backlog` (pending gauge), `worker_queue_depth`, `outbox_events_failed_total`, `idempotency_duplicates_total`, `websocket_connections`, `message_delivery_latency`. Structured logs per §44 shape (operation/requestId/actorId/conversationId/messageId/clientMessageId/eventId/durationMs; never bodies). Health: keep `GET /health`; add liveness/readiness split + Postgres dependency probe (spec §46). Alerts per §77 (backlog growth, reclaim storm, duplicate spike). This is Increment D — listed here because the outbox is the natural instrumentation point.

---

## 5. Incremental migration path (spec §78-79)

Each increment is independently deployable and observable. **Lands first: the Postgres-only transactional outbox + idempotency + ordering** (captain's explicit sequencing). **Deferred until measured load justifies:** Scylla, Redis, broker, scale-out.

| Increment                                                    | Spec mapping                                      | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Deploy gate                                                                                                              |
| ------------------------------------------------------------ | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **A — ordering + idempotency (REST-only)**                   | Slices 1 + 3 (of §79)                             | The §2.3 ordering change + Fix 1: `messages.id` → bigint identity, `clientMessageId` + partial unique index, single-transaction send (no outbox line yet), cursor guards. Migration **`0013`** on this base (column + index + id swap). Adopt the rothh hardening that ships regardless (report §5 "work that should ship": UUID_RE→numeric cursor guard, structural `assertOwnedChatImagePath`, DB-clock `lastMessageAt` + monotonic-max watermark, `@Throttle` on send). Web client sends `clientMessageId` in the same release. | Unit + integration tests; API contract note: message `id` becomes a JSON number, `clientMessageId` required.             |
| **B — outbox + event-driven delivery (still Postgres-only)** | Slice 6 (durable delivery/recovery), §25 Option C | §4: `outbox_events` migration (`0014`), `OutboxModule` (+ `EventEmitterModule`, delete empty `QueueModule`), wakeup + bounded pool, `chat.message.sent` producer + in-process handler + `ConnectionRegistry` (no gateway yet — registry is empty, handler publishes immediately). Retention sweep + core metrics.                                                                                                                                                                                                                  | Dispatcher/handler unit tests (ported `33e1220` suites); e2e: enqueue inside tx, worker drains, duplicate key collapses. |
| **C — WebSocket layer + heartbeat + shutdown**               | Slice 7 (single-node), §16-19, §47                | Port gateway/registry/heartbeat with Fix 2 (pong update) + Fix 3 (shutdown hooks) + `WsAdapter` in `main.ts` + WS ack contract (§3.1). Delivery stays exclusively via the outbox handler — the gateway never pushes directly (single delivery path).                                                                                                                                                                                                                                                                               | Gateway/heartbeat unit tests; manual e2e with a real ws client (reconnect, heartbeat survival > 60 s, SIGTERM drain).    |
| **D — observability + ops hardening**                        | §43-46, §77, §81                                  | Metrics/logging/health split/alerts; reconciliation + retention verification; WS auth hardening decision (OQ-4); per-connection rate limit if product chose it.                                                                                                                                                                                                                                                                                                                                                                    | Dashboard + alert runbook.                                                                                               |

Spec-phase mapping: Increments A–C ≈ **Phase 2** (strong boundaries, idempotent commands, observability) executed on Postgres-only, with the outbox brought forward from Phase 4 because it is a prerequisite of idempotent delivery; **Phase 1's Redis is intentionally deferred** (captain: introduce components only for measured need — spec §90, §87 minimal architecture, §3.2).

### 5.3 Explicitly deferred (with revisit triggers)

| Deferred item                                                              | Spec ref                       | Revisit when                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Redis: presence, typing, rate limits, connection registry, Pub/Sub fan-out | §11, §17-18, §23, Slices 4 + 7 | Second WS node is deployed, or measured per-IP throttle abuse / reconnect storms. Note: `ConnectionRegistry` is in-process — **single-instance is a documented hard constraint** until then (report gap #10).                         |
| ScyllaDB message history                                                   | §10, §37, Slice 5              | PG message table growth/hot-partition evidence; then Option C phase 2: PG keeps command/idempotency/outbox authority, an idempotent worker writes Scylla, with dual-write reconciliation per §80-81 (never a silent secondary write). |
| Durable broker (Kafka/NATS/…), search, analytics, audit                    | §49, §74-76                    | A second _durable_ consumer appears that needs replay/backlog. Redis Pub/Sub alone suffices for transient fan-out (§49 left column).                                                                                                  |
| Per-conversation `sequence` column                                         | §15/§19/§20 conflict           | Exact per-conversation gap detection is a product requirement (OQ-8); the bigint id already enables `after=` resume.                                                                                                                  |
| Redis-backed throttler                                                     | §23                            | Multi-instance or per-user keying decision (OQ-5).                                                                                                                                                                                    |

---

## 6. Architecture Decision Records (spec §84)

**Placement decision:** ADR-004/005/006 are drafted inline here (they are load-bearing for this plan). The full set ADR-001..009 should exist per spec §84; 001–003, 007–009 are recorded below as stubs/decisions with their "Revisit When" clause, and are extracted to `docs/adr/` when the implementing change lands (this task adds no files beyond `tasks/plan.md`).

| ADR | Title                                                             | Status in this plan                                                                                           |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 001 | PostgreSQL ownership (users/conversations/membership/permissions) | Implicit in code; draft with Increment A.                                                                     |
| 002 | ScyllaDB message storage                                          | **Decision: deferred** — Option C phase 2 (§5.3); record the trigger.                                         |
| 003 | Redis ephemeral state                                             | **Decision: deferred** — record the trigger.                                                                  |
| 004 | Message ordering                                                  | **Drafted below.**                                                                                            |
| 005 | Message idempotency                                               | **Drafted below.**                                                                                            |
| 006 | Event/delivery mechanism                                          | **Drafted below.**                                                                                            |
| 007 | WebSocket fan-out                                                 | Decision: in-process registry + outbox-driven push now; Redis Pub/Sub when >1 node (revisit trigger in §5.3). |
| 008 | Reconnect/gap recovery                                            | Decision: `after=` cursor against Postgres now; sequence-based resume when ADR re sequence lands.             |
| 009 | Partition strategy                                                | N/A until ADR-002 is adopted; triggers §5.3.                                                                  |

---

### ADR-004 — Message ordering

**Context.** Conversation history must have a deterministic, paginatable order, and reconnecting clients must be able to resume exactly where they left off. The current order is keyset `(createdAt desc/asc, id)` with a random UUID tie-break (spec §15, §19, §38; report §3 row §15 — invariant I8 "satisfied with caveat").

**Decision.** Message order is `(createdAt, id)` where `id` is a **monotonic `bigint IDENTITY`** generated by Postgres (Drizzle `mode: 'number'`). `createdAt` stays `timestamp(3)` written by the DB clock. Pagination stays keyset `(eq/lt/gt, id)` with `limit+1` (no OFFSET — spec §38, §86). A per-conversation `sequence` counter is **not** added now.

**Why.** It is the weakest mechanism that satisfies the product requirement (spec §15): deterministic total order, stable cursors, `after=<cursor>` resume across reconnects and restarts. The identity is co-located with the row, needs no counter table or locking, and cannot regress. A separate per-conversation `sequence` would add a contended counter (or gap-tolerant generation) for a guarantee (contiguity/gap detection) that no current consumer needs.

**Alternatives rejected.** (a) Keep UUID ids — the tie-break is arbitrary and carries no resume semantics. (b) Per-conversation `sequence` from a counter table — serializes writers per conversation; reject until exact gap detection is demanded. (c) Timestamp-only — rejected in the spec itself (clock skew, equal ms).

**Consequences.** Easier: deterministic ordering, gap-tolerant resume, simpler cursors. Harder: message ids are no longer UUIDs (API contract change, web types update); `2^53` numeric bound (not practical; OQ-3). Ordering is **global-monotonic per conversation but non-contiguous** — consumers must not assume `prevId + 1`.

**Failure behavior.** Identity generation cannot fail independently of the insert. If Postgres is down, the send fails before any claim of success (invariant I1 preserved).

**Operational cost.** None beyond the migration (ordered backfill — recipe in §2.3).

**Revisit when.** A product requirement for exact per-conversation sequence (gap detection, message-edit versioning across stores) appears — then add `conversation_sequences` or a sequence column, keeping `(createdAt, id)` as the stable sort key.

---

### ADR-005 — Message idempotency

**Context.** Clients retry sends after network timeouts, WS reconnects and mobile backgrounding (spec §14). Today there is no chat-level idempotency: REST relies on the transport `Idempotency-Key` body-hash middleware, WS has nothing, and invariant I2 ("repeating clientMessageId ⇒ no duplicate") is **violated** (report §4.1).

**Decision.** `clientMessageId` is a **required** field on `SendMessageDto` (REST + WS — one DTO). Uniqueness is a **partial unique index** `(conversationId, senderId, clientMessageId) WHERE client_message_id IS NOT NULL` on `messages` itself — the message row **is** the idempotency record (no separate command table). The send path runs in one transaction: `INSERT ... ON CONFLICT DO NOTHING ... RETURNING`; a conflict returns the existing message with `duplicate: true` and enqueues **no** outbox event.

**Why.** A DB unique index is the only idempotency that survives restarts and multi-instance races (spec §14: "must be durable; do not use an in-memory Set"). Making the message row the record avoids a second table and a second write. `ON CONFLICT DO NOTHING` gives the winner/loser split atomically, with no TOCTOU and no exception path. Scoping to `(conversation, sender)` lets two senders reuse the same client id safely and pins the key to what the sender can control.

**Alternatives rejected.** (a) Transport `Idempotency-Key` middleware as the only mechanism — body-hash based, not the spec's `(actorId, conversationId, clientMessageId)` model, has a known completed-hash gap, and cannot cover WS. (b) A separate `message_commands` idempotency table — more moving parts for the same guarantee today; it becomes the natural seam **when** message history moves to Scylla (Option C phase 2: the command/idempotency record stays in Postgres, the history row moves). (c) In-memory dedupe — rejected by the spec.

**Consequences.** Easier: retries are safe on both transports; duplicate detection is free (index lookup is the INSERT itself). Harder: clients must generate and retain ids per pending message (web: `crypto.randomUUID()` kept across reconnect resends); the DTO is stricter (old clients without the field get 400 — accepted: the web client ships in the same release).

**Failure behavior.** Postgres down ⇒ send fails (no idempotency check possible — fail closed). Conflict ⇒ return the existing message, never re-publish.

**Operational cost.** One index; `idempotency_duplicates_total` counter to watch for retry storms (spec §77).

**Revisit when.** Message history moves to Scylla (extract a Postgres `message_commands` idempotency table that survives the history migration); or a product need to treat a missing `clientMessageId` as acceptable (relax DTO to optional — the nullable column + partial index already tolerate it).

---

### ADR-006 — Event/delivery mechanism

**Context.** Spec §25 requires choosing a durable-publication design so "message saved but event lost" cannot happen. The codebase has two unmerged outbox implementations (topic-based `outbox_messages`, unmounted; eventType-based `outbox_events`, wired on the divergent line) — report §6 ambiguity #1 — and no chat producer. Spec §30/§29 bound what EventEmitter/`Channel` may be used for.

**Decision.** **Transactional outbox in PostgreSQL, Option C** (§2.2): the send transaction writes `messages` + `outbox_events` atomically. Shape = **eventType-based `outbox_events`**. Dispatch = **bounded worker pool (default 5) triggered by an enqueue wakeup** (EventEmitter, capacity-1 coalescing channel), with a poll fallback and claim-side stale-lease reclamation. `chat.message.sent` is the first event; its handler pushes to recipient sockets via the in-process registry and marks `published` even when the recipient is offline.

**Why.** Option C is the only design where `message saved ⟺ publication intent saved` holds atomically (§2.2). The eventType shape decouples producers from consumers (registry, dotted namespaces, rolling-deploy-safe missing handlers) and was already wired+tested on `33e1220`. Event-driven trigger removes steady-state polling latency; the bounded pool keeps invariant I11 and handler rate-limiting sane. Local EventEmitter for the wakeup is exactly spec §30's permitted use — the durable source of truth is the outbox row, so a lost wakeup is recovered by the poll fallback (spec §29: in-memory queues are execution mechanisms, never durable).

**Alternatives rejected.** (a) Option A (Scylla-native) — no cross-partition transactions (§2.2). (b) Option B (broker) — dual-write problem, broker as hot-path dependency. (c) Topic-based `outbox_messages` with its separate reclaim timer and terminal-on-missing-handler semantics — superseded by the eventType design the captain selected. (d) Direct gateway push (current rothh style) — not durable, not event-driven, couples gateway to delivery. (e) Interval-only polling — rejected by captain decision 2 (latency + needless wakeups).

**Consequences.** Easier: recoverable publication, idempotent consumers (event id = message id), one delivery path for REST + WS, multi-instance-safe draining (`FOR UPDATE SKIP LOCKED`). Harder: an async hop between send and push (accepted Option C trade-off); the worker pool is per-instance (fine: claims are atomic, N instances drain N× faster).

**Failure behavior.** Dispatcher crash ⇒ lease expires ⇒ another instance reclaims. Missing handler ⇒ retryable, budget-bounded, ends `failed` + `onAbandoned` + alert. EventEmitter loss ⇒ poll fallback. Postgres down ⇒ send fails atomically.

**Operational cost.** `outbox_events` grows with traffic — retention sweep + backlog gauge required (§4.5/§4.6).

**Revisit when.** A second durable consumer with replay/backlog needs appears (add a broker **downstream of** the outbox — the outbox remains the publication authority); or handler fan-out must cross nodes (swap the in-process registry for Redis Pub/Sub subscription on the same event).

---

## 7. Open questions / remaining product decisions

| #     | Question                                       | Options                                                                                                                                                                                                       | Notes                                                                                                                                                          |
| ----- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OQ-1  | Read-state model                               | (a) Keep per-message `readAt` + `max(readAt)` watermark (current); (b) move to `read_cursors(last_read_sequence)` per spec §20                                                                                | Spec prefers cursors but the current model satisfies the same query; decide before group channels (report §6 #4). No code change either way in increments A–C. |
| OQ-2  | `clientMessageId` for legacy/3rd-party clients | (a) Required (400 when missing) — this plan's default; (b) optional (no idempotency protection when absent)                                                                                                   | Column is nullable + partial index either way, so relaxing later is a DTO-only change.                                                                         |
| OQ-3  | `messages.id` wire format                      | (a) JSON number (this plan's default; safe to 2^53); (b) string-serialized bigint                                                                                                                             | Pick (a) now; (b) is a breaking change later, so decide before first public API freeze.                                                                        |
| OQ-4  | WS auth hardening                              | (a) Ship rothh's manual `JwtService.verify` + the `jwt-auth.guard.ts` ws bypass as-is; (b) verify the token through `JwtStrategy.validate` semantics (reject soft-deleted users) or a dedicated `WsAuthGuard` | REST rejects soft-deleted users at `JwtStrategy.validate`; WS currently would not (report gap #8). Recommend (b); needs auth-module refactor scope.            |
| OQ-5  | Rate-limit keying                              | (a) per-user (needs user-id resolution + likely Redis for multi-instance); (b) per-IP (current, NAT-shared budget documented)                                                                                 | Report §6 #6; the redis-backed throttler from the `fm/psa-npic-rate-limit-redis-outbox` line exists as reference. Not blocking increments A–C.                 |
| OQ-6  | WS connection-attempt limits (spec §23)        | Threshold + window + failure behavior (e.g. 10 attempts/min/IP ⇒ 429/close 4008)                                                                                                                              | None exists today; pick numbers with product.                                                                                                                  |
| OQ-7  | Retention windows                              | `outbox_events` (proposed 7 d), `idempotency_keys` (existing table — currently unbounded, report gap #7), chat images in storage                                                                              | Ops/product decision; defaults proposed in §4.5.                                                                                                               |
| OQ-8  | Per-conversation `sequence` now vs later       | Deferred per ADR-004; revisit trigger = exact gap-detection requirement                                                                                                                                       | Spec §15/§19/§20 internal tension documented (report §6 #3).                                                                                                   |
| OQ-9  | Scylla cutover thresholds                      | Message-table size / hot-conversation p95 evidence that triggers ADR-002 adoption                                                                                                                             | Captain: "deferred until measured load justifies it" — the measurement is OQ-9's deliverable.                                                                  |
| OQ-10 | Offline/notification semantics                 | Should `chat.message.sent` also feed push notifications (APNs/…)?                                                                                                                                             | The outbox makes this a new handler, not a chat change; coordinate with the notifications module later.                                                        |

---

## 8. Test gates & rollout checklist (per increment)

- **A:** `chat.service.spec.ts` extended: duplicate `clientMessageId` returns the same row + `duplicate: true`; duplicate enqueues nothing (assert no outbox call); concurrent same-id (integration, two parallel sends → one row); cursor round-trip with numeric ids; numeric cursor guard rejects garbage. Property-ish invariant (spec §59): "same clientMessageId twice ⇒ one logical message."
- **B:** port `33e1220`'s outbox suites (`outbox.service.spec.ts`, `outbox-dispatcher.service.spec.ts`, `outbox-worker.service.spec.ts`, `outbox-registry.service.spec.ts`, `backoff.util.spec.ts`) adapted to the pool architecture: wakeup triggers a dispatch; poll fallback picks up delayed `availableAt`; stale lease reclaimed; missing handler retries then abandons; dedupe key collapses. Integration: `enqueue` inside a rolled-back tx ⇒ row never visible.
- **C:** gateway heartbeat test (§3.2); `send_message` ack; shutdown: SIGTERM closes sockets (1001), clears the interval, drains workers within grace; e2e reconnect: client misses a push, recovers via `after=` (spec §58 end-to-end reconnect test).
- **Rollout:** each increment behind the existing deploy pipeline; watch the §4.6 metrics; rollback = previous release (A is the only one with a one-way DB migration — sequence the deploy so the app and migration ship together; no old app version can run against the new `messages.id` column).

---

## 9. File inventory (what implementation will touch)

**New:** `apps/backend/src/outbox/{outbox.module,outbox.service,outbox-dispatcher.service,outbox-worker.service,outbox-registry.service,outbox.types,outbox-events,outbox-wakeup.listener,backoff.util}.ts`, `apps/backend/src/utils/channel.ts`, `apps/backend/src/db/schema/outbox.schema.ts`, `apps/backend/src/chat/{chat.gateway,connection-registry,heartbeat.service}.ts`, migrations `0013_*`/`0014_*` (+ `meta/`), `tasks/plan.md` (this file).

**Modified:** `apps/backend/src/db/schema/{chat.schema,index}.ts`, `apps/backend/src/chat/{chat.service,chat.controller,chat.module,chat.types}.ts`, `apps/backend/src/chat/dto/send-message.dto.ts`, `apps/backend/src/main.ts`, `apps/backend/src/app.module.ts`, `apps/backend/src/config/{configuration,config.validation}.ts`, `apps/backend/package.json` (+`@nestjs/platform-ws`, `@nestjs/websockets`, `@nestjs/event-emitter`, `ws`, `@types/ws` — **not** socket.io/redis-adapter/redis yet), web chat files (`apps/web/actions/chat.ts`, `apps/web/components/chat/*`, `apps/web/types/chat.ts`).

**Deleted:** `apps/backend/src/queue/queue.module.ts` (empty placeholder; superseded by `OutboxModule`).

_End of plan._
