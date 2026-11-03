# Web E2E surface, copy, docs, tests — verification (task-3)

Read-only audit of `apps/web`, `docs/`, `apps/mobile`. Tags: **V** verified, **R** refuted, **P** partial. Paths repo-relative.

## 1. Inventory

- `apps/web/lib/e2e/` = **44 files / ~5.2k lines** (incl. 6 test files / 43 cases).
- **(a) pure E2E, delete — 41.** `crypto/{base64,primitives,x3dh,double-ratchet,engine}.ts`; `config/types/content/lock/store/keys/engine-provider.ts`; `send-encrypt.ts`, `decrypt-message.ts`; `backup{,‑crypto,‑segments}.ts` (+test); `device-label.ts`; `bootstrap-{health(+test),after-auth}.ts`; `heartbeat-schedule.ts` (+test); `push-events.ts` (+test); `catch-up{,-store}.ts` (+test); `held-sends{,-runtime,-store}.ts` (+test); `attachments/{content,format,store,uploader,send,download,image.worker}.ts`; `stub-engine.ts` (**already dead**: zero importers repo-wide).
- **(b) crypto-free, rewrite/relocate — 3.** `chat-content.ts` (structured location/listing body still needed: `message-thread.tsx:132-136`, `conversation-list.tsx:25`); `attachments/image.ts` + `attachments/prepare.ts` (resize / EXIF strip / worker, no crypto).
- **(c) shared, keep — 0.** Nothing in `lib/e2e` is shared with non-chat code.
- **20 entry points import `@/lib/e2e`**: `components/{auth/LoginForm,OtpVerifyForm,post/ApplyJobDialog,web/SessionCacheGuard,chat/{e2e-backup-provider,e2e-bootstrap-notice,conversation-list,message-thread,message-bubble,encrypted-attachments,location-card,location-picker-dialog}}`, `hooks/{use-chat-thread,use-decrypted-messages,use-e2e-engine,use-e2e-backup,use-e2e-catch-up,use-e2e-inbox-previews,use-history-restored}`, `lib/chat/format.ts`, `types/chat.ts`.
- **Delete outside `lib/e2e` — 13**: `components/chat/e2e-backup-provider.tsx`, `e2e-backup-panel.tsx`, `e2e-bootstrap-notice.tsx`; `hooks/use-e2e-{engine,backup,catch-up,inbox-previews}.ts`, `use-decrypted-messages.ts`, `use-history-restored.ts`; `actions/{e2e,e2e-backup,e2e-nudge,chat-attachments}.ts`.
- **Rewrite outside `lib/e2e` — 17**: `use-chat-thread.ts`, `message-thread.tsx`, `conversation-list.tsx`, `chat-workspace.tsx`, `message-bubble.tsx`, `encrypted-attachments.tsx`, `location-{card,picker-dialog}.tsx`, `ApplyJobDialog.tsx`, `LoginForm.tsx`, `OtpVerifyForm.tsx`, `SessionCacheGuard.tsx`, both layouts (`app/[locale]/(chat)/layout.tsx:2,13`, `(user)/layout.tsx:5,20`), `types/chat.ts`, `lib/chat/format.ts`, `actions/applications.ts`.
- **Scope**: `E2eBackupProvider` wraps every signed-in page (`(user)/layout.tsx:20`) so engine bootstrap + 60 s backup sync + catch-up run app-wide, not only on `/chats` (`e2e-backup-provider.tsx:60-63`).

## 2. Copy that asserts encryption

- **R — the 6-locale premise.** `apps/web/messages/` holds **only `en.json` + `km.json`**; `i18n/routing.ts:5` = `locales: ["en","km"]`. zh/id/ko/vi were deleted in commit `8ad153a` (stale comments still say "six locales", e.g. `conversation-list.tsx:33`).
- **R — no string says "end-to-end" or "only you and the recipient can read"** in any locale. Strongest assertions, identical keys/lines in both files:
- "encrypted": `en.json:194` (Chat.errors.e2eNoKeys), `:195` (e2eUnavailable), `:231` (Chat.e2eSetup.storage), `:232` (e2eSetup.generic) — `km.json:194,195,231,232`.
- "secure chat": `en.json:119` (message.heldWaiting), `:120` (heldExpired), `:230` (e2eSetup.title), `:508` (Post.apply.secureChatUnavailable), `:509` (sentWithoutChat) — `km.json` same lines.
- decrypt vocabulary: `en.json:117,118` (Chat.message.decrypting / decryptFailed), `:124,125` (unavailableLockedWithPasscode/NoPasscode) — `km.json:117,118,124,125`.
- false-after-removal: `en.json:211` "It never leaves your device.", `:219` "We cannot recover it for you." — `km.json:211,219`.
- Whole backup block (`Chat.backup.*`, 23 keys, `en.json:198-222`) and device/decrypt placeholders in `Chat.message.*` exist only for E2E.

