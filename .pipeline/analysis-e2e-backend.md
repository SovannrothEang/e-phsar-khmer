# Backend E2E chat surface & send path — verification (task-1)

Read-only audit of apps/backend. Tags: **V** = claim verified, **R** = refuted, **P** = partial. Paths repo-relative.

## 1. Endpoints, guards, returns

All REST E2E routes inherit the two global guards (no local @UseGuards/@Roles): `JwtAuthGuard` then `UserAwareThrottlerGuard` (app.module.ts:127-128); JwtAuthGuard only skips @Public (auth/guards/jwt-auth.guard.ts:12-20) and none of these routes is public. Global prefix `api` + URI version 1 (main.ts:28-30) ⇒ `/api/v1/...`.

- **v1 keys**, @Controller('chats/e2e/keys') (e2e/e2e-keys.controller.ts:17): `POST /` → upsert identity + signed prekey, insert OTPs, `{accepted}` (:21-28); `GET /me/prekey-count` → `{available}` (:30-34); `GET /:userId/bundle` → X3DH bundle claiming one OTP, 403 blocked / 404 never-registered (:36-43). No route-level throttle (global 100/60s only).
- **v2 devices**, @Controller('chats/e2e') (e2e/e2e-devices.controller.ts:27): `POST /devices` → `{deviceId}`, upsert-or-claim by identity key, evicts past 5 (:31-41); `POST /devices/:deviceId/heartbeat` → `{available}`, 404 when revoked (:43-55); `POST /devices/:deviceId/prekeys` → `{accepted}` (:57-65); `GET /users/:userId/devices` → `string[]` of active device ids, block-gated unless self (:67-76); `GET /devices/:deviceId/bundle` → per-device bundle claiming one OTP, 404 unless device is in its owner's active/fallback set (:78-87).
- **backup**, @Controller('chats/e2e') (e2e/e2e-backup.controller.ts:30): `GET /backup` → {exists,keyCheck,hasPasscode,passcodeSalt,passcodeParams,lockedUntil} (:34-38); `POST /backup` first-device-wins init (:40-47); `PUT /backup/passcode` (:49-56); `POST /backup/unlock` → `{wrappedKey}` after bcrypt check (:58-67); `POST /backup/segments` (:69-77); `GET /backup/segments` (:79-87). Local @Throttle 10-60/min on 4 of the 6.
- **nudge**: `POST /chats/e2e/nudge/:userId` → `{sent}` (e2e/e2e-nudge.controller.ts:27-39); 24 h cooldown via a notification row, optional active-listing title (e2e-nudge.service.ts:38-117). It never checks that the recipient actually has no device — it is a content-free notification sender, nothing more.
- **attachments** (v2-coupled): `POST /chats/attachments`, `POST /chats/attachments/sign`, `POST /chats/attachments/:id/complete` (chat-attachments.controller.ts:15,25,33); no E2E import, but `attachmentIds` is 400 unless `e2e` is present (chat.service.ts:234-237).
- **WS**: one gateway `@WebSocketGateway({path:'/ws/chat'})` (chat.gateway.ts:46); `send_message` (:199). Handshake auth: ticket/token/header/cookie, then deleted-user and login-session checks (:91-169); in-memory 30/min limiter (:56-57,337-350). Every outcome = exactly one frame: ack `{clientMessageId,conversationId,message}` or error `{clientMessageId,code,message,details}` (:187-254).
- Nothing else exposes E2E data: no admin endpoint reads messages, keys, backups or envelopes.

## 2. Send path (the one implementation)

- `ChatService.sendMessage` → `sendMessageInternal` (chat.service.ts:115-132,193). REST `POST /chats/messages` (@Throttle 30/60s, chat.controller.ts:53-65) and WS (:246 chat.gateway.ts) both call it; there is no transport-specific E2E code.
- Gates: clientMessageId replay returns the original row (:203-209); self-send rejected; **E2E is mandatory** — neither `e2eHeader` nor `e2e` ⇒ 400 "Encrypted messages are required" (:215-218); `imagePath` ⇒ 400 (:221-222); `body` required (:217-218); duplicate envelope device / envelope to the sending device / attachments without e2e ⇒ 400 (:227-237).
- Device-set rule in `assertEnvelopesCoverActiveDevices` (:157-191): 403 `E2E_DEVICE_INACTIVE` (sender device not in active set), 404 `E2E_NO_RECIPIENT_DEVICES` (peer has none), 409 `E2E_DEVICES_MISMATCH` with `details:{missing,stale}` (:185-190) computed by `diffDevices` (e2e/e2e-devices.util.ts:102-112).
- Expected set = `loadTargetDevices` (e2e-devices.util.ts:69-89): all non-revoked devices of the given users, per user the fresh ones (lastSeen < 30 d) else the 2 most recently seen (`pickTargetDevices` :39-61; constants :6,13,21). The same function backs the devices endpoint, bundle fetch and both send checks (:63-68) — so "server expected set" has exactly one definition.
- `lockE2eDeviceKeys` (:127-139): transaction-scoped `pg_advisory_xact_lock(hashtextextended('e2e-devices:<userId>',0))`, keys deduped+sorted; a send locks sender+recipient so `registerDevice` (e2e-keys.service.ts:225) cannot land between check and insert. Fixed lock order (not the lock itself) is what avoids deadlock.
- Two checks: fast-failing read in the parallel prelude (:246-277, 306-312) and authoritative re-read under the locks inside the tx (:368-378).
- **Transaction covers message + envelopes + attachments**: one `db.transaction` (:361-405) → messages insert (:379), message_envelopes insert (:380-394), `attachments.attachToMessage(tx,...)` (:397-402); any failure rolls all three back. v1/legacy inserts skip the tx entirely (:407) — no envelopes.
- Post-commit: monotonic `lastMessageAt` bump (:435-443); fan-out to recipient plus, for v2 only, the sender's own other devices (:463-479); the REST/WS response already contains `envelopes` (:448-453).
- Reads: `attachEnvelopes` hydrates only `e2eVersion === 2` rows, one query for envelopes + one for attachments (chat.service.ts:1007-1044, used by history, delta poll, inbox last-message, replay). **All envelopes go to both participants**, not filtered to the caller's device (chat.types.ts:39-45) — the server never holds a private key, so this is safe today.
- v1 staleness: 409 `E2E_SESSION_STALE` when `recipientIdentityKey` no longer matches `user_e2e_identities` (:289-302).

