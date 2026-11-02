# Review — Resume (CV) persistence

Reviewer: senior-review pass, 2026-10-15. Reviewed against `.pipeline/spec.md`
(R1 + R2), the working tree (nothing committed), `AGENTS.md` and `CLAUDE.md`.
Everything below was verified by reading the code, re-running gates, and one
live browser check of the branch the tester could not reach.

**VERDICT: SHIP.**

No blocking finding. The two unverified paths are both acceptable (one is now
verified live, see §2). The coder's two deviations are the right calls. The
follow-ups in §5 are small, none of them code-wrong today.

## 1. What I re-ran independently

| Check                                                              | Result                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter backend test`                                       | **43 suites / 573 tests passed** (matches the coder's and the lead's numbers)                                                                                                                                                           |
| `pnpm --filter backend test -- --testPathPatterns=resume`          | **2 suites / 40 passed**                                                                                                                                                                                                                |
| `drizzle-kit generate` (run in an isolated copy of `apps/backend`) | `No schema changes, nothing to migrate` — CI's drift gate is green; repo `drizzle/` untouched                                                                                                                                           |
| DB: `max(created_at)` in `drizzle.__drizzle_migrations`            | `1792051899211` = the `0035_resume` journal `when` → applied, watermark correct                                                                                                                                                         |
| DB: `\dt resume*`                                                  | nine `resume*` tables present; `resumes` = 0 rows                                                                                                                                                                                       |
| DB: FK delete actions                                              | geography → **restrict**, `resume*` → `resumes` **cascade**, `resume_attachments.user_id` → `users` **cascade**, `resume_attachments.resume_id` → `resumes` **set null** — exactly the spec's map, so `AccountPurgeService` still works |
| Supabase `resume-files` bucket                                     | `public: false`, `file_size_limit: 5242880`, four allowed MIME types (pdf, msword, docx, text/plain)                                                                                                                                    |
| Test-runner hygiene                                                | no processes left by me; `git status` shows the same 66 entries as at session start (43 changed + 23 untracked), no build artifact in the tree                                                                                          |

## 2. The two unverified paths

### 2a. The failed-`GET /resume` error card — EXERCISED LIVE, PASS

I exercised it without touching the shared backend or the repo: a stub API on
`:3999` (`GET /api/v1/auth/me` → 200, `GET /api/v1/resume` → 500, everything
else 404, which the `getJson` helpers tolerate), a second `next dev` on `:3011`
with `API_URL=http://127.0.0.1:3999/api/v1`, and headless Chromium via CDP with
a `user_access_token` cookie.

Result on `http://localhost:3011/en/me/resume`:

```
{"url":"http://localhost:3011/en/me/resume",
 "hasErrorCard":true, "hasStartCard":false, "hasWizardStep":false,
 "hasLogin":false, "h1":["Resume (CV)"]}
```

The page renders the breadcrumb + **"Couldn't load your resume. Refresh the page
to try again."**, and neither the start card nor a blank Step 1 is rendered —
the protection Decision 12 exists for. Acceptable to ship.

**Correction for the record:** the cheap method suggested in the brief — a
second `next dev` on a **dead `API_URL`** — cannot exercise this branch at all.
`getCurrentUser()` (`lib/auth/current-user.ts:51-75`) is fail-soft and returns
`null` when the backend is unreachable, so `Resume.tsx:45` redirects to
`/login` before the card can render. The card is only reachable when auth
succeeds and `/resume` specifically fails (a 500, a route-level outage, a
network blip between the two calls) — which is what I induced.

### 2b. A literal 100% — not walked, judged reachable

The percent is `Math.round(filled / 20 * 100)` (`ResumePreview.tsx:429-430`)
over 20 items, each a plain truthiness check on document data. Every item maps
to a live control: photo/gender/dob/nationality/email/location/address/phone/
marital/education/position/years (Step 1 dialog), summary, the five list
sections, and the CV attachment. The Location item fills on **province alone**
(`!!data?.place?.province`), so the 3-level picker does not have to be drilled
to commune. No predicate is unsatisfiable (checked one by one), so 20/20 = 100
is reachable; the tester verified the mechanics (chips dropping, the CV fill
moving 50 → 55, the chip un-filling on removal). Residual risk is confined to
"can all 20 editors hold values at once", which is UI state the tester
exercised piecewise. Not a blocker; the captain's own walk settles it.