## 3. Flows that break if `lib/e2e` is deleted before the backend changes

- **Ordering (web must be last).** Backend must accept a plaintext body first — `chat.service.ts:215-218` 400s "Encrypted messages are required"; then web send/read rewrites; then remove `/chats/e2e/*` only after `actions/e2e*.ts` callers are gone; attachments need their own backend path before `actions/chat-attachments.ts` goes.
- **Sending — breaks.** Only send path is `sendE2eText(...)` → `sendChatMessage` (`use-chat-thread.ts:34,697-705`); with E2E bypassed locally the backend still 400s plaintext (`chat.service.ts:215-218`). No client-side escape hatch.
- **Reading history — breaks, irreversibly for old rows.** `message-thread.tsx:355-388` only renders plaintext for `tempId`/`!isE2e`; E2E rows resolve solely through `useDecryptedMessages`. Without it the base64 `body` would render raw, or blank per `lib/chat/format.ts:110-114`. The server holds no plaintext to hand back.
- **Attachments — breaks both directions.** Send fails closed (`use-chat-thread.ts:612-617` + `config.ts:16-17`); read breaks at `encrypted-attachments.tsx:8,19,41` → `loadAttachment`. Backend also rejects `attachmentIds` without an e2e payload (`chat.service.ts:234-237`), so no plaintext media path exists to fall back to.
- **Lock/passcode — breaks; note `lock.ts` is not the passcode.** `lib/e2e/lock.ts:11-23` is a Web-Locks tab-serialization primitive (no user surface). The user-facing "lock" is the history-backup passcode: dialogs `e2e-backup-provider.tsx:80-97`, in-thread re-prompt `message-thread.tsx:332-353`, banner `e2e-backup-panel.tsx:29-50` — all delete.
- **Backup — breaks fully.** `hooks/use-e2e-backup.ts` (sync/push/restore), `actions/e2e-backup.ts` (7 endpoints), `lib/e2e/backup.ts` (362 lines); passcode is the only restore route since device approval was removed (`CHANGELOG.md:256-262`).
- **Device list UI — does NOT break (R).** `/settings/devices` is auth sessions: `app/[locale]/(user)/settings/devices/page.tsx` → `actions/devices.ts:54,67` (`/auth/devices`). There is **no E2E device-management UI**; `chat.e2e_history_requests` was dropped by `0049_bizarre_psynapse.sql:1`.
- **WS send path — does not exist on web (R).** `ChatSocket.send()` (`use-chat-ws.ts:161-173`) has **zero callers**; `use-chat-thread.ts:230-234,275` uses the socket for delivery/`isConnected` only, and `send-encrypt.ts:58-62` states sends are always HTTP. Nothing to break.
- **"REST fallback" — reversed (R).** REST is the only send path, not a fallback; the fallback described at `use-chat-ws.ts:30-32` is not implemented. `sendChatMessage` (`actions/chat.ts:230-242`) survives a delete but needs a plaintext contract.
- **Job apply breaks too (outside chat).** `ApplyJobDialog.tsx:19-21,125,143` encrypts the application's chat copy; backend rejects unencrypted application bodies (`applications.service.ts:135-136`, "Application messages must be encrypted").

## 4. Docs

