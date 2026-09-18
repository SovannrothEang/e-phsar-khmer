# Scout report — `feat/notifications`: the notification/OTP subsystem of psa-npic

**Investigator:** read-only investigation · **Date:** 2026-09-02 · **Branch:** `feat/notifications` (`33e1220`, 12 commits ahead of `main` at `f008db6`)
**Scope:** read-and-verify investigation of the notification subsystem; no application code was changed. Deliverable is this report.

---

## 0. How this report was produced

- Checked out `feat/notifications` (already present locally): `git checkout feat/notifications` → `33e1220 batman`. Verified with `git branch --show-current`.
- Read all planning docs (`docs/todos/00`–`09` + `README.md`, 1,115 lines), `docs/REVIEW.md` (449 lines), `docs/architecture.md` diff, and the branch's `AGENTS.md` (the branch's working doc, which documents the _current_ code shape).
- Read every file under `apps/backend/src/notifications/`, `apps/backend/src/outbox/`, `apps/backend/src/redis/`, `apps/backend/src/throttling/`, plus `app.module.ts`, `auth.module.ts`, `auth.service.ts`, `config/*`, `db/schema/{notifications,outbox,chat}.schema.ts`, migrations `0013`/`0014`, and the web app's mock notification surfaces.
- Ran the gates:
  - `pnpm --filter backend test` → **30 suites / 240 tests, all pass** (docs claim "24 suites / 185 tests" at Phase 7 — the outbox/redis specs landed after that; current count is higher).
  - `pnpm --filter backend build` (`nest build`) → **passes**.
  - `pnpm --filter backend test:e2e` → **6 tests, pass** (Redis stubbed at the provider boundary; no Postgres needed — `ECONNREFUSED` to Postgres is expected and handled).
  - `pnpm --filter backend lint` (`eslint --fix`) → **passes, no changes**.
- Dependencies installed fresh in the disposable worktree: `pnpm install --frozen-lockfile` (done in 6.1s).

**Two premises in the task brief do not hold on this codebase — verified, see §6:**

1. **There is no WebSocket gateway, `ConnectionRegistry`, or `HeartbeatService` anywhere in the backend** — not on `main`, not on `feat/notifications`. Chat is REST + polling only (`AGENTS.md:537`: "New messages reach clients only via polling (`after=` deltas); no FCM/APNs/WebSocket layer exists"). This materially changes the in-app recommendation (§7).
2. **`main` has no outbox at all.** `git ls-tree -r --name-only main | grep -i outbox` → nothing under `apps/backend`. The outbox (`src/outbox/`), Redis, and throttling are all _new_ on this branch, not "an evolved different layout" of something on main.

---

## 1. Executive summary

`feat/notifications` builds an **embedded, single-tenant, in-process notification module** (`apps/backend/src/notifications/`, ~850 lines + specs) whose first and only consumer is **phone OTP delivery** — the replacement for the existing Supabase-OTP passthrough in `AuthService`. It is architected as:

- a **channel abstraction** (`ChannelType` enum, `ChannelDriver` + `NotificationChannel` interfaces, `GuardedChannel` composition wrapper) with two live transports — `SMS` (behind an `SmsClientPort` hex seam that is still a console-log stub) and `Telegram Gateway API` (a real integration against `gateway.telegram.org` with a 5 s timeout and `DEV_OTP_TOKEN` dev bypass);
- an **OTP domain core** (`NotificationService.issue()/verify()`) implementing a `pending → sent → verified/consumed` (+ `failed`/`failed_max_attempts`) state machine with a single atomic `UPDATE` replay guard, lazy expiry, and max-attempts lockout, plus a `crypto.randomInt`/SHA-256 code util;
- a **transactional outbox delivery engine** (`apps/backend/src/outbox/`, tables in migration `0014`) — `issue()` writes the `otp_requests` row and a `notification.otp.requested` event in **one transaction**, then a Postgres-backed worker claims rows with `FOR UPDATE SKIP LOCKED` leases, retries with exponential (deliberately unjittered) backoff, and calls the handler's `onAbandoned` hook when the budget is exhausted;
- **Redis-backed distributed throttling** (`apps/backend/src/redis/` + `src/throttling/`) replacing the old in-memory `@nestjs/throttler` storage (Lua-scripted increment/block under a `psa-npic:throttle:v1` namespace; `REDIS_URL` is now required at boot).

**Crucially, none of this changes runtime behavior today**: `OTP_PROVIDER` defaults to `supabase` (Zod-validated, `config.validation.ts:37-41`), and `AuthService.usesInternalOtp()` treats an unset/misspelled key as `supabase` (`auth.service.ts:119-128`), so live phone OTP still flows through Supabase until the toggle is deliberately flipped. The branch also ships a docs stack (`docs/todos/`, `docs/REVIEW.md`, updated `docs/architecture.md` §5, `AGENTS.md`) and an e2e harness (`src/bootstrap.ts`, `test/setup-e2e.ts`) that fixed a pre-existing routing bug (`GET /` → 404, root lives at `/v1`; documented, deliberately not "fixed").

The module is mounted top-level in `AppModule` (as planned, not under `AdminModule`), and the whole thing is green: build, lint, 30 unit suites, 6 e2e tests.

---

## 2. Channel abstraction map (`apps/backend/src/notifications/channels/`)

### 2.1 Contracts — `channels/notification-channel.interface.ts` (64 lines)

| Symbol                          | Lines | Notes                                                                                                                                                                                                               |
| ------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enum ChannelType`              | 8–12  | `SMS = 'sms'`, `TELEGRAM_GATEWAY = 'telegram_gateway'` live; **`// EMAIL = 'email'` commented out** (line 11) so the eventual diff is additive                                                                      |
| `interface NotificationPayload` | 14–22 | `{ phone, code, purpose, expiresAt, metadata? }` — no tenant fields (single-tenant decision)                                                                                                                        |
| `interface NotificationResult`  | 24–39 | `{ success, providerMessageId?, error?: { code, message, retryable } }`; the doc comment on `retryable` (29–35) makes it load-bearing: "The outbox reads this to decide between scheduling a backoff and giving up" |
| `interface ChannelDriver`       | 41–60 | `readonly type`, `deliver(payload)`, optional `canDeliver?` — **a driver is allowed to throw**; containing that is the wrapper's job                                                                                |
| `interface NotificationChannel` | 62–70 | `send()` **never throws** — failures arrive as `NotificationResult`                                                                                                                                                 |