## 3. Schema truth

`chat` schema (db/schema/chat.pg-schema.ts:16). E2E-only tables, with the migrations that created them:

- `user_e2e_identities` (user*id PK, identity_key, identity_signing_key, registration_id, signed_prekey*\*, timestamps) — chat.schema.ts:156-180; **0021_perfect_tarantula.sql:1**.
- `user_e2e_one_time_prekeys` (user_id, prekey_id, public_key, used_at) — :185-209; **0021:13**.
- `user_e2e_devices` (identity*key, identity_signing_key, registration_id, signed_prekey*\*, label, last_seen_at, revoked_at) — :226-263; **0027_brave_scarlet_spider.sql:18**; `label` added **0028_hot_charles_xavier.sql:36**.
- `user_e2e_device_prekeys` (device_id FK, prekey_id, public_key, used_at) — :273-297; **0027:9**.
- `message_envelopes` (message_id FK cascade, recipient_device_id FK cascade, header jsonb, wrapped_key; PK(message_id,recipient_device_id)) — :306-319; **0027:1**.
- `e2e_backups` (user_id PK, key_check, key_proof_hash, passcode_salt/params, wrapped_key, passcode_auth_hash, failed_attempts, locked_until) — :339-369; **0028:10**; `key_proof_hash` **0029_flaky_starjammers.sql:1**.
- `e2e_backup_segments` (id, user_id, device_id, ciphertext, message_count, created_at) — :373-397; **0028:1**.
- `e2e_history_requests` (new-device approval) was created in **0028:23** and is **dropped by 0049_bizarre_psynapse.sql:1** — no approval endpoints remain; the review must not assume that feature exists.
- `messages` E2E columns (chat.schema.ts:102-116): `is_e2e` bool default false not null, `e2e_header` jsonb (v1 only), `e2e_version` smallint (null/1/2), `sender_device_id` uuid FK→user_e2e_devices ON DELETE set null. Created: is_e2e+e2e_header **0021:23-24**; e2e_version+sender_device_id **0027:34-35,65**; hand-written backfills `e2e_version=1 where is_e2e` (**0027:71**) and v1 identities→devices (**0027:75-78**).
- `chat.attachments` — **0030_flimsy_shadow_king.sql:1**; message_id FK ON DELETE set null, status pending/uploaded/attached/expired (chat.schema.ts:413-450); reachable only through a v2 message.
- **DB does not enforce encryption**: the only content constraints are `messages_content_present` (body or image_path), `messages_body_length_max` (≤24000 chars) and `messages_image_pair` (chat.schema.ts:141-149). A plaintext `is_e2e=false` row is legal in SQL; "encrypted only" is app-level only. Historical plaintext rows therefore already exist in read results and clients branch on `isE2e`.
- Naming trap: `user_login_devices` (**0041_flimsy_sentinel.sql:156**) is auth session/device tracking, unrelated to `user_e2e_devices`; do not drop it with an E2E migration.
- The only removal in the ledger is 0049 dropping `e2e_history_requests`; no other E2E table/column has ever been dropped, and none of these tables live in `public`.

## 4. Blast radius

