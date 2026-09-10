# psa-npic scout report — Chat module & transactional outbox (incl. background processing)

Investigated `origin/main` at `adda2e1` ("Merge pull request #1 from sakkunasuon2014/v1").
Date: 2026-09-02. Read-only investigation; **no application code was changed**.

---

## 0. Executive summary (read this first)

**Chat** is a real, tested, REST-first messaging subsystem: `conversations` (canonical unordered user pair, `user_a_id < user_b_id`) + `messages` (text/image/listing-context card), 6 endpoints under `/api/v1/chats`, keyset cursor pagination in both directions, read receipts via a `peerLastReadAt` watermark, unread counting, and a per-send validator with block checks. It is **fully wired and green** in this checkout (`ChatModule` imported at `app.module.ts:27,60`; 26 chat unit tests pass). **There is no realtime layer in this checkout**: the WebSocket gateway / connection registry / heartbeat that the brief describes exist **only in the single unmerged commit `48e5009` on branch `rothh/feat/notifications`**. On that branch the WS layer has a genuine bug (see §4.5: `lastPongAt` is never updated, so every socket is force-closed ~60 s after connect).

**Outbox** is a textbook transactional outbox **that is built but not mounted anywhere in this checkout** — it is absent from `origin/main` entirely (no `src/outbox/`, `src/queue/`, `src/notifications/`, `src/redis/`, `src/throttling/`; `git grep -il outbox` returns nothing). The implementation the brief describes (file-for-file: `outbox.dispatcher.ts`, `outbox-handler.registry.ts`, `utils/channel.ts`, `queue/queue.module.ts`, `outbox.schema.ts`, migration `0013`) lives only on `rothh/feat/notifications`, and there it is **not imported by `app.module.ts`** (the captain's suspicion is confirmed: `app.module.ts` on that branch imports `QueueModule` — an empty `@Module({})` — but **not** `OutboxModule`), and **zero** feature modules call `enqueue()` or register a handler. The dispatcher therefore never instantiates and the whole module is dead infrastructure. A second, older, divergent outbox shape exists on the sibling branch `feat/notifications`, where it **is** wired (imported in `app.module.ts`, `enqueue` called from `notification.service.ts:89`, handler registered at `otp-delivery.handler.ts:55`).

**Relationship between the two**: today they are independent. Chat uses REST (+ WS on the unmerged branch) with its own message rows; the outbox is generic event-delivery infrastructure that nothing yet produces or consumes in this checkout. The intended future relationship (per the open `psa-npic-outbox-otp-workers` lane) is that OTP/notification delivery is driven through the outbox — but that ship has **not landed** on `origin/main`.

---

## 1. Verification methodology (what I ran and what I read)

| Step | Command | Result |
|---|---|---|
| Confirm checkout | `git status`, `git log --oneline -5` | detached HEAD at `origin/main` = `adda2e1`, clean tree |
| Locate outbox/queue/notifications | `find apps/backend/src -type d`; `git grep -il outbox` (whole repo) | **absent at HEAD**; empty grep |
| Branch inventory | `git branch -a`; `git ls-tree -r --name-only <ref> -- apps/backend/src` | 4 relevant refs (see §2) |
| Chat unit tests | `pnpm --filter backend test -- --testPathPatterns=chat` | **PASS — 1 suite, 26 tests** |
| Full backend suite | `pnpm --filter backend test` | **PASS — 16 suites, 159 tests** (2.45 s) |
| Timer inventory | `grep -rn -E 'setInterval\|setTimeout\|@Cron\|ScheduleModule' apps/backend/src` at HEAD and via `git grep` on the other refs | see §6 |

No browser work, no DB migration run, no server start (nothing in this checkout would exercise the outbox anyway). All outbox/WS file content below was read via `git show <ref>:<path>`, i.e. from the actual branch trees — line numbers are from `grep -n ''` on those exact blobs.

## 2. Critical context — the branch topology (the brief describes `rothh/feat/notifications`, not this checkout)

```
origin/main (HEAD, adda2e1) ────────────────> rothh/feat/notifications (48e5009 "feat: it's just work like that")
    chat REST only                              + chat WS layer, outbox, queue placeholder,
                                                + web chat UI (64 files, +9562/−815)
f008db6 (older common ancestor) ────────────> feat/notifications (33e1220)
                                                + notifications, outbox (different shape),
                                                + redis + redis-throttling (merged fm/psa-npic-rate-limit-redis-outbox)
```

- `merge-base origin/main rothh/feat/notifications` = `adda2e1` (i.e. `rothh/feat/notifications` is exactly `origin/main` + **one commit**, `48e5009`). That one commit is where every file the brief names first appears: `chat.gateway.ts`, `connection-registry.ts`, `heartbeat.service.ts`, `outbox.dispatcher.ts`, `outbox-handler.registry.ts`, `outbox-events.ts`, `outbox-wakeup.listener.ts`, `utils/channel.ts`, `queue/queue.module.ts`, `db/schema/outbox.schema.ts`, migration `0013_productive_mentor.sql`, plus a full web chat UI (`apps/web/components/chat/*`, `hooks/use-chat-ws.ts`, etc.).
- `feat/notifications` is a **different line** (merge-base with origin/main = `f008db6`; `origin/main` is NOT an ancestor). It contains an outbox with a different API (`eventType`/`aggregateType`, `OutboxRegistry.register(handler)`, `outbox-dispatcher.service.ts` + `outbox-worker.service.ts` + `outbox-registry.service.ts` + `backoff.util.ts`) and a notifications module, and it **imports** `OutboxModule`/`NotificationsModule`/`RedisModule` in `app.module.ts`.
- `fm/psa-npic-rate-limit-redis-outbox` = redis + throttling only (status file: **done**; merged into `feat/notifications` at `a449005`).
- `fm/psa-npic-outbox-otp-workers` = notifications adapters + redis + throttling, **no outbox dir** (status file: `working: isolated worktree verified and branch created`, last entry 2026-08-21; a `.brief.md.swp` dated 2026-09-02 sits in the lane's data dir, suggesting the brief is being reworked).

**Consequence:** the "captain's mental model" in the brief maps 1:1 onto `rothh/feat/notifications` (commit `48e5009`), which is **unmerged and not in this checkout**. Everything below states explicitly which ref each finding comes from. This scout's checkout (origin/main) contains: chat REST (fully wired), nothing else from the brief.

---

## 3. Chat module map — as it exists in THIS checkout (origin/main)

Files: `src/chat/chat.controller.ts`, `src/chat/chat.service.ts` (16 207 bytes — not 23 KB), `src/chat/chat.module.ts`, `src/chat/chat.types.ts`, `src/chat/dto/*`, `src/db/schema/chat.schema.ts`, `src/chat/chat.service.spec.ts`. Wired: `app.module.ts:27` (`import { ChatModule }`) and `app.module.ts:60` (in `imports[]`). Chat is exported for reuse (`chat.module.ts:8` `exports: [ChatService]`).

### 3.1 Data model — `src/db/schema/chat.schema.ts`

**`conversations`** (`chat.schema.ts:14-44`):
- `id uuid PK defaultRandom` (:17)
- `userAId`/`userBId` uuid NOT NULL, FK → `users.id ON DELETE CASCADE` (:19-24). Canonical **unordered pair**: comment at :18 "user_a_id < user_b_id (service sorts before insert)"; enforced by `check('conversations_pair_ordered', sql\`user_a_id < user_b_id\`)` (:42).
- `lastMessageAt timestamp(3) withTimezone defaultNow() notNull` (:28-33) — "Denormalized inbox ordering key; bumped on every send. precision 3 (ms): cursors roundtrip through JS Dates, which have no microseconds — full precision would make gt/lt boundary checks drift." (comment :25-27)
- `createdAt timestamp withTimezone defaultNow()` (:34-36)
- Indexes (:38-43): `uniqueIndex('conversations_pair_uq').on(userAId, userBId)` (:39); `conversations_user_a_recency_idx` / `conversations_user_b_recency_idx` on `(user, lastMessageAt)` (:40-41); pair-ordered CHECK (:42).

**`messages`** (`chat.schema.ts:49-92`):
- `id uuid PK defaultRandom` (:52); `conversationId` FK → conversations `ON DELETE CASCADE` (:53-55); `senderId` FK → users cascade (:56-58)
- `body text` nullable (:59); `listingId uuid` FK → listings **`ON DELETE SET NULL`** (:60-63, "the card survives listing removal via SET NULL"); `imageUrl`/`imagePath` text (:64-65); `readAt timestamp` (:66)
- `createdAt timestamp(3) withTimezone defaultNow() notNull` (:69-71) — "must compare exactly against JS-Date-derived cursors" (:67-68)
- Indexes (:73-83): `messages_conversation_created_idx (conversationId, createdAt, id)` — "Serves both the history cursor (DESC) and the after-delta poll (ASC)"; partial `messages_conversation_unread_idx (conversationId, senderId) WHERE read_at is null` (:75-78 in file numbering 73-83); `messages_listing_id_idx` (:81); CHECKs: `messages_content_present` (body or image_path NOT NULL, :84-87), `messages_image_pair` ((image_url is null) = (image_path is null), :88-91), `messages_body_length_max` (char_length(body) <= 4000, :92).

Migration history: tables created in `drizzle/migrations/0005_nosy_monster_badoon.sql` (chat tables + `user_blocks`); `0006_overjoyed_doorman.sql` narrows `conversations.last_message_at` and `messages.created_at` to `timestamp(3) with time zone`.

### 3.2 REST surface — `src/chat/chat.controller.ts` (global prefix `api`, version 1, JWT-guarded by the global `JwtAuthGuard`; user identity via `@CurrentUser() user: RequestUser`)

| Route | Line | Handler → service |
|---|---|---|
| `POST /api/v1/chats/messages` | `:24-29` | `sendMessage(user.id, dto)` — creates conversation on first message |
| `GET /api/v1/chats` | `:32-35` | `getInbox(user.id, query)` |
| `GET /api/v1/chats/unread-count` | `:38-41` | `getUnreadCount(user.id)` → `{ total }` |
| `GET /api/v1/chats/with/:userId` | `:44-52` | `getConversationWith(user.id, userId)` (read-only, never creates) |
| `GET /api/v1/chats/:conversationId/messages` | `:55-62` | `getMessages(user.id, conversationId, query)` |
| `POST /api/v1/chats/:conversationId/read` | `:65-71` | `markRead(user.id, conversationId)` → `{ marked }` |

**At HEAD there is NO `@Throttle` on send** — the per-route `@Throttle({ default: { limit: 30, ttl: 60_000 } })` (`chat.controller.ts:31` on rothh, with the explanatory comment at :26-30: "sending is the one chat verb that pushes content into someone else's inbox, so it is the harassment/spam surface… Caveat: the global ThrottlerGuard keys on IP, so this is shared by every user behind one NAT") is a `48e5009` addition only. Global throttle at HEAD: `app.module.ts` `ThrottlerModule.forRootAsync` ttl 60 s, limit 100 (`app.module.ts:36-44`), applied via global `APP_GUARD` `ThrottlerGuard` (`app.module.ts:83`).

DTOs: `SendMessageDto` — `recipientId @IsUUID()` (:12), `body? @IsString() @IsNotEmpty() @MaxLength(4000)` (:18-20), `listingId? @IsUUID()` (:27), `imagePath? @IsString() @MaxLength(500)` (:34-35); "At least one of body/imagePath is required — enforced in the service" (:16 comment). `QueryChatsDto` — `limit? = 20` (`@Min(1) @Max(100)`) (:10-11), `cursor?` (:14). `QueryMessagesDto` — `limit? = 30` (:11), `cursor?` history mode (:18), `after?` delta mode (:26).

### 3.3 Service flow — `src/chat/chat.service.ts` (HEAD)

**`sendMessage(senderId, dto)`** (`:61-141`) validation order:
1. self-message → 400 `'Cannot message yourself'` (:63)
2. neither body nor imagePath → 400 (:65)
3. **HEAD's** imagePath check is a denylist: `!startsWith('chat/{senderId}/') || includes('..')` → 400 (:71). (Replaced on rothh by the structural allow-list `assertOwnedChatImagePath`, §4.2.)
4. recipient must exist and not be soft-deleted → 404 `'Recipient not found'` (:78)
5. block in either direction (`isBlockedEitherWay`, :391-404, one SELECT over `user_blocks` with `(blocker,blocked)` both ways) → 403 `'Messaging unavailable'` (:80-81)
6. listing context must be owned by one of the two participants → 400 `'Invalid listing context'` (:94)

Then the **race-safe find-or-create + recency bump in one statement** (:96-105):
```ts
const [a, b] = this.canonicalPair(senderId, dto.recipientId);          // :98
const [conversation] = await this.db.insert(conversations)
  .values({ userAId: a, userBId: b, lastMessageAt: new Date() })       // :101  ← app clock at HEAD
  .onConflictDoUpdate({ target: [conversations.userAId, conversations.userBId],
    set: { lastMessageAt: new Date() } })                              // :102-103
  .returning();
```
`canonicalPair` (`:369-371`) is a pure string sort: `return a < b ? [a, b] : [b, a];`. Image URL derivation from `imagePath` via `supabaseService.getPublicUrl(bucket, path)` (:107-114). Message insert (:115-125). Listing contexts batch-loaded after insert (:127-138); response `{ conversationId, message: {...message, listing} }`.

**Inbox `getInbox`** (`:144-180`): keyset on `(lastMessageAt DESC, id DESC)`, cursor decoded by `decodeCursor` (:523-535, base64 JSON `{createdAt, id}`, tolerant of garbage — returns null), `limit+1` fetch to compute `hasMore`/`nextCursor` (:167-176). `buildInboxItems` (:401-434) batch-loads last message (`selectDistinctOn(conversationId) … orderBy conversationId, createdAt DESC, id DESC`, :424-440), unread counts (grouped count, :443-457), and user summaries (no `deletedAt` filter — history with soft-deleted users stays renderable, :460-473). `batchLoadListingContexts` (:478-505) also grabs the first `listingPhotos` row per listing as thumbnail.

**`getMessages(userId, conversationId, query)`** (`:236-330`): participant auth first — `getConversationForUserOrThrow` (:373-389) returns **404 for non-participants too** ("no conversation-id existence oracle", comment :374-375). `cursor` and `after` are mutually exclusive → 400 (:241). Cursor mode: `(createdAt, id) < (cursor)` DESC history; `after` mode: `(createdAt, id) > (after)` ASC deltas (:243-278). `limit+1`, `nextCursor` from last row, `latestCursor` from newest row (:279-296). Read-receipt watermark: `max(messages.readAt)` over **my** messages in this conversation → `meta.peerLastReadAt` (:298-305, :326-327).

**`markRead`** (`:332-348`): participant check, then one UPDATE of `readAt = new Date()` on `conversationId AND senderId != me AND readAt IS NULL` — bulk, so `peerLastReadAt = max(readAt)` semantics hold (mark-read is all-or-nothing). Returns `{ marked }`.

**`getUnreadCount`** (`:351-364`): single `count(*)` over `messages ⋈ conversations` where I'm a participant, sender ≠ me, `read_at IS NULL`.

**`getConversationWith`** (`:182-232`): self → 400; other user must exist and not be soft-deleted → 404; returns `{ conversation: InboxItem|null, otherUser, blockedByMe, canMessage }`. Read-only — never creates the conversation row (locked by a unit test).

### 3.4 Realtime layer — **exists ONLY on `rothh/feat/notifications` (unmerged commit 48e5009), not in this checkout**

Wiring added by that commit: `main.ts:3,39` (`import { WsAdapter } from '@nestjs/platform-ws'; app.useWebSocketAdapter(new WsAdapter(app))`); `chat.module.ts` gains `imports: [AuthModule]` and providers `[ChatService, ConnectionRegistry, HeartbeatService, ChatGateway]`; `jwt-auth.guard.ts` short-circuits `if (context.getType() === 'ws') return true;` so the global HTTP guard never blocks WS upgrades; `app.module.ts:9,51` adds `EventEmitterModule.forRoot()`; backend `package.json` adds `@nestjs/platform-ws`, `@nestjs/websockets`, `@nestjs/event-emitter`, `@socket.io/redis-adapter`, `socket.io`, `ws`, `redis`, `@types/ws`.

**`chat.gateway.ts`** (`@WebSocketGateway({ path: '/ws/chat' })`, :19):
- `handleConnection` (:29-52): three token sources, in order — `?token=` query param, `Authorization: Bearer`, and the `user_access_token` httpOnly cookie via regex on the Cookie header (:31-38; comment :31-34 explains browser WS cannot set headers, cookies travel on same-origin upgrade). No token → `socket.close(4001, 'Missing token')` (:40-43). `this.auth.verify<{ sub: string }>(token)` → `conn = { socket, userId: claims.sub, lastPongAt: Date.now() }`, stashed on `(socket as any)._conn`, then `registry.add(claims.sub, conn)` (:45-48). Any throw → `socket.close(4001, 'Invalid token')` (:49-51). **4001 is the only close code used.**
- `handleDisconnect` (:65-68) removes the conn from the registry.
- `@SubscribeMessage('send_message')` (:70-82): `const result = await this.core.sendMessage(conn.userId, envelope.payload)` — **the exact same `ChatService.sendMessage` as REST**, so all validations (§3.3) apply. Then push: `if (this.registry.isOnline(recipientId)) for (const rc of this.registry.connectionsFor(recipientId)) rc.socket.send(JSON.stringify({ type: 'message', payload: message }))` (:76-81). Sender does not receive a push (their own response is the echo); multi-device fan-out comes free from the `Set` per user.
- Client frame format (platform-ws protocol): the web hook sends `{ event: 'send_message', data: { payload: envelope } }` (`apps/web/hooks/use-chat-ws.ts` `send`), and the gateway's second arg `envelope: ClientEnvelope { payload: SendMessageDto }` (gateway :15-17) is the `data` field.

**`connection-registry.ts`**: plain in-memory `Map<string, Set<ConnectionInfo>>` (:13) — `ConnectionInfo = { socket, userId, lastPongAt }` (:4-8). `add` (:15-18), `remove` (:20-23, deletes the user key when the set empties), `isOnline` (:25-27), `connectionsFor` (:29-31), `allConnections` (:33-35). Comment :12 "Safe as a plain Map — single-threaded, no race between connect/disconnect".

**`heartbeat.service.ts`**: `PING_INTERVAL_MS = 30_000`, `PONG_TIMEOUT_MS = 10_000` (:6-7); `onModuleInit` starts `setInterval(() => this.sweep(), 30_000)` (:11-13). `sweep` (:15-24) walks `registry.allConnections()`; if `now - conn.lastPongAt > 40_000` → `conn.socket.close()`; otherwise `conn.socket.ping()`. **Bug: nothing ever updates `lastPongAt`** (see §4.5/§9.1).

### 3.5 Delivery / read model (backend side; the client that consumes it is also only on `48e5009`)

- **WS delivers**: new incoming messages pushed live to the online recipient's sockets (`chat.gateway.ts:77-81`). The `send_message` event is an alternative *transport for the send verb* (same service call, same row insert).
- **REST delivers everything else**: inbox, history (`cursor=`), deltas (`after=`), unread count, mark-read. Read receipts travel in `meta.peerLastReadAt` on the messages endpoint (polled, never pushed).
- Client composition (from `48e5009`, `apps/web/hooks/use-chat-thread.ts:121,163`): WS is primary; when `ws.isConnected`, delta polling is disabled (`refetchInterval: wsConnected ? false : refetchInterval`); when the WS drops, adaptive polling resumes (tiers 3 s active / 10 s warm / 30 s idle, paused when the tab is hidden — `use-chat-polling.ts`).

**Sequences (as the brief asks):**

*Send while recipient is online (all on one instance):*
1. Sender's client sends `{event:'send_message', data:{payload}}` over its `/ws/chat` socket — or `POST /api/v1/chats/messages`.
2. `ChatGateway.onSendMessage` → `ChatService.sendMessage` (full validation chain, §3.3) → canonical-pair upsert of `conversations` (bumping `last_message_at`) → insert `messages` row → build `{conversationId, message}`.
3. Gateway checks `registry.isOnline(recipientId)` → for each of the recipient's sockets: `socket.send({type:'message', payload: message})`.
4. Recipient's client receives the push, appends it (and its own `after=` watermark advances on the next poll); the sender's client shows the row from the send response. Read receipts only move when the recipient's client calls `POST /:conversationId/read`, surfaced to the sender via `peerLastReadAt` on a poll.

*Send while recipient is offline (or on another instance):*
1. Step 2 above is identical — the message is durably persisted.
2. `isOnline(recipientId)` is false (or the registry on this instance doesn't know them) → no push.
3. When the recipient connects (or reconnects), their client resumes delta polling from `after = meta.latestCursor` (or from a WS catch-up path), and the message arrives via REST. No server-side offline queue; no push retention.

**Edge cases verifiable in code:**
- **Multiple sockets per user**: registry holds a `Set` per userId → every socket gets the push (multi-tab/multi-device). (:13, :29-31, :78-79).
- **`lastPongAt` init**: set to `Date.now()` at connect (gateway :46) — and **never updated again** (§4.5).
- **Cross-instance**: registry is per-process, so recipient-on-instance-B gets no push from sender-on-instance-A; and because each client disables polling while *its own* WS is up, a two-instance deployment can stall delivery until a reconnect/activity. `@socket.io/redis-adapter` was added to package.json but **nothing uses it** — the gateway is platform-ws, and no redis adapter is constructed anywhere on the branch.
- **No WS for the sender's other devices**: push targets only `recipientId`; the sender's own other tabs rely on their own polling or their own WS receive path (there is none for own messages — they get no push). Not a correctness issue (REST echo + polling cover it) but worth noting.

---

## 4. Outbox module map — the brief-matching shape lives on `rothh/feat/notifications` (unmerged); absent from this checkout

Files (all `48e5009`): `src/db/schema/outbox.schema.ts`, `src/outbox/{outbox.module.ts, outbox.service.ts, outbox.dispatcher.ts, outbox-handler.registry.ts, outbox-events.ts, outbox-wakeup.listener.ts}`, `src/utils/channel.ts`, `src/queue/queue.module.ts`, migration `0013_productive_mentor.sql`, plus config keys and a `DbExecutor` type. **No unit tests ship with it on this branch** (no `*.spec.ts` under `src/outbox/` or `src/utils/` on `rothh/feat/notifications`).

### 4.1 Schema — `src/db/schema/outbox.schema.ts` + `0013_productive_mentor.sql`

`pgEnum('outbox_status', ['pending','processing','published','dead'])` (:16-25). Table `outbox_messages` (:27-64):

| Column | Line | Notes |
|---|---|---|
| `id uuid PK defaultRandom` | :30 | |
| `topic varchar(80) notNull` | :31 | no enum — a new topic is a code change, not a migration |
| `aggregate_id uuid` | :33 | "Partition / ordering key — typically the userId the message belongs to" |
| `payload jsonb notNull` | :34 | |
| `status outbox_status default 'pending'` | :35 | |
| `priority smallint default 0` | :37 | "Higher runs sooner (see the claim ORDER BY)" |
| `attempts integer default 0` | :38 | |
| `max_attempts integer default 5` | :39 | |
| `next_attempt_at timestamptz default now()` | :40-43 | backoff/availability gate |
| `dedupe_key varchar(160)` | :44 | unique → repeated enqueue is a no-op |
| `locked_by varchar(64)` | :45 | `instanceId:workerId` (dispatcher :32, :67) |
| `locked_at timestamptz` | :46 | lease stamp |
| `last_error text` | :47 | diagnostics |
| `created_at timestamptz default now()` | :48-50 | |
| `published_at timestamptz` | :51 | |

Indexes (:54-63): `outbox_messages_claim_idx (priority DESC, next_attempt_at) WHERE status='pending'` — "Serves the claim query's predicate and its leading ORDER BY key"; `uniqueIndex outbox_messages_dedupe_key_uq (dedupe_key)`; `outbox_messages_published_idx (published_at) WHERE status='published'` — retention sweep of delivered rows.

Migration DDL (`0013_productive_mentor.sql`): `CREATE TYPE outbox_status` + `CREATE TABLE outbox_messages` + the three indexes, exactly as above; registered in `db/schema/index.ts:10` (`export * from './outbox.schema'`).

### 4.2 Service — `src/outbox/outbox.service.ts`

- **`enqueue(tx: DbExecutor, msg)`** (:73-90): inserts on **the caller's transaction handle** — the doc comment (:65-72) is the whole point: "Insert an outbox row using the CALLER'S transaction handle, so the message is committed atomically with the business write that produced it. That atomicity is the entire point of the outbox — never pass `this.db` here when a surrounding transaction exists. Call `wakeupAfterCommit()` once the transaction has committed." `onConflictDoNothing({ target: outboxMessages.dedupeKey })` (:89) — "dedupeKey is nullable and Postgres treats NULLs as distinct, so rows without a key never collide" (:87-88). `nextAttemptAt` only set when `availableAt` is passed, "so the column default (`now()` on the DB clock) applies rather than this process's clock" (:83-85).
- **`wakeupAfterCommit(source = 'transaction')`** (:96-99): `this.eventEmitter.emit('outbox.wakeup', {source})` — must be called after commit "waking it earlier would race the commit and find nothing to claim" (:92-95).
- **`claimBatch(limit, workerId)`** (:108-133): one `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED) … RETURNING *` — sets `status='processing'`, `attempts = attempts + 1`, `locked_by = ${workerId}`, `locked_at = now()` (:110-114); inner select: `status='pending' AND next_attempt_at <= now() ORDER BY priority DESC, created_at LIMIT ${limit} FOR UPDATE SKIP LOCKED` (:116-121). Comment (:104-107): "concurrent claimers lock disjoint row sets, so no two workers — in this process or any other instance — can ever claim the same row." Returns `OutboxRecord[]` mapped from snake_case raw rows (:125-132).
- **`markPublished(id)`** (:141-153): `status='published'`, `published_at=now()`, **`payload = {}`**, clears `locked_by/locked_at/last_error`. Comment (:135-140): "DROP THE PAYLOAD. OTP codes, reset links and other short-lived secrets transit this table; once delivered there is no reason for them to keep sitting in a durable, admin-readable row."
- **`markFailed(id, error, terminal=false)`** (:160-181): status CASE — `'dead'` when `terminal OR attempts >= max_attempts`, else `'pending'` (:163-169); `next_attempt_at = now() + least(300, power(2, attempts)) * (0.75 + random() * 0.5) seconds` (:170-175) — exponential backoff `2^attempts` **capped at 300 s** (`BACKOFF_CAP_SECONDS = 300`, :19), **±25 % jitter** (`(0.75 + random()*0.5)`, :174); comment (:10-18) explains attempts is already incremented by claimBatch so first failure waits ~2 s then ~4/8/16… and jitter prevents batch stampedes. `last_error` truncated to 2000 chars (`MAX_ERROR_LENGTH`, :22, :176).
- **`reclaimStale(olderThanSeconds)`** (:191-210): recovers rows stuck `processing` with `locked_at` older than the threshold: back to `'dead'` if `attempts >= max_attempts` else `'pending'`, clears the lock, sets `last_error = coalesce(last_error, 'reclaimed: processing lock went stale')`. Comment (:183-190): "a message that crashes its worker every time still exhausts its budget instead of looping forever" because the claim already consumed an attempt.

### 4.3 Dispatcher — `src/outbox/outbox.dispatcher.ts`

- Constants: `WakeupToken = 'wake'` (:21-22 — non-undefined string because `Channel.tryRead()` uses `undefined` as its empty sentinel, so a `Channel<void>` couldn't distinguish empty from a real value, :16-19); `SHUTDOWN_GRACE_MS = 10_000` (:24); `instanceId = \`${process.pid}-${randomUUID().slice(0,8)}\`` (:32 — "Identifies this process in `outbox_messages.locked_by`").
- Config read in constructor (:49-56): `outbox.concurrency ?? 5`, `outbox.batchSize ?? 100`, `outbox.pollIntervalMs ?? 1500`, `outbox.reclaimIntervalMs ?? 60_000`, `outbox.staleLockSeconds ?? 300`. (Config keys defined in `config/configuration.ts:36-42` + Zod-validated env in `config/config.validation.ts:24-28`: `OUTBOX_CONCURRENCY=5`, `OUTBOX_BATCH_SIZE=100`, `OUTBOX_POLL_INTERVAL_MS=1500`, `OUTBOX_RECLAIM_INTERVAL_MS=60000`, `OUTBOX_STALE_LOCK_SECONDS=300`.)
- The wakeup channel: `Channel.createBounded<WakeupToken>(1)` (:29) — capacity-1 coalescing flag ("a full buffer simply means a wakeup is already pending", :11-14).
- `onModuleInit` (:59-97): `running = true`; **startup reclaim** of any `processing` rows left by a dead process (:62-63); worker pool of `concurrency` workers with `workerId = ${instanceId}:${i}` (:65-76); **startup drain** `this.wakeup('startup')` (:78-79); poll timer `setInterval(() => this.wakeup('retry'), pollIntervalMs)` with `.unref()` (:87-91); reclaim timer `setInterval(() => void this.reclaim(), reclaimIntervalMs)` with `.unref()` (:93-96).
  - **Why the poll fallback is not redundant** (comment :81-86): "(a) EventEmitter2 is in-process only. With more than one backend instance, a row committed on instance A never wakes instance B — only a poll makes B notice it. (b) It is the retry driver. A row whose next_attempt_at is in the future has no wakeup event coming; nothing will re-emit for it."
- `onModuleDestroy` (:99-116): `running = false`; clear both timers; `channel.writer.complete()`; `await Promise.race([Promise.allSettled(workers), 10 s timeout])` — "workers finish the batch they are on, then exit… never block shutdown forever on a handler that hangs — an abandoned row is recovered by reclaimStale" (:108-115).
- `wakeup(source)` (:124-129): `channel.writer.tryWrite(WAKE)` — "Returns false when a wakeup is already buffered — that is the coalescing behaviour we want, not an error."
- `worker(workerId)` (:131-155): loop `waitToReadAsync()` → on token, `tryRead()` then `drain()`. Fan-out note (:140-143): "All waiting workers are released by a single token; only one of them actually takes it, the rest read empty and drain anyway. That fan-out is intentional and safe — claimBatch uses FOR UPDATE SKIP LOCKED, so they never claim overlapping rows."
- `drain(workerId)` (:157-167): loop `claimBatch(batchSize)` until an empty batch, dispatching each record (concurrently within the batch, :165).
- `dispatch(record, workerId)` (:169-203): no handler for topic → **terminal** release with error `No handler for topic "…"` (:175-185, "retrying an unroutable topic can never succeed, so this must not burn attempts in a loop"); else `handler.handle(payload, {id, topic, aggregateId, attempt: record.attempts})` then `markPublished(record.id)` (:187-195); catch → `release(id, message)` (:196-202).
- `release` (:210-225): wraps `markFailed` in try/catch — "markFailed can itself fail (e.g. the DB went away). Swallow it here so one bad row cannot abort the whole batch — the row stays `processing` and is picked up again by reclaimStale."
- `reclaim` (:227-240): `reclaimStale(staleLockSeconds)`; if any rows recovered, log + `wakeup('retry')`.

### 4.4 Handler registry — `src/outbox/outbox-handler.registry.ts`

- `OutboxDispatchContext` (:3-10): `{ id, topic, aggregateId, attempt }` — "**id** — safe to use as a downstream idempotency key"; "**attempt** — 1 on the first delivery attempt."
- `OutboxHandler` (:12-18): `{ readonly topic; handle(payload, ctx): Promise<void> }`.
- `OutboxHandlerRegistry` (:26-43): plain `Map<string, OutboxHandler>` (:28); `register(topic, handler)` throws on duplicate topic (:30-35 — `An outbox handler is already registered for topic "…"`); `get(topic)` (:40-42). Comment (:20-24): "Feature modules inject this and call `register()` from their own `onModuleInit`; deliberately a plain Map rather than DI multi-provider tokens or decorator scanning."
- Wakeup plumbing: `outbox-events.ts:1` `OUTBOX_WAKEUP_EVENT = 'outbox.wakeup'` with `source: 'transaction' | 'retry' | 'startup'` (:3-5); `outbox-wakeup.listener.ts:10-13` `@OnEvent(OUTBOX_WAKEUP_EVENT) handle() { this.dispatcher.wakeup(); }`.
- `OutboxModule` (`outbox.module.ts:7-17`): providers `[OutboxService, OutboxHandlerRegistry, OutboxDispatcher, OutboxWakeupListener]`, exports `[OutboxService, OutboxHandlerRegistry]` — "OutboxService so features can enqueue inside their own transaction; OutboxHandlerRegistry so they can register a handler for their topic." **Not `@Global()`.**
- `src/utils/channel.ts` (257 lines): a C#-`System.Threading.Channels`-style `Channel<T>` — `createBounded(capacity)` / `createUnbounded()` (:254-257), `tryWrite` drops when full (returns false, :88-102), `tryRead` uses `undefined` as empty sentinel, `waitToReadAsync` suspends readers, `complete()` releases waiters. Used exactly once: the dispatcher's capacity-1 wakeup channel.
- `src/queue/queue.module.ts` (4 lines): `@Module({})` — **an empty placeholder**; imported by `app.module.ts` on rothh (:66) but provides and exports nothing.

### 4.5 The `DbExecutor` seam (`db/drizzle.provider.ts:17-27` on rothh)

`DbExecutor = PgDatabase<PostgresJsQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>` — "Common supertype of the root client and a live `db.transaction()` handle (PgTransaction extends PgDatabase). Use it on any method that must be able to run inside the caller's transaction — e.g. OutboxService.enqueue." This is what lets `enqueue(tx, …)` accept either the pool or a transaction handle.

### 4.6 Lifecycle sequences

**Happy path (one message):**
1. Producer, inside its own business transaction, calls `outbox.enqueue(tx, { topic, payload, aggregateId?, dedupeKey?, … })` → row inserted with `status='pending'`, `attempts=0`, `next_attempt_at=now()` (DB clock).
2. Producer's transaction commits (row becomes visible atomically with the business write).
3. Producer calls `outbox.wakeupAfterCommit()` → EventEmitter emits `outbox.wakeup` → `OutboxWakeupListener` → `dispatcher.wakeup()` → `channel.tryWrite('wake')`.
4. A worker wakes, `drain()` → `claimBatch(100, '<pid>-<rand>:<i>')` → `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)` flips the row to `processing`, `attempts=1`, stamps `locked_by/locked_at`; only this worker sees the row.
5. `dispatch()`: `handlers.get(topic)` → `handler.handle(payload, {id, topic, aggregateId, attempt:1})`.
6. On success: `markPublished(id)` → `status='published'`, `payload={}` (secrets scrubbed), `published_at=now()`, lock cleared. Row is now only a retention-sweep candidate (`outbox_messages_published_idx`).
7. If no further wakeup arrives, the 1500 ms poll re-checks; with no due rows the drain returns immediately.

**Failure path (handler throws):**
1-4. Same, up to the claim (attempt 1 consumed).
5. `handler.handle` throws → `dispatch` catch → `release(id, message)` → `markFailed`: `attempts(1) < max_attempts(5)` → `status='pending'`, `next_attempt_at = now() + 2 s (× jitter 0.75–1.25)`, `last_error` stored (≤2000 chars), lock cleared.
6. Retry arrives either via the 1500 ms poll (`wakeup('retry')` re-arms the drain) or a future `next_attempt_at`; each claim increments attempts: ~2 s, ~4 s, ~8 s, ~16 s (capped 300 s, ±25 %).
7. When `attempts >= max_attempts` → `status='dead'` (terminal; also immediate if `terminal=true`, e.g. unroutable topic). A worker crash mid-handle leaves the row `processing`; the 60 s `reclaimStale` sweep (and the startup reclaim) flips it back to `pending` (or `dead` if the budget is gone).

### 4.7 The divergent `feat/notifications` outbox (older line, wired but different API)

On `feat/notifications` the outbox is named after **events**, not topics: table `outbox_events` (`db/schema/outbox.schema.ts` there) with `eventType varchar(80)` (dotted namespace, e.g. `notification.otp.requested`), `aggregateType varchar(40)` + `aggregateId uuid NOT NULL`, `status` enum `pending/processing/published/failed` (no `dead`; `failed` is terminal), `available_at` instead of `next_attempt_at`, `dedupe_key varchar(200)`, indexes `outbox_events_status_available_at_idx (status, available_at)`, `outbox_events_aggregate_idx`, `outbox_events_dedupe_key_idx`. Service API: `OutboxService.enqueue(tx, IntegrationEvent)` + `claimDue(limit)` + `claimById(id)` + `markPublished(id, redacted)` / `markFailed(id, error, redacted)` (handler-supplied `redact()` instead of blanket `payload={}`), `instanceId` on the service. Registry: `OutboxRegistry.register(handler)` with an `OutboxHandler { eventType, handle(event): Promise<HandlerOutcome{status:'published'|'retry'|'failed'}>, onAbandoned?, redact? }` (`outbox.types.ts`). Worker: `OutboxWorker` with a **recursive `setTimeout`** poll (`outbox-worker.service.ts:20,83` — "a tick that outruns the interval must not have the next one stack up behind it"), `OUTBOX_WORKER_ENABLED=false` opt-out, default `pollIntervalMs 2000`, `batchSize 10`, and a **sequential** `dispatchDue` ("firing the whole batch at it concurrently is how you get rate-limited", `outbox-dispatcher.service.ts`). Missing-handler events are **retryable** there (rolling-deploy tolerance) rather than terminal. This line IS wired: `app.module.ts` imports `OutboxModule` + `NotificationsModule`; `notification.service.ts:89` enqueues `OTP_REQUESTED_EVENT` inside its `db.transaction(...)`; `otp-delivery.handler.ts:55` self-registers via `onModuleInit`; `notification.service.ts` also calls `dispatcher.dispatchById(eventId)` as an inline fast-path after enqueue.

---

## 5. Background processing inventory (cross-cutting)

**In this checkout (origin/main): there are zero background timers.** `grep -rn 'setInterval|setTimeout|@Cron|ScheduleModule' apps/backend/src` at HEAD returns nothing (no `@nestjs/schedule` dependency either — verified in `apps/backend/package.json`). The only "activity" machinery is the per-request `LastSeenInterceptor` → `ActivityService.touch()` with a 5-minute in-memory throttle map (no timers, per CLAUDE.md).

Across the unmerged branches:

| Timer / worker | Where | Cadence & default | Driver | Per-… |
|---|---|---|---|---|
| Outbox worker pool | `outbox.dispatcher.ts:65-76` (rothh) / `outbox-worker.service.ts` (feat/notifications) | `concurrency` = 5 (rothh); single loop (feat) | capacity-1 wakeup `Channel` (rothh) / recursive `setTimeout` (feat) | per-process |
| Outbox poll fallback | `outbox.dispatcher.ts:87-91` (rothh) | `pollIntervalMs` = **1500 ms** (`OUTBOX_POLL_INTERVAL_MS`) | `setInterval(…).unref()` → `wakeup('retry')` | per-process |
| Outbox stale reclaim sweep | `outbox.dispatcher.ts:93-96` (rothh); startup reclaim at :62-63 | `reclaimIntervalMs` = **60 000 ms** (`OUTBOX_RECLAIM_INTERVAL_MS`), stale threshold `staleLockSeconds` = **300 s** (`OUTBOX_STALE_LOCK_SECONDS`) | `setInterval(…).unref()`; `reclaimStale` SQL | per-process |
| Outbox shutdown grace | `outbox.dispatcher.ts:110-115` (rothh) | 10 s one-shot | `setTimeout(…).unref()` in `Promise.race` | per-process |
| Chat WS heartbeat | `chat/heartbeat.service.ts:11-13` (rothh only) | 30 s ping interval; 10 s pong timeout (40 s close threshold) | `setInterval` in `OnModuleInit` (no `unref`) | per-process |
| Telegram gateway HTTP timeout | `notifications/channels/telegram-gateway.channel.ts:127` (feat/notifications only) | `REQUEST_TIMEOUT_MS` | `setTimeout(() => controller.abort(), …)` | per-request |

`@nestjs/schedule` / `@Cron` / `ScheduleModule`: **absent from every ref**. Everything is hand-rolled `setInterval`/`setTimeout`. Config keys live under `outbox.*` and are read in `outbox.dispatcher.ts:49-56` (rothh) — see §4.3.

**Outbox ↔ background delivery relationship:** as shipped in this checkout there is no relationship — nothing enqueues and nothing registers handlers, and on `rothh/feat/notifications` the dispatcher (the only thing that would run the workers/timers) is never instantiated because `OutboxModule` is not imported. On `feat/notifications` the outbox *is* live background machinery driving OTP delivery (`notification.service.ts` enqueue + inline `dispatchById`, `otp-delivery.handler.ts` handler, `outbox-worker.service.ts` poll loop).

`src/queue/queue.module.ts`: on `rothh/feat/notifications` it exists as an **empty `@Module({})` placeholder** (4 lines) and is the only queue-related file; it is imported by `app.module.ts:66`. `src/notifications/`: **absent from `origin/main`**; on `feat/notifications` it is a full channel-based notification stack (SMS/email/Telegram-gateway/composition/retrying channels, `ChannelRegistry`, `NotificationService`, `OtpDeliveryHandler`); on `fm/psa-npic-outbox-otp-workers` a different adapter-shaped version exists. Implication: the "queue" is scaffolding reserved for the not-yet-landed worker vertical slice; the notification/Redis work exists only on the unmerged feature line.

---

## 6. Wiring status — verified, not assumed

1. **This checkout (origin/main):** `ChatModule` is wired (`app.module.ts:27` import, `:60` in `imports[]`). **There is no outbox, queue, notifications, redis, or throttling module anywhere in the tree** (`git grep -il outbox` → empty; `find` shows no such dirs). If the captain's question was "is the outbox actually instantiated here" — **no, because it does not exist here at all**.
2. **On the branch the brief describes (`rothh/feat/notifications`):** `app.module.ts` imports `EventEmitterModule.forRoot()` (:51), `ChatModule` (:63) and `QueueModule` (:66) — **but NOT `OutboxModule`**. So even on that branch, `OutboxModule` is built-but-not-wired: no import, no `enqueue()` call sites (the only `enqueue` hits are doc comments in `outbox.service.ts`/`outbox.schema.ts`/`drizzle.provider.ts`), no handler `register()` call sites (the only `register(` hits outside the registry itself are `auth.controller.ts:31` — the registration endpoint — and the registry's own method). The dispatcher, its worker pool, and both timers therefore never start. This matches the captain's suspicion exactly.
3. **On the sibling line (`feat/notifications`):** the outbox **is** wired — `app.module.ts` imports `OutboxModule` and `NotificationsModule`; `notifications/services/notification.service.ts:89` calls `this.outbox.enqueue(tx, { eventType: OTP_REQUESTED_EVENT, … })` inside its transaction; `notifications/services/otp-delivery.handler.ts:55` calls `this.outboxRegistry.register(this)` from `onModuleInit`; `notification.service.ts` additionally fires `dispatcher.dispatchById(eventId)` inline after commit. That line is a complete, different-shaped implementation (see §4.7).

---

## 7. Cross-reference with the captain's recent ship briefs

**`psa-npic-rate-limit-redis-outbox` ("Redis throttling") — DONE, but not on this checkout.** Lane status file ends with `done: ready in branch fm/psa-npic-rate-limit-redis-outbox`. That branch contains `src/redis/{redis.module,redis.service}.ts` + `src/throttling/redis-throttler.storage.ts` (+specs) only. It was merged into `feat/notifications` (`a449005 "Merge branch 'fm/psa-npic-rate-limit-redis-outbox' into feat/notifications"`), where `app.module.ts` wires `RedisModule` + `RedisThrottlerStorage` + `buildThrottleKey` into `ThrottlerModule.forRootAsync`. **None of this is in `origin/main`** — the current checkout still uses the process-local in-memory throttler (global `ThrottlerGuard`, `app.module.ts:36-44,83`).

**`psa-npic-outbox-otp-workers` ("Durable outbox workers and Redis-backed registration OTP") — NOT landed.** Lane status is stuck at `working: isolated worktree verified and branch created` (2026-08-21). The branch `fm/psa-npic-outbox-otp-workers` carries a notifications stack (adapter-shaped: `sms-channel.adapter`, `telegram-gateway-channel.adapter`, `base-notification-channel`, `channel-registry.service`, `notification.service`, `otp-code.util`) plus redis + throttling, but **no outbox directory** — the outbox half of that slice does not exist on that branch. The full outbox + OTP-delivery vertical exists only on the divergent `feat/notifications` line (different API than the brief mandates: no Redis Stream consumer group, no separate worker entry point — it runs in-process on every instance with `OUTBOX_WORKER_ENABLED` opt-out). A `.brief.md.swp` (dated 2026-09-02, same day as this scout) sits in the lane's data directory, suggesting the brief is actively being revised/re-launched.

Net: **both ships are "pending" from the perspective of `origin/main`.** The redis-throttling slice is complete on a side branch; the outbox-OTP slice is open with two divergent partial implementations on side branches and no merged result.

---

## 8. Risks & observations (things that look unfinished, dead, or fragile)

1. **Heartbeat bug (on `rothh/feat/notifications` only): `lastPongAt` is never updated.** Written at connect (`chat.gateway.ts:46`) and read by the sweep (`heartbeat.service.ts:18`), but no `socket.on('pong', …)` listener exists anywhere on the branch (`git grep 'pong'` → only those two refs plus geography false-positives). `conn.socket.ping()` is sent but pongs are never recorded, so `now - lastPongAt` grows monotonically and **every WS connection is force-closed at the second sweep (~60 s after connect)** regardless of liveness. A healthy chat session would silently drop every ~60 s and rely on client reconnect + polling. Fix is one `socket.on('pong', () => { conn.lastPongAt = Date.now(); })` in the gateway.
2. **In-memory `ConnectionRegistry` is per-process.** Multi-instance deployments: a recipient connected to instance B gets no push for sends handled on instance A, and because the web client disables polling while *its own* WS is up (`use-chat-thread.ts:163`), cross-instance delivery can stall until a reconnect. `@socket.io/redis-adapter` + `socket.io` are in `package.json` but unused (gateway is platform-ws) — either the intended fix or dead deps.
3. **Outbox not mounted on the branch the brief describes**: `OutboxModule` unimported on `rothh/feat/notifications`; absent on `origin/main`. Its dispatcher/timers/workers never start anywhere in any current checkout.
4. **Two divergent outbox implementations** (`rothh` topic/dedupeKey/terminal-missing-handler vs `feat/notifications` eventType/redact/retryable-missing-handler + inline `dispatchById` fast-path). They disagree on: missing-handler semantics (terminal vs retryable), terminal state (`dead` vs `failed`), payload scrubbing (`{}` vs handler `redact()`), polling (fixed-interval `setInterval` + channel vs recursive `setTimeout`), worker model (pool of 5 vs single sequential loop), and migration table names (`outbox_messages` vs `outbox_events`). **Both cannot survive.**
5. **No outbox tests on the `rothh` line** (zero `*.spec.ts` under `src/outbox/`, `src/utils/`); the `feat/notifications` line has specs for its shape.
6. **HEAD chat hardening gaps that `48e5009` fixes** (relevant if the branch is never merged): (a) imagePath validation at HEAD is a denylist (`startsWith('chat/{id}/')` + reject `..`, `chat.service.ts:71`) — rothh replaces it with a structural 3-segment allow-list `assertOwnedChatImagePath` (`chat.service.ts:435-445`) because "denylists on storage keys leak: %2e%2e, backslashes and fullwidth dots all slip past a literal `..` scan"; (b) HEAD's `lastMessageAt` bump uses `new Date()` (app clock, `chat.service.ts:101,103`) while `messages.createdAt` uses the DB default — rothh switches the bump to `sql\`now()\`` (:122) and adds a post-insert **monotonic-max watermark update** (:148-161, `UPDATE conversations SET lastMessageAt = message.createdAt WHERE id=… AND lastMessageAt < message.createdAt`) to fix the concurrent-send ordering race (bump-before-row-exists); (c) HEAD's `decodeCursor` accepts any id string, so a crafted non-UUID cursor id hits Postgres `22P02` → 500; rothh validates ids against `UUID_RE` (:61-63, decode :527-535) and notes a `lastMessageAt <= cursor` fast-path is deliberately absent (same-millisecond message loss, comment ~:290-305); (d) HEAD chat has no `@Throttle` on send; rothh adds `@Throttle({default:{limit:30,ttl:60_000}})` (`chat.controller.ts:31`).
7. **Web chat at HEAD is mock**: `apps/web/components/home/Chats.tsx` is a static `useState`-driven demo; the real chat UI (server actions `actions/chat.ts`, components, WS + polling hooks) exists only in `48e5009`.
8. **Minor**: `(socket as any)._conn` casts (gateway :47, :66, :72), `ClientEnvelope { payload: any }` (`common/dto/client-envelope.dto.ts`) — lint hygiene; `queue/queue.module.ts` is an empty shell imported for no effect.

---

## 9. Recommendations (report recommends; it does not authorize)

1. **Decide the fate of `rothh/feat/notifications` (48e5009) and the outbox line first** — everything else below depends on it. It is one commit on top of `origin/main` containing the chat WS layer (+ its heartbeat bug), the outbox in its brief-matching shape, and a large web chat UI. Options: merge it and fix the heartbeat + wire `OutboxModule`; or land only the chat parts; or leave it and keep REST polling.
2. **Fix the heartbeat** if the WS layer ships: register a pong listener that updates `lastPongAt` (one line), and consider `unref()`-ing the interval.
3. **Pick one outbox shape** — the two branches cannot both survive (different tables, enums, semantics, §8.4). The `rothh` shape is the one the captain's brief describes; the `feat/notifications` shape is the only one that is wired and tested and actually drives OTP delivery. A reconciliation decision is required before any OTP/notification ship.
4. **Wire or delete the outbox on the chosen line**: if kept, `OutboxModule` must be imported in `app.module.ts` (currently only on `feat/notifications`), and the first producer/handler pair (OTP registration per the open lane) must call `enqueue`/`register` — both currently absent on the `rothh` line.
5. **Multi-instance plan for chat WS**: either accept single-instance delivery (REST polling covers it) or implement the redis-adapter path the deps already hint at; document the "polling disabled while WS connected" interaction, which currently makes cross-instance delivery stall.
6. **Adopt the `48e5009` chat-service hardening on `origin/main` even without the WS layer** (DB-clock `lastMessageAt`, monotonic-max watermark, `UUID_RE` cursor guard, structural imagePath allow-list, `@Throttle` on send) — all are correctness/security fixes to code that ships today, and each is covered by tests added on that branch.
7. If the OTP-outbox lane relaunches (the swp file suggests it), it should reconcile against §4.7's existing `feat/notifications` implementation rather than start from scratch.

---

## Appendix — commands run (evidence)

```
git status                                    # detached HEAD at origin/main (adda2e1), clean
git log --oneline -5                          # HEAD = adda2e1 "Merge pull request #1 from sakkunasuon2014/v1"
git branch -a / git log --all --oneline       # feat/notifications, fm/*, rothh/feat/notifications, origin/{main,v1,rothh/feat/notifications}
git merge-base origin/main rothh/feat/notifications   # adda2e1 → rothh = origin/main + 48e5009
git merge-base --is-ancestor origin/main feat/notifications  # NO → divergent line
find apps/backend/src -type d                 # no outbox/queue/notifications/redis/throttling at HEAD
git grep -il outbox                           # empty at HEAD
git ls-tree -r --name-only <ref> -- apps/backend/src   # per-branch file inventory
git diff origin/main rothh/feat/notifications --stat   # 64 files, +9562/−815 (chat WS + outbox + web chat)
git show rothh/feat/notifications:<file>      # all outbox/WS/config/schema/migration content read from the branch blob
pnpm --filter backend test -- --testPathPatterns=chat   # 1 suite, 26 tests PASS (1.39 s)
pnpm --filter backend test                     # 16 suites, 159 tests PASS (2.45 s)
grep -rn 'setInterval|setTimeout|@Cron|ScheduleModule' apps/backend/src   # NONE at HEAD
```