## 3. Security — adversarial pass

**Route scoping.** All 17 routes are JWT (no `@Public()`), every one takes
`@CurrentUser()`, and every query inside is keyed on the caller's `user_id` →
`resume_id`. I looked for a foreign-id read, overwrite or delete and found none:

- `PUT` upserts carry `setWhere: eq(table.resumeId, resumeId)`. Postgres
  semantics check out: `INSERT … ON CONFLICT (id) DO UPDATE … WHERE
resume_id = <caller> RETURNING` updates **zero** rows when the id belongs to
  someone else → `NotFoundException` (404). A foreign id is never updated and
  its existence is only revealed as "not mine" — the same trade the spec
  accepted for the create-attachment path.
- `DELETE` matches the spec verbatim (`{ id, deleted: true }` for absent **and**
  foreign ids, `resume_id` as the guard). The no-oracle reasoning holds: own,
  foreign and absent ids are indistinguishable in the response, so the route
  carries no information about another user's rows. It is not a 404-expectation
  miss — the spec says the opposite and the implementation follows it.
- `savePersonal` / `updateDocument` / `upsertJobPreference` target the caller's
  own rows (PK / `where id = <caller's resume>`); there is no path to another
  user's personal block.

**The CV attachment stack.**

- `create`/`reissue`: a foreign id answers `RESUME_ATTACHMENT_ID_TAKEN` (409) —
  an oracle on a client-generated UUID only. The spec's unit-test target 9
  prescribes exactly this ("the same id from another user is a conflict"); UUID
  enumeration is infeasible, so it is acceptable.
- `complete`: `findOwned` → 404 for a foreign id, and the conditional
  `update … where id = $1 and user_id = $2 and status = 'pending'` cannot attach
  someone else's row. The attach + replace is one transaction; replaced objects
  are removed after commit.
- `sign`: the caller's `attached` row only, `[]` otherwise — **account B can
  never obtain a URL for A's CV**. Verified in code and by the tester live.
- `deleteAttachment`: `user_id` + `status='attached'` predicate; idempotent
  `{ deleted: true }`, never a cross-user delete.
- The bucket is private with 5-minute signed URLs; the object key is
  `{userId}/{id}/{safeName(fileName)}` with the name sanitised to
  `[a-zA-Z0-9.\-_]`, so a crafted `fileName` cannot escape the caller's prefix
  (and storage addresses objects by exact key, not by path resolution).

**Orphan sweep.** `cleanupOrphans` targets only `resume_id is null` rows older
than 24 h, removes objects first and keeps the rows if storage errors. A row is
`resume_id`-null only while `pending`; `attached` always writes `resume_id` in
the same statement, and the only way back to null is `ON DELETE SET NULL` after
the owning resume is gone — which is the state it _should_ sweep. The one
residual is a narrow race (cleanup's SELECT → delete window vs. a very late
`complete`), unreachable through the UI because the upload URL lives 2 h and the
sweep starts at 24 h; see follow-up 5.4.

**Environmental, as reported:** the CV is plaintext in the private bucket and the
photo lives in the public `listings`-style bucket (here: `product-images`) at an
unguessable URL. Both are the spec's own, plainly stated choices.

## 4. The coder's deviations — both are the right call