**Live vs reserved:** `SMS` + `TELEGRAM_GATEWAY` are live; `EMAIL` is reserved (commented out). `canDeliver?` is declared on `ChannelDriver` but **never implemented by either channel** (the Gateway precheck covers it inside `deliver()`).

### 2.2 The never-throws wrapper — `channels/composition.channel.ts` (64 lines)

- `GuardedChannel` (15–41): wraps a `ChannelDriver`, implements `NotificationChannel.send()` in a `try/catch`; a thrown error becomes `{ success: false, error: { code: 'unexpected_error', message, retryable: false } }` (29–38). The comment explains `retryable: false` — "a driver that throws has, by definition, failed in a way it did not anticipate… the outbox would spend its whole budget on that guess."
- `composeChannel(driver)` (44–50): one-liner factory; every channel goes through it. This replaced the old `BaseNotificationChannel` abstract class (deleted in commit `33e1220` "batman").

### 2.3 `SmsChannel` — `channels/sms.channel.ts` (31 lines)

- `@Injectable()`; `readonly type = ChannelType.SMS` (line 19).
- Composes the **port** (`@Inject(SMS_CLIENT) client: SmsClientPort`, line 23) rather than a provider; `deliver()` (27–31) builds the body — `` `Your verification code is ${payload.code}. It expires at ${payload.expiresAt.toISOString()}.` `` — and returns `{ success: true, providerMessageId }`.
- **Error mapping: none** — a thrown port error propagates to `GuardedChannel` → `unexpected_error` (non-retryable). The port is a console stub today, so this path is untested in production.

### 2.4 `TelegramGatewayChannel` — `channels/telegram-gateway.channel.ts` (156 lines)

Real integration against `https://gateway.telegram.org` (`GATEWAY_BASE_URL`, line 15) with native `fetch` + `AbortController` 5 s timeout (`REQUEST_TIMEOUT_MS = 5000`, line 16; `callGateway`, 94–118). Auth source: **`TELEGRAM_GATEWAY_ACCESS_TOKEN`** via `configService.get('notifications.telegramGatewayToken')` (41–44) — **never** `TELEGRAM_BOT_TOKEN` (separate product/credential rule; the Bot API token stays reserved for the Telegram Login Widget HMAC check). Flow in `deliver()` (29–92):

1. **Dev bypass** (35–39): if `devOtpToken` set → `{ success: true, providerMessageId: 'dev' }`, zero network calls.
2. **Token check** (41–52): missing token → `{ code: 'gateway_send_failed', retryable: false }` (fails per-call, not at boot).
3. **`POST /checkSendAbility`** (55–72): failure/unreachable → `{ code: 'gateway_invalid_recipient', retryable: false }` (non-retryable, no send attempted).
4. **`POST /sendVerificationMessage`** chained with the precheck's `request_id` (74–91): failure → `{ code: 'gateway_send_failed', retryable: true }`.
5. Network/timeout on either call (via `toTimeoutResult`, 144–154) → `{ code: 'provider_timeout', retryable: true }`.

**Error map summary:** non-retryable = `gateway_invalid_recipient`, missing token; retryable = `gateway_send_failed`, `provider_timeout`.

### 2.5 Composition/retrying wrappers

- **`channels/retrying.channel.ts` — EMPTY (0 bytes).** The inline-retry wrapper the brief asked about does not exist. Retries are owned by the outbox worker (per-event backoff, survives restarts); the old "one inline retry after 500ms" contract from `docs/todos/05` was explicitly retired (`docs/todos/README.md:17-20`: "The retry contract described in 05 — one inline retry after 500ms — no longer exists: retries are the outbox's").
- `channels/email.channel.ts` — **EMPTY (0 bytes)**; `providers/mailer.port.ts` — **EMPTY (0 bytes)**. Both are placeholder files for the reserved Email phase (`docs/todos/09` fast-follow), committed as empty in `33e1220`.

### 2.6 Ports (hexagonal seams) — `providers/`

- `providers/sms-client.port.ts` (44 lines): `SMS_CLIENT = 'SMS_CLIENT'` injection token (22), `interface SmsClientPort { send(request: SmsSendRequest): Promise<SmsSendReceipt> }` (27–30), and the default `ConsoleSmsClient` (37–44) — logs `[stub] would send SMS to <to>: <body>` and returns `console-log-<uuid>`. The seam: wiring Twilio/SNS later is a **binding change only** (bind `SMS_CLIENT` to a new class in `notifications.module.ts:22`), no channel code changes.
- `providers/mailer.port.ts`: empty placeholder (see above).

---

## 3. OTP lifecycle map (`apps/backend/src/notifications/services/` + `utils/`)

### 3.1 Registry — `services/channel-registry.service.ts` (42 lines)

- **Constructor-injected** drivers: `constructor(private sms: SmsChannel, private telegramGateway: TelegramGatewayChannel)` (23–24) — exactly the `docs/todos/03` design (explicit list, no multi-provider token).
- Builds `Map<ChannelType, NotificationChannel>` by wrapping each driver with `composeChannel` (25–31) — so nothing can hand out an unguarded channel.
- `.get(type)` (34–39) **throws** `Error('No notification channel registered for type: …')` on unknown types (per spec: fail at call time, not boot).

### 3.2 Code util — `utils/otp-code.util.ts` (14 lines)

```ts
export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0"); // line 10
}
export function hashOtpCode(code: string): string {
  return createHash("sha256").update(code).digest("hex"); // line 13
}
```

`crypto.randomInt` (never `Math.random()`), plain functions, no DI, no state — as specified.

