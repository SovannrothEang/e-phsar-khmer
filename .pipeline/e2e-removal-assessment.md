# E2E removal — assessment of the external review (2026-11-02)

Read-only verification of the "drop app-level E2E, hold keys server-side" review against this tree.
Evidence: three audits in `.pipeline/analysis-e2e-{backend,data-plane,web}.md`; every claim there is cited path:line.

## Verdict

Direction is right; **the plan as written would fail in this repo**. The review describes a client-side
feature flip. This codebase enforces E2E **server-side and mandatorily**, on **two** send paths, with the
history/attachments/backup subsystems built on top. The replacement codec is genuinely small; the
_change_ is not. Ship it as an ordered, backend-first contract migration — not a deletion.

## What the review gets right

| Claim                                                                                                                         | Verdict                                             | Evidence                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Client-held, per-device keys cause the friction list (registration, bundle, 409 retry, passcode, backup, held sends, restore) | correct                                             | 11 REST routes over 4 controllers; 8 E2E tables; `E2E_DEVICES_MISMATCH` retry protocol |
| 6 E2E migrations                                                                                                              | exact: 0021, 0022, 0027, 0028, 0029, 0049           | 0049 already dropped `e2e_history_requests`                                            |
| No admin bulk/export read surface                                                                                             | correct — there is **no** admin message read at all | only `GET /admin/chat-metrics` (latency)                                               |
| No ILIKE/search over message bodies                                                                                           | correct                                             | ILIKE only on listings/users/feedback                                                  |
| Retention is the cheap privacy win                                                                                            | correct, but it does not exist yet (new work)       | no chat retention job; only outbox retention                                           |
| Keep blocks, rate limits, WS ticket auth, attachment authorization                                                            | correct — independent of E2E                        | guards/auth untouched by this change                                                   |

## What it gets wrong

1. **"You're on AWS ap-southeast-1 already" / KMS cost is ~0 — refuted.**
   No AWS/KMS/crypto dependency exists in the backend; `apps/backend/.env.prod` carries Supabase, Redis
   and payment-gateway credentials only. KMS would be a new vendor, new prod credentials, a new
   failure domain (KMS outage ⇒ chat writes fail) and a new permission model. Verify the actual host
   before budgeting.
2. **"Every symptom disappears at once" — refuted.** E2E is a server gate: a send without
   `e2eHeader`/`e2e` is 400 "Encrypted messages are required" (`chat.service.ts:215`), `imagePath` is
   400, attachments require a v2 payload (`:234`). Deleting client crypto first breaks both sides.
3. **"2% of the code"** conflates the replacement codec with the migration. Deleting/replacing is
   ~5.2k web lines (44 files), 17 web files rewritten, 8 tables, 4 controllers, 2 send paths,
   ~90 backend + 63 web test cases. Budget sprints, not a percentage.
4. **The preview/last-message denormalisation it warns about does not exist.** `conversations` has
   only `lastMessageAt`; previews are computed per read and decrypted client-side
   (`use-e2e-inbox-previews`). Adding a server-side preview column afterwards is a simplification,
   not a migration burden.
5. **"DB ILIKE is a leak risk"** — hypothetical: no message search exists today.
6. **"Attachments → ordinary storage + signed URLs"** is both overstated and understated: the storage
   path is already ordinary private-bucket signed-URL storage of ciphertext (server-mediated
   upload/complete/cleanup), so that part shrinks; but existing encrypted objects become permanently
   unreadable, and attachment keys live _inside_ the message body — server-readable body ⇒
   server-readable media. That coupling is missing from the review.
7. **Copy sweep is 2 locale files, not 6** — `apps/web/messages/{en,km}.json` only
   (`i18n/routing.ts:5`). Also: no string says "end-to-end"; the retiring claims are "encrypted chat",
   "secure chat", and the passcode promises ("never leaves your device", "we cannot recover it").

## What it missed (decision-relevant)

1. **Irreversible history loss.** E2E ciphertext (bodies, backup segments, encrypted attachments) has no
   server-side key. Removing client crypto makes all of it permanently unreadable. E2E has been
   mandatory only since 2026-10-24, so the window may be tiny — but **count the rows before deciding**.
   A client-side "export my history" shipped _before_ removal is the only way out.
2. **Legacy plaintext already exists.** 0021 added `is_e2e default false`; 0027 re-tagged only
   `is_e2e=true` rows. Pre-0021 bodies are plaintext today and the web renders them raw
   (`lib/chat/format.ts:115`). "Encrypted at rest" is false for them unless backfilled.