1. **`code?: string` on `createResumeAttachment`'s failure branch.** Spec §4's
   declared type omits it, but §4's prose ("the web helper reads that code as
   'already uploaded'") and the edge-case list ("the web helper treats that code
   as 'already uploaded' and calls `complete`") require the branch. The addition
   is a strict superset of the declared type on a brand-new API, so no contract
   is broken, and `ResumePreview.tsx:496` uses it. Keep it.
   One honesty note: the stated justification ("a retried handshake whose
   response was lost") is unreachable in the shipped UI — `handleCvPick` mints a
   **fresh** `crypto.randomUUID()` on every pick (`ResumePreview.tsx:488`), so
   `RESUME_ATTACHMENT_NOT_PENDING` can never come back to the card. The branch
   is correct defensive code; it is not exercised by the UI.
2. **`resumes.updated_at` not restamped by child writes.** The spec itself
   records this as a known gap, and drizzle's `$onUpdate` would otherwise force
   `updated_at` into every `do update` SET clause. The implementation pins it
   (`set: { userId, updatedAt: resumes.updatedAt }`, `resume.service.ts:627-631`)
   and a unit test compiles and asserts the clause; the tester's `stamp.js`
   confirmed the behaviour (child writes leave it alone, `PATCH /resume` moves
   it). Right call.

No other deviation from the spec was found: 17 routes, 8 DTO files, the module's
providers/exports, the fail-soft web mapping, the CV card's upload/replace/remove
and hidden Download, the chip becoming `!!doc.attachment`, the dropped dead
`n === 2 / n === 7` delete branches — all as specified.

## 5. Findings, ranked (none blocking)

1. **Impossible calendar dates are a 500, not a 400.** `DATE_ONLY_PATTERN`
   (`/^\d{4}-\d{2}-\d{2}$/`) accepts `2026-02-31` and `0000-01-01`; the value
   reaches the `date` column, Postgres rejects it, and `GlobalExceptionFilter`
   answers 500. Affects `PUT /resume/personal` (`dob`) and both dated upserts.
   Only a hand-crafted client can produce it (the calendar cannot), and the spec
   accepted shape-only date validation, so this is hardening — a calendar check
   or `@IsDateString` closes it. No test covers it.
2. **Fresh-environment documentation (land-time, not code).** The bucket is
   documented in `config.validation.ts`'s Zod comment, the spec (§5.7) and
   `changes.md`; it is **not** in `CLAUDE.md`'s env table, whose neighbouring
   `CHAT_FILES_BUCKET` row and dashboard note are how the chat bucket is
   discoverable. Without the manual bucket all four attachment routes 502.
   Same for the mock/real list: `CLAUDE.md` still lists `/me/resume` under
   "still mock". The peer's widening of `resume-files.allowed_mime_types` is
   adequately described (env change, not code) — that part is fine.
3. **`tasks/todo.md` has no dated entry for this ship.** `CLAUDE.md`'s convention
   ("append a dated entry per ship") is unmet in the working tree; the ship is
   uncommitted, so this may simply be pending, but it should land with it.
4. **Orphan-sweep hardening (very low).** `cleanupOrphans` selects and deletes on
   `resume_id is null` + age alone; adding `status = 'pending'` (or re-checking
   in the DELETE) would make it structurally unable to race a late `complete`.
   Unreachable via the UI today.
5. **Five failed CV uploads lock the picker (low, by design).** Each pick mints a
   new id, so a failed PUT after a successful `create` leaves a new `pending`
   row; at 5 the route 429s until the hourly sweep clears rows older than 24 h.
   The spec chose the cap deliberately (chat has the same), so this is a note,
   not a defect.
6. **Dialog photo uses `next/image` while the preview uses `DbImage` (nit).**
   Justified for the just-uploaded case, but in edit mode it also renders the
   stored `photoUrl`, and the DTO accepts any string ≤ 500 chars — a foreign host
   would throw at render in the dialog. Self-inflicted only (nothing renders
   another user's resume), so a nit; `DbImage` would remove the class.
7. **The "Phone" chip has no `FOCUS_LABELS` entry (nit).** `openEditField("phone")`
   opens the dialog but never scrolls/highlights the phone field
   (`ResumePersonalDetailsDialog.tsx:79-90` lacks `phone`). The chip is only
   reachable in a state the UI cannot produce (a resume row with no personal
   block), so it is dead-ish code, not user-visible.
8. **Cosmetic phone formatting — acceptable, no ticket needed.** After a save the
   preview shows the typed grouping (`012 345 678`); after a reload the compact
   form, because the parent stores the dialog's payload verbatim and compaction
   happens in the action. The DB is compact both times. A one-line fix (compact
   in `savePersonal`'s state update) suffices if the captain cares; it does not
   justify a ticket.

## 6. Test quality

Above average and not superficial: the suites compile the **real** Drizzle
statements and pin the clauses that carry the security properties
(`on conflict ("user_id") do update set`, the `resume_id` predicate on conflict
updates, `updated_at = resumes.updated_at`, the scoped DELETE params), plus
cross-user 404s, storage-trust on `complete`, the replace transaction, the
sign/delete scoping and the orphan sweep's "keep rows when storage errors". The
DB nuances that only real Postgres can prove (`setWhere` yielding zero rows) were
covered live by the tester's cross-user run — the pair together is convincing.
Gaps: the invalid-calendar-date path (5.1) and the "does anything write
`resumes.updated_at` on child writes" property are not in the unit suite (the
latter was proven live only). The Module-README convention deliberately does not
apply (spec Non-goals) — noted, not a finding.

## 7. Incident during review (disclosed)

While cleaning up my own helper processes I extracted a PID from an unscoped
`ss` pipeline and ran `kill -9` on PID 7313 — the wrong process. I cannot
identify it retroactively (`/proc/7313` gone; no systemd unit failure recorded).
Post-incident checks: postgres (5432), valkey (6379, `PING` → `PONG`),
systemd-resolved, cupsd and the session's electron processes are all healthy;
`systemctl --user list-units --state=failed` is empty. No repo, DB or pipeline
artifact was affected, and all my helper processes (stub API, `next dev`,
Chromium) were then killed by port-scoped PIDs.

## 8. Bottom line

The contract, ownership model and storage lifecycle match the spec; the
ownership predicates are the right ones; the tests pin the clauses that matter;
and the one UI branch nobody had exercised renders exactly the protective state
it was written for. **Ship it**, carrying §5.1–5.3 as land-time housekeeping and
5.4–5.8 as backlog notes.

---

# Review — Reliable SMS delivery + own phone-OTP service (uncommitted backend diff)

Reviewer: independent senior-review pass, 2026-11-02, on branch `feat/refine`.
Scope: the whole uncommitted state of `apps/backend` vs HEAD — 18 modified files
plus every untracked new file (`src/otp/`, `src/notifications/sms/`, the two
auth DTOs, `password-reset.spec.ts`, `token-cutoff.util(.spec)`,
`stable-stringify.util(.spec)`, both new schemas, migrations `0050`–`0052` +
snapshots + `_journal.json`) — all read in full, plus `ARCHITECTURE.md`,
`CHANGELOG.md`, `CLAUDE.md`, `Plans.md` and `src/otp/README.md` as written.
`AGENTS.md` Review rules and `CLAUDE.md` invariants were the rubric. I did not
run the suite (the orchestrator ran lint/build/test in parallel: **lint clean,
`nest build` clean, 93 suites / 1325 tests green** — taken as evidence, not as a
substitute for reading).

**VERDICT: REQUEST_CHANGES.**

One **major** finding drives the verdict (§3.1 — a deterministic account-
enumeration oracle on the new `POST /auth/password/reset`, against the plan's
explicit no-enumeration DoD; the fix is ~3 lines plus a test). Everything else
is minor/nit, all six previously-reported fixes are confirmed fixed (§2), the
schema↔migration↔snapshot chain is verified drift-free (§1), and the diff is
otherwise ship-quality.

## 1. What I verified independently

| Check                                                                                                         | Result                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Isolated `drizzle-kit generate` (temp copy of `apps/backend`, node_modules junctioned, never ran in the repo) | **`No schema changes, nothing to migrate`** → schema ↔ migrations ↔ snapshots consistent, no drift gate to trip                                                                                                                                                                                    |
| Migration snapshots 0050/0051/0052 vs the SQL                                                                 | match: 0050 creates `sms_deliveries` with `user_id`/`outbox_event_id` NOT NULL + `sms_delivery_status`; 0051 drops both NOT NULLs, adds `purpose`, creates `phone_otps` + `otp_purpose`; 0052 adds `users.tokens_valid_after`. All three additive; `_journal.json` idx/`when` monotonic after 0049 |
| Final snapshot (0052) table/enum inventory                                                                    | `phone_otps`, `sms_deliveries`, both enums present; `tokens_valid_after` present                                                                                                                                                                                                                   |
| Module graph                                                                                                  | `OtpModule → NotificationsModule → OutboxModule`; no cycle (`OutboxModule` imports nothing feature-level); `SmsOutboxHandler` self-registers in `onModuleInit`                                                                                                                                     |
| Orchestration gates (relayed)                                                                                 | lint clean, build clean, 93/1325 tests green; the `ECONNREFUSED` log line is the fail-closed spec exercising the real limiter                                                                                                                                                                      |
| Test-runner hygiene                                                                                           | repo untouched except this file; temp copy removed (junction with `rmdir`, target verified intact)                                                                                                                                                                                                 |

**Incident, disclosed (precedent §7):** the isolated-copy step used `robocopy`
and copied `apps/backend/.env` and `.env.prod` into the temp directory before I
noticed. I deleted both **without reading them** and removed the whole temp tree
afterwards. No secret entered this review, the repo, or the pipeline.

## 2. Status of the six previously-reported fixes — all verified against current code

| #   | Previous finding                                                  | Status                   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ----------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Enqueue + audit row not in one transaction                        | **Fixed**                | `notifications.service.ts:56-90` — `enqueue` and the `sms_deliveries` insert run inside one `db.transaction`; spec _"queues the event and the audit row in one transaction"_                                                                                                                                                                                                                                                                                                                                                                                        |
| 2   | Enqueue failure could break `notify()` / duplicate the in-app row | **Fixed**                | channels run first, then `enqueueSms` in try/catch that only logs (`notifications.service.ts:51-62`); spec _"does not reject notify() when queuing the SMS fails, so the caller never re-writes the in-app row"_                                                                                                                                                                                                                                                                                                                                                    |
| 3   | Redis client not closed on shutdown                               | **Fixed**                | `sms-rate-limiter.ts:57-64` `onModuleDestroy` → `quit()` with `disconnect()` fallback; factory attaches an `error` listener (`notifications.module.ts:74-79`) so a dead client can't crash the process; fail-fast options documented                                                                                                                                                                                                                                                                                                                                |
| 4   | `maskedPhone` missing on sent/failed rows                         | **Fixed**                | `sms-outbox-handler.ts:143` (sent) and `:157` (failed) both set `maskPhone(...)`; skip/bump paths too                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 5   | Two utils without specs                                           | **Fixed**                | `common/stable-stringify.util.spec.ts` (key order, nesting, array order) and `auth/token-cutoff.util.spec.ts` (second-precision boundary, missing `iat`) — substantive, not boilerplate                                                                                                                                                                                                                                                                                                                                                                             |
| 6   | Docs missing                                                      | **Fixed, with two gaps** | `ARCHITECTURE.md` gained both the auth (OTP/forgot/revocation) and notifications (full SMS flow) sections; `CHANGELOG.md` two entries; `CLAUDE.md` stale "phoneVerifiedAt is never written" gap corrected + new gap; `src/otp/README.md` added (honest, follows the module convention). **Gaps:** `.env.example` still lacks `OTP_PROVIDER`/`OTP_HMAC_SECRET` though plan 1.8's DoD names them (see minor 3.2.1), and there is still no `notifications/README.md` (plan SMS 1.6 asked for "the notifications README" — none exists; ARCHITECTURE covers it instead) |

## 3. Findings

### 3.1 **major — account-enumeration oracle on `POST /auth/password/reset`** (`apps/backend/src/auth/auth.service.ts:297-305`)

`resetPassword` returns the distinct body `{code: 'OTP_TOO_MANY_ATTEMPTS',
message: 'Invalid or expired OTP'}` when `OtpService.verify` answers
`too_many_attempts`, and the plain 401 (`{code: 'UNAUTHORIZED', message: 'Invalid
or expired OTP'}` through `GlobalExceptionFilter`) for every other failure. The
filter preserves `code` (`global-exception.filter.ts:71-81`), so the two are
observably different over HTTP.

`too_many_attempts` requires an open `password_reset` row in `phone_otps`, and
such a row is created **only** by `issueAndSendDetached`, which only runs when
`findResettableUser` found an eligible account — `reserveOnly` (the unknown-
number path) stores nothing. An unknown number therefore _can never_ produce the
distinct body.

**Probe (all within the configured throttles: forgot 5/min, reset 10/min, one
IP):** `POST /password/forgot {phone}` → six `POST /password/reset {phone,
code:'000000', …}`. Known number → 6th answer carries
`OTP_TOO_MANY_ATTEMPTS`; unknown number → six identical plain 401s. That is a
deterministic account-existence oracle on exactly the property plan 1.5 / assumption
A3 demand ("same response whether or not the number has an account"; DoD
"unknown number returns the same body … as a known one"). The spec only pins
one wrong code (`password-reset.spec.ts:536`), which is why the suite is green.

The same-shaped new oracle exists on `/auth/otp/verify`
(`auth.service.ts:403-408`) for passwordless/legacy accounts (for password
accounts an `INVALID_CREDENTIALS`-vs-`Invalid or expired OTP` divergence already
exists at HEAD — pre-existing, noted not charged to this diff). Both are behind
`OTP_PROVIDER=plasgate`, so **default-config behaviour is unaffected**; the flag
flip is precisely task 1.7, which requires an APPROVE verdict.

**Fix:** make the response independent of row state where the DoD demands it —
drop the `code:` from the `too_many_attempts` throw in `resetPassword` (the web's
`parseOtpFailure` then degrades gracefully to `invalid_code`, since `message`
stays `'Invalid or expired OTP'`), and decide the same for `verifyPhoneOtp`.
If the distinct body is wanted for UX, the only enumeration-safe way is to make
unknown numbers answer it too, which needs a row for every number — not
recommended. Add the missing test: identical response bodies for known vs
unknown across a full 5-attempt exhaustion.

### 3.2 Minor findings

1. **`.env.example` omits `OTP_PROVIDER`/`OTP_HMAC_SECRET`, and `CHANGELOG.md` misstates what it contains** (`.env.example:66-70`; `CHANGELOG.md` SMS entry). Plan 1.8's DoD explicitly lists both OTP vars for `.env.example`; the CHANGELOG claims `SMS_RATE_LIMIT_PER_MINUTE`, `SMS_USER_COOLDOWN_SECONDS`, `SMS_USER_DAILY_CAP` were added there — only `SMS_BASE_URL/PRIVATE_KEY/SECRET/SENDER` are. Fresh-environment setup for the OTP flag (the plan's own rollout lever) is undocumented where operators look. _Why it matters:_ the rollout task 1.7 flips `OTP_PROVIDER` in an environment; an operator reading `.env.example` finds no trace of it.
2. **New column `users.tokensValidAfter` leaks into user payloads outside `AuthService.toPublicUser`** — `users/users.service.ts:1272-1276` and `admin/admin.service.ts:49,79` still strip only `passwordHash`, so `GET /users/:id`, `/me` and admin user payloads now carry it, while `auth.service.ts:84`'s `PublicUser` type says it is excluded (the type compiles only because a spread isn't an excess-property check). Not a secret, but it exposes "when this user last reset their password" cross-user, and the type now lies about two of three serialization sites. Strip it in both `toPublicUser`s or narrow the shared type.
3. **`SmsOutboxHandler.bumpAttempt` doesn't bump `attempts`** (`sms-outbox-handler.ts:216-224`) — it only backfills `maskedPhone`. `sms_deliveries.attempts` is written solely on the PlasGate-retry path (`:173`), so limiter-retried-then-abandoned rows read `0`, first-try `sent` rows read `0`, and `ARCHITECTURE.md`'s "every attempt outcome updates … `attempts`" is inaccurate. Either write `event.attempts` on every retry exit or rename the helper and fix the doc — an audit field that silently means "last PlasGate retry only" will mislead whoever reads it during an incident.
4. **Limiter slot leaks when `otp.issue` throws** (`otp-sms-sender.ts:69-74`) — the slot (cooldown key + daily count) is acquired before `issue`, and only `deliver`/`abandon` ever releases it. A DB error inside `issue` leaves the phone locked out of codes for 5 minutes and one daily slot burned, with no code issued. Wrap `issue` in try/catch → `releaseSubject` → rethrow (or acquire after a successful issue — but then the "over-limit must not supersede the delivered code" property is lost, so release-on-error is the right shape).
5. **Unbounded audit inserts on blocked OTP requests** (`otp-sms-sender.ts:180-197`) — every cooldown/daily-cap/limiter-down answer inserts a `skipped` row. The per-IP throttle is in-memory and per instance (the otp README says so), so distributed probes grow `sms_deliveries` without bound for a pure rate-limit rejection that carries no new information. Sample, drop, or dedupe these rows (the limiter already knows the state; the row adds little beyond the first).
6. **`OtpSmsSender.send()` has no production caller** (`otp-sms-sender.ts:144-164`, spec at `:284`) — the "lower-level form for an already-issued code" exists only for its own test. AGENTS: no future-proof abstraction without a current use case. Delete it with its spec, or wire the caller it was written for.
7. **Stale docs contradicting the new design** (cross-file): `notifications/notification-channel.interface.ts:22-27` still tells the next engineer that "adding SMS later is adding another class implementing this interface" — the module doc comment now says the exact opposite ("deliberately NOT a NotificationChannel"); `payment/README.md:364` still says "Email/SMS/push are unbuilt"; `ARCHITECTURE.md`'s SMS gate order lists the verified-phone gate (2) before the allowed-type gate (2b) while the code checks allowed types first (`sms-outbox-handler.ts:71` vs `:88` — no behavioural difference, both terminal, but the doc is a sequence claim).