### 3.3 `NotificationService` — `services/notification.service.ts` (221 lines)

Injects `@Inject(DRIZZLE)` + `OutboxService` + `OutboxDispatcher` + `ConfigService` (31–38) — **no channel imports**, only `ChannelRegistry`/`ChannelType`.

**`issue(phone, purpose='phone_verify')` (48–111):**

1. Generate code + hash, read `otpTtlSeconds` (default 300) / `otpMaxAttempts` (5) / `otpMaxResends` (3) from config (50–57).
2. **One transaction** (68–96): INSERT `otp_requests` row `{status:'pending', codeHash, channel: resolveChannelType(), maxAttempts, maxResends, expiresAt}` **and** `outbox.enqueue(tx, { eventType: 'notification.otp.requested', aggregateType: 'otp_request', aggregateId: request.id, dedupeKey: 'notification.otp.requested:<request.id>', payload: {…code (plaintext)…} })`. The comment (61–67) states the invariant: "If either statement fails, neither exists."
3. **Inline dispatch attempt** (99–106): `await this.dispatcher.dispatchById(eventId)` — claims the same way the worker does, so exactly one of them delivers. Only a **terminal** `failed` outcome surfaces as `{ok:false, reason:'send_failed'}`; a retryable failure returns `{ok:true}` because the event is still in flight.

**`verify(phone, purpose, code)` (114–141)** — replay guard, quoted verbatim (126–137):

```ts
const [consumed] = await this.db
  .update(otpRequests)
  .set({ status: "consumed", verifiedAt: now })
  .where(
    and(
      eq(otpRequests.status, "sent"),
      eq(otpRequests.phone, phone),
      eq(otpRequests.purpose, purpose),
      eq(otpRequests.codeHash, codeHash),
      gt(otpRequests.expiresAt, now),
      lt(otpRequests.attempts, otpRequests.maxAttempts),
    ),
  )
  .returning();
```