3. **A second encrypted send path: job applications.** `ApplyJobDialog` → `applications.service.ts:126`
   → the same `ChatService.sendMessage` funnel, with its own "must be encrypted" 400. It must migrate
   in the same release.
4. **Admin decrypt audit log has nothing to log.** There is no admin read endpoint or role gate yet;
   that surface must be built (and deliberately kept minimal) before the log means anything.
5. **Body copies outside the DB-layer codec**: WS fan-out over Redis pub/sub, the WS ack frame, the
   sender's REST response, and `idempotency_keys.response_body` (24 h, latent — web sends no
   Idempotency-Key). "One codec" at the repository seam misses all four.
6. **No regression net.** 63 of 73 web tests exist only for E2E; backend CI runs hand-mocked unit specs
   with no Postgres, so the proposed "plaintext-marker row scan" cannot run as written.
7. **No chat retention exists** (only per-participant hide + account-purge cascade), and
   `e2e_backup_segments` has no cleanup at all.
8. **`main.ts:20` raised the JSON limit to 1 MB for backup segments**, and the 24k body cap is sized for
   base64 ciphertext — both budgets need re-deciding with a codec envelope.

## Corrected plan (ordered; backend first, destructive schema last)

1. **Decide history + retention N first.** Count E2E rows / backup segments / encrypted attachments in
   prod; if the app has real users, ship a client-side history export before touching crypto.
2. **Additive migration only**: `conversations.dek_wrapped`, `dek_version`; a `ChatKeyProvider`
   (start with env-held KEK + per-conversation DEK wrapped via AES-KW, `node:crypto`, zero new deps;
   keep the interface so KMS is a later swap) and a single `MessageBodyCodec`.
3. **Backend write path**: accept plaintext, encrypt inside the one insert funnel
   (`chat.service.ts:336` → `:379/:407`), remove the mandatory-E2E gate and envelope writes but keep
   the columns (dual-read: old rows served as "sent with the old encryption").
4. **Backend read path**: decrypt after authorization at the four sites — history, inbox last-message,
   replay, fan-out — plus the idempotency capture and WS payloads. Keep blocks/rate limits/WS auth.
5. **Attachments**: plaintext in the same private bucket, keep signed URLs + participant check; add
   content type. Must be one release with body plaintext (keys ride in the body).
6. **Job applications**: migrate to the plaintext funnel.
7. **Web**: passthrough send/read, delete `lib/e2e` + hooks/provider/notice, rewrite the 17 consumers,
   retire the passcode/backup copy (en+km), rebuild the image (flags are build-time Docker args).
8. **Follow-up migration**: drop the 8 tables + 4 `messages` columns after one release proves nothing
   reads them. Never mix crypto removal with the destructive change in one migration.
9. **Docs/copy**: keep `docs/e2e-encryption.md` + `e2e-attachments.md` as superseded ADRs (code cites
   them); rewrite the four ARCHITECTURE.md E2E lines; explicitly supersede `Plans.md:377`; user-facing
   claim becomes "encrypted in transit and at rest; accessible to our team for safety and support".

## Risks

- `E2E_DEVICES_MISMATCH` retry, envelope fan-out and backup disappear as _symptoms_, but the migration
  window is the dangerous part: two send contracts, one DB, no feature flag stated.
- At-rest keys stop a DB dump/replica/backup theft, **not** a compromised app server or an insider with
  app access. Without the admin read endpoint + audit log, do not market it as "no one can read".
- Plaintext regression via a bypassed path (WS payload, idempotency cache, logs) is silent — this is
  the one mistake that is unrecoverable reputationally.
- Dropping the client engine deletes the only code that can decrypt existing E2E history.

## Verify next

1. `select count(*), min(created_at) from chat.messages where is_e2e`; same for `e2e_backup_segments`
   and encrypted attachments; pre-0021 plaintext count.
2. Is prod live with real users? (`.env.prod` has live payment credentials.) If yes → history export
   before removal.
3. Where the backend actually runs (KMS vs env KEK vs Supabase pgsodium) — the AWS premise is unverified.
4. Attachments in scope for v1 or deferred (recommend one release with body, for the key-coupling).
5. Retention N days, and whether to backfill legacy plaintext rows through the codec.
6. Effort: backend ~2 send paths + 8 tables; web ~60 files / 63 tests. Plan as a spec (`.pipeline/spec.md`)
   before any deletion.