### 3.3 Nit findings

1. **Permanent `failed` keeps the per-user slot** (`sms-outbox-handler.ts:152-166`) while `OtpSmsSender.deliver` releases it on failure (`otp-sms-sender.ts:250-254`): a permanently failing provider (bad sender id) still counts against the user's cooldown and daily cap with zero delivered SMS. Pick one rule and apply it to both paths.
2. **`providerReply` is stored raw** (`plasgate-client.ts:71-82` → `sms-deliveries.provider_reply`, outbox `last_error`). The schema comment claims `maskedPhone` "is the only phone-shaped value here", but a provider error that echoes `to` (or, per Plans' open 1.7 check, key material) defeats that. The OTP path scrubs only the exact code substring (`otp-sms-sender.ts:288-291`); the outbox path does no content scrub at all. Resolve during the 1.7 provider-behaviour check.
3. **`stableStringify` maps `Date` to `{}`** (`common/stable-stringify.util.ts:12-18`) — two different dates hash identically, and `undefined` becomes the invalid-JSON token `undefined`. Latent (no producer passes Dates today), but it is the dedupe hash's input; add a `Date.toISOString()` branch or a test that pins the intended behaviour.
4. **Dedupe hashes _all_ of `data`** (`notifications.service.ts:96-110`) — a future SMS producer with constant `data` gets every resend after the first suppressed until outbox retention (7 d) purges the key; one with a volatile field never dedupes at all. The plan asked for "a stable id from `data`" — when plan SMS 1.9 wires the auth flows to this path, require a unique id in `data` and say so in the comment.
5. **Clock-skew misclassification** (`otp.repository.ts:80,97` use DB `now()`; `otp.service.ts:93` uses the app clock): with the DB ahead, an expired code is rejected by the SQL guard and reported `too_many_attempts` instead of `expired` — a wrong state _and_ a second instance of finding 3.1's distinct body.
6. **`toInternational` prepends `855` to any ≥8-digit non-`0` non-`855` number** (`plasgate-client.ts:93-98`) — a valid non-KH E.164 accepted by the DTO regex is misaddressed. Fine for a Cambodia-only platform; note it if the DTO regex is ever widened.
7. **Two-step NOT NULL dance** (`0050` creates `user_id`/`outbox_event_id` NOT NULL, `0051` drops it) — harmless regeneration artifact since both ship together, but a reader of 0050 alone gets a wrong picture.
8. **`CHANGELOG.md` test numbers stale** — "88 suites / 1228 tests" is the pre-OTP count; the tree now reports 93/1325.
9. **`sms_deliveries.user_id` is `onDelete: cascade`** (`sms-deliveries.schema.ts:42-44`) — a user purge silently deletes that user's notification-SMS audit rows (OTP rows survive because `user_id` is NULL). Decide whether the audit trail should outlive the subject, as `outboxEventId` deliberately does.
10. **Reset password rules are stricter than register's** (`reset-password.dto.ts:26-31` caps at 72; `verify-otp.dto.ts` doesn't) — plan 1.5 DoD says "password rules same as register". Stricter is defensible (bcrypt truncates at 72) but it is a divergence; align or note it.
11. **`Plans.md` task tables still mark shipped work `cc:TODO`** and the SMS run log says "Not done: 1.9 (cooldown / daily cap)" although `SmsUserLimiter` + `SMS_ALLOWED_TYPES` + all of 1.9's DoD tests are in this diff. Documentation hygiene only; the run log predates the later commits to the same tree.

