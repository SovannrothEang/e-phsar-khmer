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