All six guards (status/phone/purpose/hash/expiry/**attempts<max**) are in the same `WHERE`, so replay on a consumed row fails (`status` no longer `'sent'`), expiry is lazy (checked at verify-time only), and a maxed-out row can't be consumed even by a correct code.

**`recordMiss` (148–208):** on a verify miss, a second atomic `UPDATE` increments `attempts` and stamps `lastAttemptAt` (153–166, guarded by the same `status='sent'`/expiry/attempts conditions); when the increment tips `attempts >= maxAttempts` it flips the row to `status='failed_max_attempts'` (173–180) and returns `{ok:false, reason:'max_attempts'}`; otherwise `invalid_code`. If even the miss-update didn't match, a diagnostic `SELECT` of the latest row (184–199) names the reason (`max_attempts` / `expired` / `invalid_code`) — "for reporting purposes only".

**`resolveChannelType` (215–221):** `provider === 'telegram_gateway' ? TELEGRAM_GATEWAY : SMS` — `sms` is the default fallback (even for `supabase` direct callers, since AuthService routes around the module in that mode).

### 3.4 `OtpDeliveryHandler` — `services/otp-delivery.handler.ts` (139 lines)

- `OTP_REQUESTED_EVENT = 'notification.otp.requested'` (20), `OTP_AGGREGATE_TYPE = 'otp_request'` (21).
- Self-registers: `onModuleInit() { this.outboxRegistry.register(this) }` (54–56) — that is why the module lists it as a provider with no dependents (`notifications.module.ts:14-19`).
- `handle(event)` (48–88): if `payload.code` is null (already redacted) → `{status:'failed', error:'OTP payload has been redacted…'}` (52–58); else resolve channel from `payload.channel`, `channel.send(...)` (60–68):
  - success → `markSent(requestId, providerMessageId)` → `{status:'published'}`;
  - retryable error → `{status:'retry', error}` — the `otp_requests` row **stays `pending`**, outbox will bring the event back;
  - non-retryable → `markFailed(requestId)` → `{status:'failed', error}`.
- `markSent`/`markFailed` (110–138) **both guard `WHERE status = 'pending'`** — "a duplicate or very late attempt must not walk a row backwards out of `consumed`".
- `onAbandoned` (90–92) settles the row to `failed` when the outbox exhausts its budget.
- `redact(payload)` (93–96): returns `{...payload, code: null}` — the event _must_ carry the plaintext code during delivery (the row only keeps a hash); redaction runs at terminal state (`outbox-dispatcher.service.ts:92`).

**Happy path (plain text):**

1. `POST /auth/otp/request {phone}` → `AuthService.sendPhoneOtp` (if `OTP_PROVIDER ≠ supabase`) → `NotificationService.issue(phone)`.
2. `issue` generates code, hashes it; in one tx inserts `otp_requests(status='pending', code_hash=…)` + enqueues `notification.otp.requested` (payload carries plaintext code).
3. Inline `dispatchById` claims the event (or the worker does — same claim path, one winner), `OtpDeliveryHandler.handle` → `SmsChannel`/`TelegramGatewayChannel.send` → provider call succeeds → `markSent` (`status='sent'`, `sent_at`, `provider_message_id`) → event `published` (payload redacted).
4. User submits `POST /auth/otp/verify {phone, token}` → `NotificationService.verify` → atomic UPDATE matches all six guards → `status='consumed'`, `verified_at=now()` → `{ok:true}` → `mirrorSupabaseUser({phone},'phone',…)` + `issueTokens` (Supabase-free; `auth.service.ts:131-159`).

**Failure path (non-retryable / exhaustion):**

1. `verify` with a wrong code → consume-UPDATE misses → `recordMiss` increments `attempts` → `invalid_code` (401 from `AuthService`).
2. Repeat until `attempts == maxAttempts` → row flipped to `failed_max_attempts`; the next attempt (even with the right code) fails the `lt(attempts, maxAttempts)` guard → `max_attempts`.
3. Or, delivery side: `handle` returns `retry` on `provider_timeout` → dispatcher computes backoff (`1000ms × 5^(attempts-1)` capped at 900 s) and `markRetry` (`status='pending'`, `available_at = now()+delay`); after `max_attempts` (5) the event is `failed` and `onAbandoned` flips the `otp_requests` row to `failed`. The HTTP caller, if it was waiting on the inline dispatch, gets `{ok:false, reason:'send_failed'}` → `AuthService` throws `ServiceUnavailableException('Failed to send OTP')` (503) — new behavior only on the internal path (`auth.service.ts:139-143`).

### 3.5 Module — `notifications.module.ts` (36 lines)

```ts
imports: [ConfigModule, OutboxModule],
providers: [ {provide: SMS_CLIENT, useClass: ConsoleSmsClient}, SmsChannel, TelegramGatewayChannel,
             ChannelRegistry, NotificationService, OtpDeliveryHandler ],
exports: [ChannelRegistry, NotificationService],
```

No per-channel submodules (they were deleted in `33e1220`). **Registered top-level in `AppModule`** (`app.module.ts:90`), not under `AdminModule`, per `docs/todos/00`; also imported by `AuthModule` (`auth.module.ts:14`) so `AuthService` can inject `NotificationService`. Nest dedupes the shared module instance, so `OtpDeliveryHandler` registers with the outbox exactly once.

---

## 4. Outbox + Redis + throttling map

### 4.1 Outbox (`apps/backend/src/outbox/`) — new on this branch, no counterpart on `main`

**Table** — `db/schema/outbox.schema.ts` (78 lines), migration `0014_salty_unus.sql`:

- `outbox_events`: `id uuid PK`, `event_type varchar(80)` (free text, not a pgEnum — "a new event type is a code change, not a migration"), `aggregate_type`, `aggregate_id`, `dedupe_key varchar(200)` with **unique index** (`outbox_events_dedupe_key_idx`; NULLs don't collide — schema comment 29–32), `payload jsonb`, `status enum('pending','processing','published','failed')`, `attempts`/`max_attempts` (default 5), `available_at` (backoff gate), `locked_at`/`locked_by` (lease), `last_error`, `published_at`, `created_at`.
- `otp_request_status` enum (7 values) + `otp_requests` table: migration `0013_third_king_bedlam.sql`.

**`outbox.types.ts` (68 lines):** `TxClient = Parameters<Parameters<DbClient['transaction']>[0]>[0]` / `DbExecutor = DbClient | TxClient` (8–9) — `enqueue()` takes the caller's transaction so "the row and its event commit together or not at all"; `IntegrationEvent` (11–29) with optional `dedupeKey`/`maxAttempts`; `HandlerOutcome = {status:'published'} | {status:'retry'; error} | {status:'failed'; error}` (34–40) — the handler owns the retry-vs-fail distinction because "only the handler knows whether a provider said 'try later' or 'never'"; `OutboxHandler` (42–68) with optional `onAbandoned` and `redact`.

**`outbox.service.ts` (202 lines) — the claim/dispatch/publish/fail/retry/reclaim lifecycle:**

- `instanceId = hostname:pid:<uuid8>` (23) — lease attribution in `locked_by`.
- `enqueue(executor, event)` (35–78): INSERT … `onConflictDoNothing({target: dedupeKey})` … `returning()`; on conflict, re-`SELECT` the existing row and return it "so the caller still has an id to dispatch against" (the dedupe-collision path, 62–77). Only OTP uses it today (`notification.service.ts:89`).
- `claimDue(limit)` (89–91) / `claimById(eventId)` (97–103) — both delegate to private `claim()` (160–183), quoted key part:

```sql
update outbox_events set status='processing', attempts=attempts+1,
       locked_at=now(), locked_by=<instanceId>
where id in (select id from outbox_events
             where <dueCondition> order by available_at
             for update skip locked limit <n>)
returning *
```

- `attempts` counted **at claim time** so a dispatcher that dies mid-send still burns an attempt (comment 156–159).
- `FOR UPDATE SKIP LOCKED` = horizontally-scalable claiming: N instances drain N× faster, no leader election.
- `dueCondition()` (190–202): `(status='pending' and available_at <= now()) or (status='processing' and locked_at < now() - leaseTimeout)` — the second half is **crash recovery/reclaim** of stale leases (`OUTBOX_LEASE_TIMEOUT_SECONDS`, default 60).
- `markPublished` (108–123) clears the lease, sets `published_at=now()`, and stores the handler's **redacted payload** if provided.
- `markRetry` (126–138): `status='pending'`, `available_at = now() + make_interval(secs => delayMs/1000)`, `locked_at/locked_by=null`, `last_error` set.
- `markFailed` (143–154): `status='failed'`, lease cleared, `last_error` set, payload redacted.
- **All timestamps from `now()`**, never the Node clock (comment 8–13) — backoff must not depend on per-instance clock drift.

**`outbox-dispatcher.service.ts` (141 lines):**

- `dispatchDue(limit)` (29–43): claim batch then run handlers **sequentially** — "firing the whole batch at it concurrently is how you get rate-limited."
- `dispatchById(eventId)` (47–54): inline fast-path; returns `null` when the worker claimed first — "exactly one of them delivers" (this is the concurrency guard that keeps the OTP inline send from double-delivering).
- `run(event)` (57–87): missing handler → treated as **retryable**, not fatal (rolling-deploy safety: producer can be live before its consumer); handler throw → caught, treated as retryable.
- `settle(event, outcome)` (90–139): `published` → markPublished; `failed` → markFailed; `retry` → if `attempts >= maxAttempts` → markFailed **+ `onAbandoned`** (the aggregate must not sit in its in-flight state forever), else backoff `computeBackoffMs` → markRetry.
- Backoff (111–118): `baseMs` (1000) × `factor` (5)^(attempts−1), capped at `maxMs` (900,000 ms = 15 min), configurable via `outbox.*`.

**`backoff.util.ts` (23 lines):** pure `computeBackoffMs(attempts, {baseMs, factor, maxMs})` = `min(round(base × factor^(attempts-1)), max)`. **Deliberately NOT jittered** (comment 10–14: SKIP LOCKED means dispatchers never contend for the same row, so there is no thundering herd for jitter to spread out).

**`outbox-worker.service.ts` (114 lines):** the background consumer.

- `onApplicationBootstrap` (24–37): disabled when `outbox.workerEnabled === false` (`OUTBOX_WORKER_ENABLED=false` for API-only instances); else `schedule(0)`.
- **Recursive `setTimeout`, not `setInterval`** (78–88) — "a tick that outruns the interval must not have the next one stack up behind it"; timer is `unref()`'d (87) so polling never keeps the process alive.
- `tick` (90–108): run one batch; poll errors logged and loop continues (including lost DB); a **full batch reschedules immediately** (`schedule(0)`) to drain a backlog, otherwise after `pollIntervalMs`.
- Defaults: `pollIntervalMs` 2000, `batchSize` 10.

**`outbox-registry.service.ts` (37 lines):** `Map<string, OutboxHandler>`; handlers self-register from their own module's `onModuleInit` (not constructor-injected — "naming its consumers here would point the dependency the wrong way"); duplicate registration for the same `eventType` throws (22–25). `eventTypes` getter for introspection. **Exactly one handler registered today: `notification.otp.requested` → `OtpDeliveryHandler`** (`git grep outboxRegistry.register` → only `otp-delivery.handler.ts:55`).

### 4.2 Redis (`apps/backend/src/redis/`)

- `redis.module.ts` (9 lines): `@Global()` module exporting `RedisService`.
- `redis.service.ts` (66 lines): `redis` npm v5 client (`apps/backend/package.json:45` — the branch's only new dependency); `reconnectStrategy` gives up after 3 retries (13–20); `onModuleInit` **connects eagerly and throws** if unreachable — `"Redis is required for distributed throttling and could not be connected"` (34–43). `connection` getter exposes the client. Used by: `RedisThrottlerStorage` only — **Redis is never the outbox or delivery ledger** (`docs/architecture.md:64`; outbox comments repeat this).

### 4.3 Throttling (`apps/backend/src/throttling/redis-throttler.storage.ts`, 124 lines)

- `THROTTLE_KEY_NAMESPACE = 'psa-npic:throttle:v1'` (9); `buildThrottleKey(routeIdentity, tracker, throttlerName)` (14–23) = `namespace:name:sha256(routeIdentity\0tracker)` — the route component keeps unrelated endpoints from sharing a budget.
- `REDIS_THROTTLE_SCRIPT` (27–59): one Lua script doing `TIME`-based now, `HGET/HSET` hits + `blockedUntil`, `HINCRBY`, `PEXPIRE`/`PTTL` — **increment, first-hit expiry, and block state are serialized by Redis in one `eval`** (73–95). Returns `[totalHits, ttlMs, blocked, blockSeconds]`; ms→s conversion happens in `increment` (86–89). `parseResult` throws on malformed replies.
- Wired in `app.module.ts` (56–77): `ThrottlerModule.forRootAsync` with `storage: new RedisThrottlerStorage(redisService)` and `generateKey` from `${context.getClass().name}.${context.getHandler().name}` + tracker. `REDIS_URL` is **required** by Zod (`config.validation.ts:19-23`; spec `config.validation.spec.ts` asserts `redis://`/`rediss://` schemes).
- **Relation to OTP cooldown:** none directly — the OTP resend-cooldown config (`OTP_RESEND_COOLDOWN_SECONDS`) is **never read anywhere** (§6); the Redis throttler is the _global_ request limiter (default 60 s / 100 req), not an OTP-specific rate limiter.

---

## 5. Background-processing inventory

Everything that runs outside the request path on this branch:

| Process                       | File                              | Cadence / config                                                                                                                                | Notes                                                                                                             |
| ----------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **OutboxWorker poll loop**    | `outbox-worker.service.ts:78-108` | recursive `setTimeout`, default 2000 ms (`OUTBOX_POLL_INTERVAL_MS`); batch 10 (`OUTBOX_BATCH_SIZE`); disabled via `OUTBOX_WORKER_ENABLED=false` | Runs in-process on **every** instance (safe: atomic claims); immediate re-poll on a full batch; timer `unref()`'d |
| **Stale-lease reclaim**       | `outbox.service.ts:190-202`       | implicit in every claim: `processing` rows with `locked_at` older than `OUTBOX_LEASE_TIMEOUT_SECONDS` (60) are re-claimed                       | No separate cron; crash recovery is poll-driven                                                                   |
| **Inline dispatch fast-path** | `notification.service.ts:99-106`  | per-`issue()` call, not a timer                                                                                                                 | Same claim mechanism as the worker — exactly-one-delivery                                                         |
| **Redis reconnect backoff**   | `redis.service.ts:13-20`          | `min(retries*100, 500)` ms, max 3 retries then error                                                                                            | Not a background loop per se                                                                                      |
| Cron/schedule jobs            | —                                 | **none**                                                                                                                                        | `git grep @Cron                                                                                                   | @nestjs/schedule`→ no hits; retention sweep of`otp_requests`/`outbox_events` is a *deferred* fast-follow (`docs/todos/09`, `AGENTS.md:524-525`) |

**App wiring confirmed in `app.module.ts`:** `RedisModule` (54), `ThrottlerModule.forRootAsync` (56–77), `OutboxModule` (89), `NotificationsModule` (90) — all mounted; `OutboxWorker` boots via `OnApplicationBootstrap` when the module graph loads. `AuthModule` additionally imports `NotificationsModule` (`auth.module.ts:14`). Nothing else on this branch runs on a timer.

---

## 6. Wiring / gap findings (docs-vs-code drift, dead code, risks)

### 6.1 Docs-vs-code drift (most acknowledged in the branch's own docs)

| Doc claim                                                                                                                         | Code reality                                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/todos/03`: "ChannelRegistry constructor-injected with `TelegramGatewayChannelAdapter`… imports Telegram Gateway sub-module" | Registry injects `SmsChannel` + `TelegramGatewayChannel` (`channel-registry.service.ts:23-24`); per-channel modules deleted in `33e1220`; acknowledged in `docs/todos/README.md:15-17`                                                                                               |
| `docs/todos/05`: "`issue()` calls `channelRegistry.get(ChannelType.SMS)`" + "retry send once after fixed 500ms"                   | `issue()` enqueues an outbox event + inline `dispatchById`; retries are the outbox's, backoff-based; `retrying.channel.ts` is an empty file. Acknowledged in `docs/todos/README.md:17-20`                                                                                            |
| `docs/todos/05` action items reference `OtpService`                                                                               | Renamed to `NotificationService` (naming correction documented in `docs/todos/05` header and `06`)                                                                                                                                                                                   |
| `docs/todos/02` says migration "next after `0012_blushing_sentinel`"                                                              | True: `0013` (`otp_requests`), `0014` (`outbox_events`) — `main`'s journal ends at idx 12                                                                                                                                                                                            |
| `docs/REVIEW.md` (449 lines, added by commit `2cb49e6` "review the project")                                                      | **Reviews `main` at `f008db6`**, not this branch — a state-of-the-project review (file-deletion auth, idempotency caching errors, mock web surface…). Not a review of the notifications code. `docs/architecture.md` §5 "Outbox contract (implemented)" is the up-to-date branch doc |
| `AGENTS.md` on this branch is the authoritative current doc                                                                       | Matches code (verified throughout) — includes `GET /` drift note (§6.3)                                                                                                                                                                                                              |

### 6.2 Dead / dormant code on the branch

- **The whole internal OTP path is dormant by default.** `OTP_PROVIDER` defaults to `supabase` (`config.validation.ts:37-41`, `.env.example`); `AuthService.usesInternalOtp()` treats unset as `supabase` (`auth.service.ts:119-128`). Live traffic never calls `issue()`/`verify()` until someone flips the env var. The `supabase` branch in `sendPhoneOtp`/`verifyOtpViaSupabase` is byte-equivalent to the old code.
- **`OTP_RESEND_COOLDOWN_SECONDS` — validated, config-blocked, never read.** `git grep otpResendCooldownSeconds` → only `config.validation.ts:34` + `configuration.ts:46`. There is **no resend cooldown enforcement in code** (`/auth/otp/request` re-issues unconditionally, creating a fresh `otp_requests` row each time).
- **`resendCount` never incremented; `maxResends` written but never enforced** (`notification.service.ts:56,75` write the column on insert; nothing reads it).
- **`verified` and `expired` enum values are never written** to `otp_requests.status` (they exist only in `notifications.schema.ts:16,18`; `expired` surfaces only as a verify _reason_, `notification.service.ts:204` — lazy expiry, row stays `sent`).
- **Empty placeholder files:** `channels/retrying.channel.ts`, `channels/email.channel.ts`, `providers/mailer.port.ts` (all 0 bytes).
- **`canDeliver?`** declared on `ChannelDriver` (`interface.ts:58`) — never implemented by either channel.
- **`otp_requests.channel` column default is `'telegram_gateway'`** (`notifications.schema.ts:25`) but `resolveChannelType()` defaults to `sms` — a cosmetic mismatch (the column is always written explicitly by `issue()`, so the default is inert).
- **`DEV_OTP_TOKEN` semantics differ between the two paths.** On the Supabase path it makes `verify` accept a fixed token. On the internal path it only short-circuits **Telegram Gateway `send()`** (`telegram-gateway.channel.ts:35-39`) — `NotificationService.verify()` never accepts a fixed token (it hashes the submitted code). Dev consequence: with `OTP_PROVIDER=telegram_gateway` + `DEV_OTP_TOKEN`, the code is generated and "sent" but never shown anywhere (the `otp_requests` row stores only the hash; the plaintext sits in `outbox_events.payload` until redaction) — effectively unrecoverable to a tester. The workable local loop is `OTP_PROVIDER=sms` + `ConsoleSmsClient` (code printed to the Nest log) — or `supabase` + `DEV_OTP_TOKEN` as today.

### 6.3 Risks / findings worth a captain's attention

1. **`GET /` is 404; the root handler lives at `GET /v1`.** `AppController` is not `VERSION_NEUTRAL` (only `HealthController` is, `health.controller.ts:8`), so URI versioning moves the root route. The e2e suite documents this deliberately (`app.e2e-spec.ts:52-62`: "Documents current behaviour; contradicts AGENTS.md's 'Root: GET /'"). `docs/todos/08` notes the fix is one decorator — **this is a pre-existing bug the branch surfaced, not introduced**.
2. **Outbox rows are never reaped.** `published`/`failed` rows accumulate forever (no retention sweep; same gap as `idempotency_keys`). `AGENTS.md:524`.
3. **No visibility into failed events.** `last_error` is recorded, but no admin endpoint/metric/alert reads it (`AGENTS.md:525`). A failed OTP send is only discoverable by querying the table.
4. **Redis is a hard boot dependency.** `REDIS_URL` required by Zod; connection failure aborts startup. No process-local fallback for the throttler (deliberate — `app.e2e-spec.ts` stubs `RedisService` because `onModuleInit` dials Redis).
5. **SMS provider is a console stub** (`ConsoleSmsClient`) — `docs/todos/09` fast-follow. `OTP_PROVIDER=sms` in production would "send" SMS to the log.
6. **Idempotency note:** the outbox dedupe key is `notification.otp.requested:<new-uuid>` — unique per `issue()` call, so it guards against double-enqueue of the _same request_, not against re-issuing. Repeated `/auth/otp/request` calls each mint a fresh request + event (no cooldown — see §6.2).
7. **Test coverage** is strong for the new code (OTP lifecycle replay/lockout, gateway error mapping, outbox claim/backoff/abandon, worker polling, throttler script) but there is **no OTP-flow e2e against real Postgres** (acknowledged in `docs/todos/08`; the atomic `UPDATE` is only covered by mocked-DB unit tests), and the SMS channel error path is untested (port never fails in tests).

---

## 7. In-app / user-alerting assessment (the captain's goal)

**Verified baseline:** there is **no in-app notification table** today — `git grep` over `apps/backend/src/db/schema/` shows no `notifications` inbox table (only `otp_requests`/`outbox_events` on this branch; `chat.schema.ts` has `conversations` + `messages`). The web app has a `/notifications` page (`apps/web/app/[locale]/(user)/notifications/page.tsx`) rendering `components/home/Notifications.tsx`, which is **hardcoded mock data** ("You have been logged in on a new device.", `Notifications.tsx:4-40`) — consistent with `REVIEW.md` finding #6 (the user-facing marketplace is mock-driven). `apps/web/lib/user.ts:109,141` shows a mock `notifications: []` field on the session user.

### Q1 — Where does "in-app" fit the channel abstraction?

The current abstraction is **strictly outbound and push-only, but an `IN_APP` channel would slot in cleanly**:

- `ChannelType` is a plain string enum (`notification-channel.interface.ts:8-12`); adding `IN_APP = 'in_app'` is the same additive change the file was designed for (EMAIL is kept commented "so the eventual enum diff is additive, not a rename").
- `NotificationPayload` (`14–22`) is OTP-shaped (`phone`, `code`, `purpose`, `expiresAt`). An in-app alert doesn't have a phone/code, so the payload type would need widening (e.g. `{ userId, title, body, type, metadata?, link? }`) or a second payload interface. That is the main interface friction.
- `NotificationChannel.send()` means "deliver to a person". For in-app, `send()` could mean either (a) **persist a row** in a `notifications` inbox table, or (b) **push over WebSocket** to that user's online connection — or both (persist + push). Both are legitimate `send()` implementations; nothing in the interface constrains the transport.
- **Caveat:** the whole OTP pipeline (payload shape, `otp_requests` lifecycle, `OtpDeliveryHandler`) is phone-OTP-specific. An `IN_APP` channel would be the _first_ channel that isn't a wire transport, and the first whose "send" is _stateful_ (a persisted row the user later reads). The outbox would happily carry it, but the OTP row lifecycle (`markSent` etc.) does not generalize — that stays OTP-specific and is not in the way.

### Q2 — Persistence

Verified: no inbox table exists. It would need roughly:

- `notifications` (inbox): `id uuid PK`, `user_id uuid FK → users` (per-user delivery), `type varchar` (e.g. `new_message`, `listing_activity`, `admin_alert`), `title`/`body text`, optional `link`/`payload jsonb`, `read_at timestamp nullable` (read/unread = `read_at IS NULL`), `created_at`. Index on `(user_id, created_at desc)`; optionally a partial index `WHERE read_at IS NULL` for unread counts — **exactly the pattern `messages` already uses**: `messages_conversation_unread_idx` partial index `WHERE read_at is null` on `(conversationId, senderId)` (`chat.schema.ts:64-66`), plus the bulk mark-read (`POST /chats/:id/read`) precedent.
- Per-user delivery = `user_id` FK; global broadcasts (if ever needed) = null `user_id` or a sentinel.
- Compared to chat's schema (`conversations` pair-unique + `messages` with `readAt`, `chat.schema.ts:9-82`): an inbox is _simpler_ — no pair canonicalization, no conversation entity; one row per alert, unread = null `read_at`. The chat schema is the right design reference for the unread/mark-read mechanics; the inbox table itself is new.

### Q3 — Realtime delivery (the brief's premise is wrong — important)

The brief assumed "chat already has a `/ws/chat` WebSocket gateway + `ConnectionRegistry` + `HeartbeatService`". **These do not exist** (verified: no `WebSocketGateway`, `socket.io`, or `@nestjs/websockets` anywhere in `apps/backend`; no `ConnectionRegistry`/`HeartbeatService` symbols; chat is REST + polling — `chat.controller.ts` routes, `ChatMessagesMeta.latestCursor` drives `after=` polling, `AGENTS.md:252-268,537`). Consequences:

- **There is no existing WS infrastructure to reuse.** The "cleanest reuse" path would require _building_ the gateway + connection registry + heartbeat from scratch (plus the `@nestjs/websockets`/`socket.io` dependency), then deciding whether chat also migrates to it (out of scope for a notification feature).
- **The cheapest realtime path today is polling**, matching how chat already works: a `GET /api/v1/notifications?after=<cursor>` endpoint (cursor on `(createdAt, id)`, the same pattern as `GET /chats/:id/messages?after=`) + a `GET /api/v1/notifications/unread-count` badge endpoint (mirror of `GET /chats/unread-count`). This is zero new infra, works for the current mock-driven web, and is upgradeable to WS later without changing the API contract.
- **If/when a WS gateway is built**, the clean shape is exactly what the brief suggested: a new outbox topic whose handler (a) writes the `notifications` row, then (b) pushes `{type:'notification', …}` to the recipient's connection if online. The connection registry should be gateway-scoped (user-id → socket map, with heartbeat), independent of any specific alert type.

### Q4 — Event source

Candidate producers and the outbox pattern (verified against this branch's mechanics):

- **New chat message** — `ChatService.sendMessage` currently inserts the message in one statement (`chat.service.ts`; no transaction wrapper today). Adding an outbox event would mean wrapping insert + `enqueue(tx, {eventType:'chat.message.sent', dedupeKey:'chat.message.sent:<messageId>'})` in a transaction — but note **only OTP enqueues today, and the outbox is explicitly opt-in per module** (`outbox.module.ts:12-15`: "Not `@Global()`… an importer is making a real architectural choice"). Chat would need to import `OutboxModule` and add the event.
- **Listing activity** (someone viewed/contacted your listing, your ad was published/expired) — the natural hook is `ListingsService.publish()` / contact flows (`apps/backend/src/listings/`), same transaction-wrapped enqueue.
- **Admin actions** (account moderation, subscription grant/expiry) — `AdminModule` services (`admin/`), e.g. `UserSubscriptionsService` grant/delete.
- **OTP/auth events** — already produced (`notification.otp.requested`); in-app "you logged in on a new device" alerts (which is what the web mock literally shows) would be a _second_ event or a new handler on the same aggregate.
- All of these fit "a new topic + a registered handler" — `OutboxRegistry.register(handler)` from the handler's `onModuleInit`, exactly how `OtpDeliveryHandler` does it (`otp-delivery.handler.ts:54-56`). One per type; duplicate registration throws.

### Q5 — Recommendation (smallest clean path; a recommendation, not authorization)

**Phase A — persistence + REST (no new infra, no WS):**

1. New `notifications` inbox table (schema per Q2, modeled on `messages`' unread partial index + mark-read precedent) — migration `0015`, generated not hand-written.
2. New `InAppNotificationService` + a controller with `GET /api/v1/notifications` (cursor `after=`) and `GET /api/v1/notifications/unread-count` + `POST /api/v1/notifications/read` (bulk mark-read, mirroring `chats/:id/read`). Web: swap the mock `Notifications.tsx` for the real endpoint (the mock already shows the intended UX).
3. A new outbox topic, e.g. `user.notification.created`, with a handler that inserts the inbox row. Enqueue it from the first real producer (chat message send is the highest-value and simplest: wrap the existing insert in a transaction with `enqueue`). `redact()`/`onAbandoned` are optional for in-app (no secrets; a failed insert is retried by the outbox).

**Phase B — realtime (only if the captain wants push):** 4. Decide WS vs polling. **Recommendation: keep polling for v1** (it is the established chat pattern, zero new dependencies, and the web app is mock-driven anyway — there is no client polling infra to reuse yet either). If push is required, build a single `@nestjs/websockets` gateway + user-id→socket registry + heartbeat as _new_ infrastructure (the brief's premise of reusing chat's WS is not available), and have the `user.notification.created` handler push `{type:'notification'}` after persisting. Migrating chat to the same gateway is a separate project.

**Channel-vs-topic question (needs a product decision):** treating in-app as a `ChannelType` (an `IN_APP` driver whose `send()` persists + pushes) is _clean_ — it reuses `ChannelRegistry`, `GuardedChannel`, the never-throws contract, and the retryable semantics — but it drags the OTP-shaped `NotificationPayload` (phone/code) into the design, and in-app alerts don't naturally flow through a "channel for a person" the way OTP codes do (an alert is per-user + per-type, not per-phone). The dedicated outbox topic + handler keeps the notification module's channel abstraction purely for _outbound wire transports_ and adds in-app as a _consumer concern_. **Recommendation: dedicated outbox topic + handler + inbox table, and do NOT add `IN_APP` to `ChannelType` unless the captain wants one unified "deliver this to a user" abstraction** (in which case widen `NotificationPayload` to carry `userId`/`title`/`body` and add an `IN_APP` driver — it would slot in without touching SMS/Gateway).

**Decisions the captain must make (flagged, not answered):**

1. In-app as a `ChannelType` vs. separate outbox-topic concern (recommended: topic).
2. Realtime via polling (recommended v1) vs. new WS gateway infrastructure.
3. Which business events produce alerts first (chat message is the smallest, most valuable seed; the web mock suggests "new-device login" auth alerts too).
4. Whether `otp_requests`/`outbox_events` need a retention sweep before this grows (they already grow unboundedly — adding inbox rows on top makes the hygiene question more pressing).

---

## 8. Appendix — evidence commands

```bash
git checkout feat/notifications                      # 33e1220 "batman"; verified branch
git diff --stat main feat/notifications              # 81 files, +13812/-573
git ls-tree -r --name-only main | grep -i outbox     # → (empty): main has NO outbox
git grep -il "websocket\|socket.io\|@nestjs/websockets" feat/notifications   # → only AGENTS.md text
git grep -l "WebSocketGateway" feat/notifications -- apps/backend/**          # → (empty)
git grep -rn "ConnectionRegistry\|HeartbeatService" apps/backend/src/         # → (empty)
git grep -n "@Cron\|@nestjs/schedule" feat/notifications -- apps/backend/src/**  # → (empty)
git grep -n "otpResendCooldownSeconds" feat/notifications -- apps/backend/src/** # → config only
git grep -n "\.enqueue(" feat/notifications -- apps/backend/src/**             # → notification.service.ts:89 only
pnpm install --frozen-lockfile                       # OK
pnpm --filter backend test                           # 30 suites / 240 tests passed
pnpm --filter backend build                          # nest build OK
pnpm --filter backend test:e2e                       # 6 tests passed (Redis stubbed)
pnpm --filter backend lint                           # OK, no changes
```

**Key file:line index:** interface `channels/notification-channel.interface.ts:8-70` · GuardedChannel `channels/composition.channel.ts:15-50` · SMS `channels/sms.channel.ts:18-31` · Gateway `channels/telegram-gateway.channel.ts:29-154` · registry `services/channel-registry.service.ts:17-39` · OTP core `services/notification.service.ts:48-221` (atomic guard 126-137) · handler `services/otp-delivery.handler.ts:20-138` · code util `utils/otp-code.util.ts:8-14` · module `notifications.module.ts:16-36` · outbox schema `db/schema/outbox.schema.ts:34-68` · outbox service `outbox.service.ts:35-202` (claim 160-183) · dispatcher `outbox-dispatcher.service.ts:29-139` · worker `outbox-worker.service.ts:24-108` · backoff `backoff.util.ts:16-23` · registry `outbox-registry.service.ts:16-31` · redis `redis.service.ts:9-63` · throttler `throttling/redis-throttler.storage.ts:9-95` · wiring `app.module.ts:54-92` · auth toggle `auth/auth.service.ts:93-159` · config `config/config.validation.ts:19-67`, `config/configuration.ts:40-60` · migrations `0013_third_king_bedlam.sql`, `0014_salty_unus.sql` · chat schema `db/schema/chat.schema.ts:9-82` · e2e `test/app.e2e-spec.ts:1-78` · mock web UI `apps/web/components/home/Notifications.tsx:4-40`.