## 4. Areas examined and found correct (recorded so the next reviewer needn't re-derive)

- **OTP atomicity.** Attempt spent _before_ the compare (`reserveAttempt`'s conditional `UPDATE … WHERE consumed_at IS NULL AND expires_at > now() AND attempts < 5`), single use via conditional `consume`, exactly-one-winner under concurrency (pinned by the fake-repo concurrency specs, which mirror the SQL statement-for-statement). `replaceOpen`'s transaction can technically leave two open rows under a READ COMMITTED race, but `findLatestOpen` returns the newest and the hash is purpose+row-bound, so the older code can never verify — benign.
- **Limiter Lua scripts.** `ACQUIRE_SCRIPT`/`RELEASE_SCRIPT`/sliding-window are each a single atomic script (no interleaving), same-event retries are idempotent via the event-id holder, a daily-cap refusal DECRs before returning so it burns no cooldown, and both limiters fail **closed** (`unavailable` → handler `retry`; Redis down → no code issued, no HTTP call — spec'd both in the handler and the sender).
- **Forgot-password symmetry.** Same two lookups for every number (spec-counted), same limiter slot, identical 429 body for known/unknown (spec-compared), send detached so PlasGate latency can't distinguish, `reserveOnly` stores and sends nothing, banned/suspended/passwordless/deleted all take the phantom path with identical answers. The residual timing delta (one DB insert) is documented in code, ARCHITECTURE and the otp README with a measure-it-in-1.7 note — acceptable.
- **Session revocation.** Password reset sets `tokensValidAfter` and revokes every device row (sid rotation included); `JwtStrategy` checks the cutoff on **both** the sid and sid-less paths, `refresh` checks it before touching the device row, and the same-second window is a documented, tested trade-off (`token-cutoff.util.ts`). `DEV_OTP_TOKEN` is refused in production with an error log and stores nothing.
- **Outbox classification.** 2xx→published, network/timeout/429/5xx→retry, other 4xx→failed, `onAbandoned`→row failed, `redact` applied on **every** terminal path by the dispatcher (published _and_ failed _and_ abandoned), `maxAttempts` raised to 20 with the claim-time-attempt rationale documented, content never logged (specs assert key/secret/code/phone absence).
- **Provider switch.** Under the default `supabase`, register/resend/login-OTP/verify are byte-for-byte the old Supabase path (spec asserts `OtpService`/`OtpSmsSender` are never touched), forgot/reset answer 503 `OTP_PROVIDER_UNSUPPORTED`, and `phoneVerifiedAt` is stamped on all three verify branches without widening `mirrorSupabaseUser`'s conflict lock — while `addPhone`/`setPrimaryPhone`/`removePhone` now clear it (each with a spec), keeping the column's meaning coherent for the verified-phone gate.

## 5. Test quality

Above the repo's usual bar: the OTP suites pin the security properties
(single-use, attempt-before-compare, `timingSafeEqual` call shapes, HMAC-not-
plaintext, dev-bypass refused in production), the sender/limiter suites mirror
the real Lua/SQL atomics in fakes and say so in comments, `password-reset.spec`
runs a real `OtpService` + real bcrypt + real JWTs end-to-end through
`AuthService` and `JwtStrategy`, and the forgot-password suite asserts response
equality (bodies, 429 shapes, query counts) rather than just happy paths.

Gaps this review would have caught with one more test each: **(a)** known vs
unknown response bodies across a full attempt exhaustion on `/password/reset`
(finding 3.1); **(b)** `sms_deliveries.attempts` bookkeeping on limiter retries
(3.2.3); **(c)** slot release when `otp.issue` throws (3.2.4); **(d)**
`stableStringify` with a `Date` (3.3.3). The burst spec drives the limiter with
its own retry loop rather than the real dispatcher — fine as a limiter test, but
it should not be read as end-to-end proof of "300 queued SMS all delivered".

## 6. Bottom line

Fix 3.1 (plus its test) before the `OTP_PROVIDER=plasgate` flag is flipped
anywhere; fold 3.2.1–3.2.2 into the same pass since they are two-line changes;
the rest can ride as follow-up tickets. The six prior fixes are all genuinely
fixed, the migrations are additive and drift-free, the concurrency and
fail-closed properties hold up under adversarial reading, and the docs — bar the
staleness list in 3.2.7/3.3.8 — describe the system as it actually behaves.