- Importers of `chat/e2e/**` inside src: `chat.module.ts:12-18` and providers :52-57; `chat.service.ts:34-39` (diffDevices/loadTargetDevices/lockE2eDeviceKeys); `dto/e2e-v2.dto.ts:15` (MAX_ACTIVE_DEVICES). **That is all** — no metrics, pubsub, notifications, outbox, admin or seed file imports it (chat-metrics.service.ts has zero E2E references; notifications.type is a plain varchar, notifications.schema.ts:30).
- Outside `chat/` but still coupled: `applications/dto/create-application.dto.ts:10-11` imports `E2eHeaderDto`/`E2eV2PayloadDto`, and `applications.service.ts:126-166` forwards `e2e`/`e2eHeader` into `chat.sendMessage` and rejects unencrypted application bodies ("Application messages must be encrypted"). This is a **second send path** the review did not mention.
- Cron/queue: the only chat job is `chat-maintenance` / `attachments-cleanup` every hour → `ChatAttachmentsService.cleanupOrphans` only (chat-maintenance.processor.ts:29-33,57-63). It **does not touch** backup, device, prekey or envelope tables. Deleting `chat/e2e` breaks no cron and no queue job.
- Tests that break in the unit run (jest rootDir=src, testRegex `.spec.ts`, package.json:103-104): the 4 suites under chat/e2e (18+16+13+6 `it`s), `chat.service.spec.ts:519-911` (~25 v2 `it`s asserting E2E_DEVICES_MISMATCH / DEVICE_INACTIVE / NO_RECIPIENT_DEVICES and transactional envelope writes), `chat.gateway.spec.ts:131,147`, `applications.service.spec.ts:341-409`. `test/app.e2e-spec.ts:1-29` only hits `GET /`, so it is unaffected.
- App-wide side effect: main.ts:20-26 raised the JSON body limit to 1 MB specifically for backup segments; removing backup makes it dead (not harmful, but it was added for this feature and is worth reverting deliberately).
- Account purge is cascade-based (users/account-purge.service.ts:40-43) so key material deletes with the user; correct today and unaffected.

## 5. What is still load-bearing (REST fallback vs WS)

- Both transports share one implementation, so there is **no REST-only or WS-only E2E code** — the only WS-specific part is mapping the thrown codes into `{type:'error'}` (chat.gateway.ts:288-316). Deleting E2E changes REST and WS identically; the "REST fallback" is `POST /chats/messages`, not a plaintext escape hatch.
- The load-bearing pieces are all in the shared path: the mandatory-E2E gate, `loadTargetDevices` + `lockE2eDeviceKeys` + `diffDevices` + the 409 retry protocol, `message_envelopes` writes and the `envelopes[]`/attachments read shape, the `user_e2e_devices`/identities tables, and `MAX_ACTIVE_DEVICES` in the DTO. Delete the gate and the backend stops being E2E at all; delete only the subfolder and the service cannot compile.
- The attachment feature (create/sign/complete + the hourly cleanup job) is v2-coupled — with no e2e payload, `attachmentIds` can never be accepted, so those endpoints and the queue become dead but still compiled and scheduled.
- The nudge endpoint only exists because devices may not exist; it dies with E2E.

**Claim checks against the review**: "app-level E2E encryption exists" — V (keys are client-held; the directory stores public material only, e2e-keys.service.ts:32-42). "Server-held per-conversation DEK wrapped by KMS" — R, nothing of the kind exists anywhere (no DEK/KMS/decrypt code). "Single MessageBody codec" — R today: body is opaque text, only a length check; no codec/version stamp beyond `e2e_version`. "Admin decrypt access log" — R: no admin message/decrypt surface; the only chat admin route is `GET /admin/chat-metrics` latency (admin.controller.ts:38-45). "Retention" — R for chat: only `OUTBOX_RETENTION_DAYS` exists (outbox/outbox-retention.service.ts:26-29); messages, envelopes, devices and backup segments have no retention job.

## Gaps the review missed

- E2E is **mandatory for every write** at app level (chat.service.ts:215-216), so "replace app-level E2E" is not a client-side flip: the server currently 400s any plaintext send and any attachment, and the `messages.body` constraint would accept the new shape only after the check is removed.
- The second send path (job applications, applications.service.ts:126-166 + DTO imports) must be migrated in the same commit or the module stops compiling and apply-by-message changes contract.
- Removal ordering is a compile-time chain: `MAX_ACTIVE_DEVICES` (dto) → `e2e-devices.util` → `chat.service` imports → `chat.module` providers → controllers; a single-commit delete leaves schema/DB columns behind unless a migration is authored too (none exists today).
- No chat-specific retention exists today, so "keep retention" is new work; also `e2e_backup_segments` and revoked `user_e2e_devices` rows accumulate forever.
- `attachments` + its hourly cleanup job outlive E2E unless deleted deliberately — they are v2-only, so the review's scope must say whether they go too.
- Migration 0028's `e2e_history_requests` was dropped in 0049; the review's "backup + device approval" mental model is partly obsolete.
- `user_login_devices` is an unrelated auth table with a confusingly similar name — a destructive migration keyed on `%devices%` would hit it.
- v1 (`user_e2e_identities`, `user_e2e_one_time_prekeys`, `E2E_SESSION_STALE`) is still live and still written by `POST /chats/e2e/keys`; a v2-only removal is not a full E2E removal.
- There is no server-side E2E HTTP test suite (`test/app.e2e-spec.ts` is a hello-world), so the deletion's integration behaviour is unverified by CI — only unit mocks cover the send path.
