# Data plane: plaintext body surfaces & codec insertion points (task-2)

Read-only audit. Tags: [V] verified, [R] refuted, [P] partial. Cites are repo-relative path:line. Code is truth; docs not used.

## 1. Writes — every write of message content

- [V] One write funnel, no repository layer: `ChatService.sendMessageInternal` builds `values{}` (chat.service.ts:336-349, `body: dto.body` :339) and inserts inline Drizzle at chat.service.ts:379 (v2 tx) / :407 (v1). Grep `insert(messages)` repo-wide returns exactly those two.
- [V] New writes are client-E2E ciphertext, not plaintext: no `e2eHeader`/`e2e` -> 400 "Encrypted messages are required" (chat.service.ts:215-216); no body -> 400 (:217-218); legacy `imagePath` -> 400 (:221-222). So the review's "plaintext body today" is [R] for new rows.
- [P] But the DB accepts plaintext: `body text` nullable (chat.schema.ts:85), `is_e2e` default false (:102), only checks are content-present and <=24000 chars (:141-149). "Encryption only" is app-level, no constraint.
- [V] Second producer, same funnel: job applications forward `dto.body` into `chat.sendMessage` (applications.service.ts:150-164) behind its own encrypted-only 400s (:135-136); no separate message insert.
- [V] Legacy plaintext rows persist: 0021 added `is_e2e` default false (0021_perfect_tarantula.sql:23-24) and 0027 backfilled `e2e_version=1` only where `is_e2e=true` (0027_brave_scarlet_spider.sql:71). Pre-0021 bodies are still plaintext and still served.

## 2. Reads — who reads the column, direct vs repository

All are direct Drizzle on the `messages` row; there is no repository/aggregate layer in `chat/` (only chat.service.ts, chat.types.ts, chat-attachments.service.ts touch the table).

- GET /chats (inbox): selects `conversations` only (chat.service.ts:519-524); last message is a per-read full-row `selectDistinctOn` (chat.service.ts:985-1000) + `attachEnvelopes` (:1007-1044). Full `body` computed on every inbox page.
- GET /chats/with/:userId (:572-580) and POST /chats/with/:userId (:638) reuse `buildInboxItems` (:956-983) -> same full-row read.
- GET /chats/:conversationId/messages: full-row `select()` (chat.service.ts:740-749), body returned untouched (:775-789).
- Send replay by clientMessageId: full-row `select()` (chat.service.ts:858-867) -> same row echoed.
- WS fan-out: `publishChatEvents` sends `payload: withListing` incl. body (chat.service.ts:463-479) -> pubsub JSON.stringify to Redis (chat-pubsub.service.ts:90-92) -> gateway frame (chat.gateway.ts:79-89); sender ack also carries the row (chat.gateway.ts:247-250). Body crosses Redis and two sockets.
- Attachments sign: joins messages+conversations but selects only `{id, objectKey}` (chat-attachments.service.ts:215-229) — [V] no body read.
- Unread count / markRead: aggregates and `readAt` only (chat.service.ts:800-810, :831-847) — no body.
- Admin/report/moderation: [R] none. `chat.schema` is imported only by the chat module + applications via ChatService. Only chat admin route is `GET /admin/chat-metrics` latency snapshot (admin.controller.ts:38-48). Reports have zero message references.
- Notifications: [V] no message-body notification. The only chat type is content-free `chat.e2e_nudge` (e2e-nudge.service.ts:101-114). `application.created` copies a plaintext cover-note snippet (applications.service.ts:503-513) — job_applications content, not `messages.body`.
- Search: [R] no ILIKE/full-text over `messages` anywhere; ILIKE exists only on listings.title/description, users, feedback, brands/models (keyword-search.ts:58-59, admin.service.ts:243-247, feedback.service.ts:74-77). No chat search endpoint.
- Push/outbox: [R] none. No FCM/APNs; chat deliberately skips the outbox (chat-pubsub.service.ts:32-47); outbox.types.ts:16 mentions `chat.message.sent` only as a namespace example, with no producer.
- Logs/metrics/analytics: [V] no content. Request logger prints method/url/status/ms/userId only (request-logger.middleware.ts:22); slow-send warn has senderId+duration (chat.service.ts:126-131); exception filter logs message/status (:66-68); metrics are timings (chat-metrics.service.ts:40-57).
- Web: inbox type carries `lastMessage: ChatMessage` (types/chat.ts:99-106); `useE2eInboxPreviews` decrypts then caches plaintext in IndexedDB (use-e2e-inbox-previews.ts:62-74); `previewOf` blanks unresolved ciphertext (:110-113) but returns `message.body` raw for non-E2E rows (lib/chat/format.ts:115); thread likewise (message-thread.tsx:368-369, message-bubble.tsx:106-116). Fetch is `cache:"no-store"` (lib/api/user-client.ts:61).
- Mobile: [R] no chat API read; the chat screen is local mock data (apps/mobile/app/(tabs)/chat.tsx:43-60).

## 3. Denormalised copies