- `docs/e2e-encryption.md` (374 lines) and `docs/e2e-attachments.md` (265) are shipped-design references cited from code (`chat-attachments.service.ts:53`, `chat.schema.ts:411`, `lib/e2e/attachments/format.ts:5`, `lib/e2e/config.ts:9`) → **keep as ADR with a "Superseded <date>" header**, delete only together with those refs.
- **Rewrite, do not archive:** `ARCHITECTURE.md:228` (send contract), `:236` (rejection list incl. "missing E2E envelope"), `:242` (full E2E paragraph), `:248` (legacy chat upload scope).
- **CHANGELOG.md — 41 E2E mentions**, all dated shipped entries (e.g. `:197-262`); keep as history, add one Unreleased entry. `Plans.md:377` ("Keep E2E, stop the wall") is the roadmap this decision contradicts — it must be explicitly superseded or it will be re-implemented.
- **No E2E claim in either README** (R): root `README.md` 0 matches, `apps/web/README.md` 0 matches — both untouched create-turbo boilerplate.
- Audits need closing, not editing: `docs/AUDIT.md:38,120-121` (E2E backup write-abuse HIGH), `docs/01-backend-security.md:142`, and `docs/04-web-quality.md:409` which explicitly exempts `lib/e2e/**` from review.
- Artifacts/build: `docs/e2e-diagram.png`, `docs/e2e-diagrams.excalidraw`, `docs/phar-chat-module.png`, `tasks/plan-e2e-multi-device.md`; flags are build-time in `apps/web/Dockerfile:28-29` (`NEXT_PUBLIC_E2E_V2`, `NEXT_PUBLIC_E2E_ATTACHMENTS`) → removing them needs an image rebuild, not just a code delete.

## 5. Tests

- 11 `apps/web/lib/**/*.test.ts`, 73 cases; `pnpm --filter web test` = `node --test` (no DOM).
- **Exist only because of E2E — 6 files / 43 cases**: `lib/e2e/{backup-segments(5),bootstrap-health(3),catch-up(11),heartbeat-schedule(8),held-sends(12),push-events(4)}.test.ts`.
- **E2E-derived — 1 file / 6 cases**: `lib/chat/group-unavailable.test.ts`; the function's only producer is the "unavailable" decrypt outcome (`group-unavailable.ts:1-10`, `message-thread.tsx:375-379`).
- **Non-E2E — 4 files / 24 cases, none import `lib/e2e`, none fail**: `polling/attention(4)`, `polling/visible-poller(14)`, `notifications/preview-limit(2)`, `api/job-apply-candidate(4)`. Caveat: `visible-poller`'s only consumers are deleted E2E hooks (`use-e2e-engine.ts:15`, `use-e2e-backup.ts:16`, `use-e2e-catch-up.ts:13`, `held-sends-runtime.ts:22`).
- Net: **63 of 73 cases (86%) lose their reason to exist**; the remaining suite has no send/render coverage at all.

## 6. Mobile

- **R — no E2E chat code or copy.** 0 matches for `e2e|encrypt|decrypt|end-to-end` under `apps/mobile`; the only chat screen, `apps/mobile/app/(tabs)/chat.tsx` (730 lines), is a mock over `INITIAL_CONVERSATIONS`/`SAMPLE_PRODUCTS` with no API calls.

## Gaps the review missed

- **Web-first is impossible.** Every send is blocked by a server gate (`chat.service.ts:215-218`); "delete client E2E" is a backend-contract change first, so the web work is a dependent rewrite, not a deletion.
- **Attachments are a second project.** Encrypted attachment API + private bucket + hourly cleanup job, with no plaintext fallback: removing E2E deletes the only media path, existing images/voice notes become permanently unreadable (`encrypted-attachments.tsx`), and the legacy public-bucket `imageUrl` rows are not a substitute.
- **~700 web lines of history backup exist only to patch a defect E2E caused** ("sent before this device joined"); the passcode copy ("never leaves your device", "we cannot recover it") becomes a false security claim the moment E2E goes — it must be retired with the feature.
- **Job applications ride the encrypted chat path** (`ApplyJobDialog.tsx:143` → `applications.service.ts:126-166`), so the blast radius includes the apply flow, not just chat.
- **The provider runs on every signed-in page** (`(user)/layout.tsx:20`), contributing backup/catch-up requests to the measured web traffic — removing it changes traffic/DB numbers as well as code.
- **The web's only meaningful tests are this feature's** (43/73); after deletion nothing tests message send/read, so the rewrite ships without a regression net.
- **Orphans the review does not budget for**: `lib/e2e/stub-engine.ts` (already dead), `lib/polling/visible-poller.ts` + 14 tests (E2E-only consumers), and the "not audited" exemption at `docs/04-web-quality.md:409` — ~5.2k lines are the least-reviewed code in the app.
- **The locale sweep is 2 files, not 6** (en + km, identical keys/lines), so the copy cleanup is cheap — but both files must change in the same commit as the feature or users get "Decrypting…" on plaintext messages.
