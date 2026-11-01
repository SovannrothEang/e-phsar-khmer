# Changes — Resume (CV) persistence

Spec: `.pipeline/spec.md` (revisions R1 + R2). Nothing was committed; everything
is in the working tree.

## How this session started

An interrupted earlier run had left a **partially-wired** tree: the backend
module, schema, migration and `actions/resume.ts` were in place, but the web
side was inconsistent and would not build (`ResumePreview.tsx` imported
`cvMime`/`isValidCvFile`, which `resume-validation.ts` did not export), eight of
the nine dialogs still had the old synchronous `onSubmit: (x) => void` contract
against a parent that already awaited `Promise<boolean>`, the personal dialog
still used `onDataChange` (a prop the parent no longer passes) and a FileReader
data URL for the photo, the R2 CV **remove control** did not exist, and two
attachment unit tests referenced an undefined helper. Everything below was
either completed or fixed in this session, then verified end to end.

## Backend — `apps/backend/src/resume/` (from the interrupted run; reviewed and completed here)

| File                                            | What it does                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/db/schema/resume.schema.ts`                | The nine tables with the spec's CHECKs (years 0–60, `jsonb_array_length(phones) <= 3` on both phone lists, `end_date >= start_date`, `not is_current or end_date is null`), `UNIQUE(user_id)`, RESTRICT geography FKs, CASCADE into `users`.                                                               |
| `src/db/schema/index.ts`                        | Re-exports the schema file.                                                                                                                                                                                                                                                                                |
| `src/resume/resume.service.ts`                  | `getDocument`, `savePersonal`, `updateDocument`, the five `upsertX`/`deleteX` pairs, `getOrCreateResumeId`. Cross-field rules live here; ownership is `setWhere: eq(table.resumeId, resumeId)` on every conflict update (zero rows → 404, never 403).                                                      |
| `src/resume/resume-attachments.service.ts`      | The CV lifecycle: `create` (cap + pending cap + idempotent re-issue), `complete` (size read back from storage, attach + replace in one transaction, old objects removed after commit), `sign` (owner only, 5-minute URL, `[]` when none), `deleteAttachment` (idempotent, owner-scoped), `cleanupOrphans`. |
| `src/resume/resume-attachments.constants.ts`    | 5 MB cap, 24 h orphan age, 300 s download / 7200 s upload TTLs, pending cap 5, allowed extensions, extension → MIME table.                                                                                                                                                                                 |
| `src/resume/resume.controller.ts`               | All **17** routes (JWT, `@CurrentUser()`, `ParseUUIDPipe` on `:id`, `@Throttle` on attachment create) — including `DELETE /resume/attachments` (R2).                                                                                                                                                       |
| `src/resume/resume-maintenance.processor.ts`    | BullMQ `resume-maintenance` queue + hourly `attachments-cleanup` scheduler.                                                                                                                                                                                                                                |
| `src/resume/resume.module.ts`                   | Imports `FilesModule` (for `FilesService`), registers the queue, exports `ResumeService`.                                                                                                                                                                                                                  |
| `src/resume/dto/*.ts` (8 files)                 | Shape/length validation per the spec's DTO list.                                                                                                                                                                                                                                                           |
| `src/resume/resume.service.spec.ts`             | 18 tests covering the spec's targets 1–8.                                                                                                                                                                                                                                                                  |
| `src/resume/resume-attachments.service.spec.ts` | 22 tests covering targets 9–14 (was 20 with 2 red — see below).                                                                                                                                                                                                                                            |

**Fixed here:** `resume-attachments.service.spec.ts` called a
`deleteReturningStub` helper that never existed (the two `deleteAttachment`
tests threw `ReferenceError`). The helper is the existing
`txDeleteStub` — renamed to `deleteReturningStub` because it is now also used
directly by the non-transactional delete. The rename is the whole fix; the
service code was correct, and both tests pass and pin the compiled DELETE
(`user_id = $1`, `status = $2`) plus the idempotent no-row case.

**Two deviations carried from the interrupted run, both deliberate:**

1. `getOrCreateResumeId` passes `updatedAt: resumes.updatedAt` in the conflict
   `set`. Drizzle's `$onUpdate` forces itself into **every** `do update` SET
   clause, so the spec's literal `set: { userId }` would restamp
   `resumes.updated_at` on every child write — contradicting the ship's own
   Known-gap entry ("nothing writes `resumes.updated_at` on child-row
   changes"). A test pins the compiled `"updated_at" = "resumes"."updated_at"`.
2. `getDocument` collects geography ids across personal + experiences +
   educations **before** the reads, so a document costs three geography lookups
   total (one per level). A test asserts exactly 3 lookups with a shared
   province id deduplicated to one param.

Modified: `src/config/config.validation.ts` + `configuration.ts`
(`RESUME_FILES_BUCKET` → `resume.filesBucket`), `src/files/files.controller.ts`
(`resume` scope, namespaced `resume/{userId}`), `src/app.module.ts` (registers
`ResumeModule`), `src/db/schema/index.ts`.

## Web — completed in this session

| File                                                                                                                                                                                                                            | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/profile/resume-validation.ts`                                                                                                                                                                                       | **Added the missing exports that broke the build**: `MAX_UPLOAD_BYTES`, `isValidPhotoFile` (image MIME + ≤ 5 MB), `CV_EXTENSIONS`, `isValidCvFile` (extension allowlist + cap), `cvMime` (extension → `Content-Type`, mirroring the backend's table). Pure functions. (Spec §4.)                                                                                                                                                                                                                                                                                                                                                                                          |
| `actions/resume.ts`                                                                                                                                                                                                             | **Added `deleteResumeAttachment()`** (spec §4 / R2 — the card's remove control had no action behind it). Also gave `createResumeAttachment`'s failure branch an optional `code` (see Decisions).                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `components/profile/ResumePreview.tsx`                                                                                                                                                                                          | **CV filled row now carries the remove control** (`aria-label="Remove CV"`, ghost icon, `deleteResumeAttachment()` → `onAttachmentChange(null)` + toast; on failure a toast and the row stays). **"Download resume" is now rendered only when `doc.attachment` exists** (was rendered-but-disabled — spec says hidden, not inert; `disabled={downloading}` is kept for the case where a CV _does_ exist, so the only disabled state left is an in-flight download). `onAttachmentChange` now accepts `null`. **CV upload now honours the `RESUME_ATTACHMENT_NOT_PENDING` short-circuit**: a replayed create skips the PUT and calls `complete` (spec §4 + the edge case). |
| `components/profile/ResumePersonalDetailsDialog.tsx`                                                                                                                                                                            | Gains `initial` + `onSubmit: (data) => Promise<boolean>` with a `saving` state; **lost `onDataChange`** and the per-keystroke effect; loads the stored block by a `useEffect` gated on `open && mode === "edit"`; **photo uploads on pick** (`isValidPhotoFile` first → `signUploadUser(name, "resume")` → PUT with `file.type` → public URL) with a `pendingPhoto` ref: a second pick deletes the previous unsaved object, a successful submit forgets it, closing without a submit best-effort `deleteUploadedUser`s it and restores the last stored photo; the empty frame shows while an upload is in flight.                                                         |
| `components/profile/ResumeCareerSummaryDialog.tsx`, `ResumeHobbiesDialog.tsx`, `ResumeExperiencesDialog.tsx`, `ResumeEducationsDialog.tsx`, `ResumeSkillsDialog.tsx`, `ResumeLanguagesDialog.tsx`, `ResumeReferencesDialog.tsx` | The spec's mechanical change, one per dialog: `onSubmit` → `Promise<boolean>`, a `saving` state, async `handleNext`/`handleSubmit` that awaits the write and only then advances/closes, `disabled={saving}` on the submit. (`ResumeJobPreferencesDialog.tsx` already had this; `ResumeLocationDialog.tsx` is a picker, not a step.)                                                                                                                                                                                                                                                                                                                                       |

Already present from the interrupted run and reviewed, not restructured:
`Resume.tsx` (loads via `getResume()` in the existing `Promise.all`; a failed
load renders the error card, never the start card), `ResumeStartBuilding.tsx`
(`initial` seeds every section, `done = initial !== null`, async handlers,
`ENTRY_SECTIONS`, `attachment` state), `actions/files.ts` (`resume` scope +
`deleteUploadedUser`).

Layout, copy, validation rules and step order are untouched.

## Decisions / readings the spec left ambiguous

1. **`createResumeAttachment` carries a `code` on failure.** Spec §4's declared
   type is `{ ok: false; error: string }`, but §4's prose and the edge-case list
   both require the web helper to distinguish `RESUME_ATTACHMENT_NOT_PENDING`
   ("the bytes are already up — skip the PUT and call `complete`"). The
   interrupted run implemented create-was-optional-step-3 only, i.e. it toasts
   instead of short-circuiting. I added an **optional** `code?: string` to the
   failure branch (a superset of the declared type, so the declared contract
   still holds) and branched on it in the card. Without this, a retried
   handshake whose response was lost fails for the user.
2. **"While an upload is in flight, show the existing empty frame"** is read as:
   the picker shows the 3 x 4 placeholder during the upload even when a previous
   photo is on screen — never a half-state.
3. **The dialog's photo preview keeps `next/image`** (not `DbImage`). The spec
   mandates `DbImage` only for the preview's photo; the dialog's src is a
   Storage URL and the hostname is already in `next.config.ts` `remotePatterns`
   (verified — `gikdqkuogotpoydbfonn.supabase.co`), so `next/image` is safe.
4. **Photo cleanup restores the last stored value.** The spec's verification
   step "close without saving → the next open shows the old photo" is met by
   resetting `photo` to `initial?.photo ?? null` in the abandon path (in edit
   mode the load effect would do this anyway; in wizard mode nothing else would).
5. **Backend `resume_attachments.file_name`** is stored as the picker reported
   it and the object key's trailing segment is sanitised separately
   (`[^a-zA-Z0-9.\-_]` → `_`), so a download saves under a clean name.

## Migration

`drizzle/migrations/0035_resume.sql` (+ `meta/0035_snapshot.json`, + journal
entry `idx: 35`, tag `0035_resume`, `when: 1792051899211`). Purely additive:
nine `CREATE TABLE IF NOT EXISTS` and constraints/indexes on those new tables
only. Applied to the dev DB by the interrupted run; **re-verified here**:

- watermark before `db:migrate`: `max(created_at) = 1792051899211` equals the
  journal `when`, so the entry is correctly considered applied (drizzle applies
  only `when >` the watermark);
- `pnpm --filter backend db:migrate` → `[✓] migrations applied successfully!`
  (idempotent, no re-run);
- `select to_regclass('public.resumes')` → non-null; the nine `resume_*` tables
  (`resumes`, `resume_personal`, `resume_experiences`, `resume_educations`,
  `resume_skills`, `resume_languages`, `resume_references`,
  `resume_job_preferences`, `resume_attachments`) all present;
- a second `pnpm --filter backend db:generate` prints **"No schema changes,
  nothing to migrate"** and `git status --short apps/backend/drizzle` shows only
  the three intended files (journal modified, `.sql` + snapshot new). This is
  exactly CI's drift check.
- `db:push` was never run.

## Gates (exact results)

| Gate                                                      | Result                                                                               |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `pnpm --filter backend lint`                              | clean (eslint `--fix`, no output)                                                    |
| `pnpm --filter backend test -- --testPathPatterns=resume` | **2 suites / 40 tests passed** (was 2 failed / 38 passed before the spec-helper fix) |
| `pnpm --filter backend test`                              | **43 suites / 573 tests passed, 0 failed** (baseline at ship start: 41 / 533)        |
| `pnpm --filter backend build`                             | clean (`nest build`)                                                                 |
| migration                                                 | see above — applied, verified, drift-free                                            |
| `pnpm --filter web lint`                                  | clean                                                                                |
| `pnpm --filter web exec tsc --noEmit`                     | clean (exit 0)                                                                       |
| `pnpm --filter web build`                                 | **✓ Compiled successfully** (exit 0) — web's type gate                               |
| `pnpm format:check` (repo-wide)                           | "All matched files use Prettier code style!"                                         |

## Live API verification (dev backend on :3000, scratch users, all since deleted)

Every claim below is from a real HTTP call against the running dev backend and
real Supabase storage; scratch rows and objects were removed afterwards
(`resumes` / `resume_attachments` back to 0 rows, `resume-files` bucket empty).

- Routes are registered and JWT-guarded: `GET /resume`, `DELETE
/resume/attachments`, `PUT /resume/skills/:id` all answer **401** without a
  token (not 404).
- Fresh account: `GET /resume` → `exists: false` with every section empty.
  A **second** account also reads `exists: false` — no cross-user read.
- `PUT /resume/personal` → the wire shape with `place` objects; `PATCH /resume`
  → `{ summary, hobbies, jobPreference }`.
- **CV handshake, PDF:** `POST /resume/attachments` → signed URL → PUT (200) →
  `POST …/:id/complete` → `{ status: "attached", size: 25 }` (the size storage
  reported, not the declared one) → `GET /resume` shows the attachment →
  `POST /resume/attachments/sign` → one signed URL; the object existed in the
  bucket, then:
- **Remove (R2's route, previously unverified):** `DELETE /resume/attachments`
  → `{ deleted: true }`; the object was gone from the bucket, the row count went
  to 0, `GET /resume` returned `attachment: null` with the rest of the document
  intact. A **second** DELETE is a no-op `{ deleted: true }`.
- **`.docx` path** (the file-type trap — `cvMime` sends
  `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
  because `file.type` is empty on many systems): create → PUT → complete →
  `{ size: 30 }` → `GET /resume` shows `my-cv.docx`. This is the path the
  bucket policy below was blocking.
- **Size cap:** `declaredSize: 6291456` (6 MB) → 400 `declaredSize must not be
greater than 5242880`. The storage read-back path (over-cap object removed +
  row `expired`) is covered by a unit test.
- **Photo scope:** `POST /files/sign { scope: "resume" }` → path
  `resume/{userId}/{uuid}-photo.png` (per-user namespace, exactly like `chat`);
  PUT 200; public URL serves 200. `PUT /resume/personal` with photoUrl A then
  photoUrl B → **object A is gone from storage**, only B remains (the
  replace-and-clean pattern). (A public fetch of A still answered 200 from
  Supabase's CDN cache; the bucket listing is the authoritative check.)

## Environment change made during verification (not code)

`resume-files` already existed in the dev Supabase project but its
`allowed_mime_types` was **`["application/pdf"]` only** — every `.doc`/`.docx`/
`.txt` upload would have been rejected by the bucket, i.e. the card's own copy
("doc, DOCX, PDF, txt") was untrue at the storage layer. It was updated via the
storage API to the spec's §5.7 configuration and read back:

```
public: False | file_size_limit: 5242880
allowed_mime_types: ['application/pdf', 'application/msword',
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'text/plain']
```

This is an **environmental step, not a code change**: a fresh environment (or a
fresh Supabase project) needs the bucket created/configured by hand — the app
cannot create it, and until it exists the attachment endpoints fail. Recorded so
a Tester does not conclude the upload path is broken when it is really
unprovisioned storage.

## What was NOT done

- **The manual browser walk (spec §7) was not run.** Everything was verified at
  the API/storage layer plus unit tests; the UI walk (wizard → reload → preview,
  the captain's Back → X reopen, the chip/% reaching 100, the remove control,
  the picker rejections with real toasts) is the Tester's run. The build, the
  type gate and lint are green, so the components compile and link.
- **No `src/resume/README.md`** — the spec's Non-goals say so explicitly.
- No commit, no push, no `db:push`; nothing outside the ship's files was
  refactored.

## What the Tester should focus on

1. **The captain's walk:** Step 1 → "Next to summary" → Back → X → reopen
   `/me/resume` must land on the **preview** with the stored details and
   "+ Add X" chips — never the start card, never a blank Step 1.
2. **The R2 remove control** on the filled CV row (chip un-fills, % drops,
   "Download resume" disappears, the object is gone from the bucket) and its
   idempotent second click.
3. **Download is absent, not disabled,** when there is no CV.
4. **The photo lifecycle:** pick → save → reload persists; pick → close without
   saving → object removed and the old photo returns; a non-image or > 5 MB
   pick toasts and never signs (nothing appears in the bucket).
5. **A failed `GET /resume`** (backend down) renders the error card, never the
   start card.
6. **Double-submit:** Save/Next is disabled while a write is in flight.
7. **A second account** sees `exists: false` and `POST /resume/attachments/sign`
   answers `[]`.