- [V] `conversations` has no preview text column: only `lastMessageAt` (chat.schema.ts:34-39) + per-side delete flags (:49-50); no `last_message`/preview column has ever existed (grep over 50 migrations). Inbox preview is computed per read, not stored.
- [V] `message_count` exists only in `e2e_backup_segments` (chat.schema.ts:384) — a client-declared count for one ciphertext segment, not content.
- [P] `e2e_backup_segments.ciphertext` (chat.schema.ts:383) is a second full copy of message history, client-encrypted under a backup key the server never sees; written e2e-backup.service.ts:278-285, read :307-336. Server-blind today, orphaned if E2E goes.
- [P] `idempotency_keys.response_body` (idempotency.schema.ts:30) stores the whole response JSON for every POST/PATCH/PUT (app.module.ts:136-141), so a chat send would persist `messages.body` there for 24h (idempotency.middleware.ts:61-64, :180-185). The web chat client sends no Idempotency-Key, so this is a latent path, not an active leak.
- [V] `notifications.title/body/data` (notifications.schema.ts:30-35) carry no chat body — only the cover-note snippet above.
- [P] Redis pub/sub payloads and WS frames are transient body copies; no AOF/persistence config is in this repo to rule them out.

## 4. Attachments

- [P] Private bucket `chat-files`: privacy is a dashboard setting documented in config.validation.ts:14-17 ("Create it in the Supabase dashboard with public off"); no code creates the bucket or asserts it is private.
- [V] Upload: `POST /chats/attachments` reserves row `{userId}/{id}` and returns a signed upload URL via `SupabaseService.createSignedUploadUrl` (chat-attachments.service.ts:340-361, supabase.service.ts:90-104), 2h TTL (chat-attachments.constants.ts:18); `complete` trusts storage-reported size only (:119-145); attach inside the send transaction (:153-183).
- [V] Download: `POST /chats/attachments/sign` checks participation via a messages->conversations join (:215-229) then signs 300s URLs (supabase.service.ts:120-130; TTL constants:16). Leaked URL yields ciphertext.
- [P] Server-blind claim is slightly overstated: MIME/name/dims live in the body, but coarse `kind` ('image'|'file') is stored and returned (chat.schema.ts:430, chat.types.ts:33-36).
- [V] Body-encryption removal changes nothing mechanically, but attachment keys ride inside the body — if the server can read bodies it can also decrypt every attachment. Legacy `imageUrl`/`imagePath` rows are plaintext public-bucket images, unaffected by any body codec (new sends rejected: chat.service.ts:221; web renders them directly: message-bubble.tsx:82-89).

## 5. Ordered "must route through the codec" list + the one test

Highest leak risk first (today all of these carry ciphertext; each becomes plaintext if the codec is only applied at the insert):

1. Write funnel: chat.service.ts:336-349 -> :379/:407. One gate covers REST, WS, applications.
2. History read: chat.service.ts:740-749.
3. Inbox last-message read: chat.service.ts:985-1000 (second full-body path, hit on every inbox page).
4. Replay read: chat.service.ts:854-885.
5. WS fan-out + ack: chat.service.ts:463-479 -> chat-pubsub.service.ts:90-92 -> chat.gateway.ts:79-89, :247-250 (Redis/network copies).
6. Applications ingress: applications.service.ts:150-164 (second caller, own DTO).
7. Idempotency response capture: idempotency.middleware.ts:180-185 (server-side copy of whatever the API returns).
8. Web passthrough branches: lib/chat/format.ts:115 and message-thread.tsx:368-369 — legacy rows render `body` raw; these must not survive as a "plaintext fallback".
   Not needed: attachments (already ciphertext), admin/report/search (no surface exists to retrofit).

Test I would add: insert-path plaintext-marker scan — send a message whose plaintext is a unique marker, then assert no persisted row (messages.body, and any response/backup/idempotency copy) contains it.

- [R] It cannot run in the current Jest setup. Unit config is rootDir=src, testRegex `.spec.ts` (apps/backend/package.json:103-105) and every chat spec hand-mocks Drizzle (chat.service.spec.ts:9-23): no real DB, no globalSetup, no container. The only e2e spec boots AppModule and asserts `GET /` (test/app.e2e-spec.ts:7-24), and CI runs only `pnpm --filter backend test` (ci.yml:56-57) with no Postgres service, so `test:e2e` never runs either.
- Runnable today without new infra: a codec-spy unit test asserting the object handed to `insert(messages)` (or the codec's return) never contains the marker. A true row scan needs a Postgres service + applied migrations in CI.

## Gaps the review missed

- No KMS/DEK/key-management layer exists to "replace" E2E with: backend has zero crypto deps (apps/backend/package.json:31-63) and no key env vars (config.validation.ts:3-186). Server-held DEKs are net-new trust surface plus a new failure domain, not a swap of one module.
- Legacy plaintext rows are already in `messages` (0027:71 only re-tagged `is_e2e=true`). Dropping E2E leaves them plaintext forever and the web renders them raw (lib/chat/format.ts:115) — no backfill migration is planned or present.
- Retention does not exist: only per-participant hide (chat.schema.ts:49-50) and account-purge cascade (account-purge.service.ts:149-154). "Keep retention" is new work, and `e2e_backup_segments` has no cleanup at all.
- Three body copies sit outside any DB-layer codec: Redis pub/sub payload, WS frames, `idempotency_keys.response_body`. A codec at the repository seam misses all three.
- Attachment confidentiality is coupled to the body: keys/metadata live inside it, so "server can read messages" silently means "server can read every attachment".
- The 24000-char body cap is sized for base64 ciphertext (send-message.dto.ts:32-35, chat.schema.ts:149) and main.ts:20-26 raised the JSON limit to 1 MB for backup segments; a codec envelope changes both budgets.
- There is no admin/moderator message read surface today, so the proposed "admin decrypt access log" would log accesses that cannot happen — it needs an endpoint (and an authorization model) before its log means anything.
- Nothing in CI can catch a plaintext regression: no DB, no integration suite, and the send path is only covered by hand-mocked unit specs.
