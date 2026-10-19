# Test results — Resume (CV) persistence

Tester run, 2026-10-15. Everything below is from **live runs against the
running dev stack** (backend `:3000`, `next dev` `:3001`, real Supabase), not
from reading code. Drivers and raw result files live in
`/tmp/resume-verify/`; raw script output is quoted where it matters.

Scope: the spec's §7 verification plan plus its Edge-case list, with the manual
browser walk (which the coder explicitly did not run) as the center of gravity.
The lead's own gate results (43 suites / 573 unit tests, lint, web build,
`format:check`, migration `0035`, bucket config, `GET /resume` shapes) were
taken as a floor and **not** re-run.

**Verdict: PASS — no product defect found.** Every check that failed was a bug
in my own harness, re-proven after the fix (details in "Harness failures, not
product failures"). No product code, config, migration or test file was touched.

## Summary

| Area                                                                          | Driver                   | Result                                            |
| ----------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------- |
| The captain's walk (fresh user: Step 1 → Next to summary → Back → X → reload) | `walkA.js`               | **55/55**                                         |
| Full 8-step wizard walk, saving every step → Finish → reload                  | `walkA.js`               | included above                                    |
| ⋮ Edit an entry → Save → reload; ⋮ Delete → reload                            | `walkB.js`               | **22/22** observed (see note)                     |
| Fill a section from a "+ Add X" chip → reload                                 | `walkB.js`               | included above                                    |
| Job Preferences dialog → reload                                               | `walkB2.js`              | **7/7**                                           |
| Photo: upload → DbImage → reload → abandon → rejections                       | `walkC.js` + `walkC2.js` | **38/42** then **9/9** (the 4 were a harness bug) |
| CV: PDF + .docx + signed download + remove + rejections                       | `walkC.js`               | **38/42** (all CV checks passed)                  |
| Cross-user isolation, 401, spec edge cases, CV handshake errors               | `api.js`                 | **32/32**                                         |
| Double-submit disabled + the write on the wire                                | `walkD.js`               | **8/8**                                           |
| Child writes do not restamp `resumes.updated_at`                              | `stamp.js`               | **3/3**                                           |

Totals: **174 checks, 0 product failures** (168 clean + 4 harness-bucket
failures re-proven green in `walkC2`; `walkB`'s last 2 checks re-run in
`walkB2`).

## 1. The captain's walk — PASS

Fresh account, no resume row. Console (raw):

```
PASS  fresh: the start card renders
PASS  Step 1 opened  — Step 1 of 8
PASS  Step 1 → 2 (personal details saved)  — Step 2 of 8
PASS  Back returns to Step 1  — Step 1 of 8
PASS  X closes the wizard  — dialogOpen=false
PASS  captain's walk lands on the PREVIEW (start card gone)  — ok
PASS  DB: the typed '012 345 678' was stored compacted  — ["012345678"]
PASS  DB: exactly one resumes row + one personal row, no experiences
      — {"resumes":1,"personal":1,"experiences":0,"phones":["012345678"]}
PASS  after reload: still the preview, start card does NOT come back
PASS  unfilled sections show as + Add chips  — {"percent":5,"chips":["Photo","Gender",
      "Date Of Birth","Nationality","Email","Location","Address","Marital Status",
      "Education Level","Position","Years of Experience","Summary","Educations",
      "Work experience","Skills","Hobbies & Interests","Languages","References","Attachment"]}
PASS  no blank Step 1 is rendered on reopen
PASS  the wizard is unreachable from the preview (no Start building)
```

The partial resume lands on the **preview** with the stored phone and 18
`+ Add` chips, never the start card and never a blank Step 1 — exactly the
captain's stated case (spec Decision 4 / R1 Q1).

**One cosmetic divergence from the spec's wording** (not a failure; recorded so
the reviewer can decide): the spec's edge-case line says "the preview renders the
compact form". Immediately after the save the preview renders the **typed**
`012 345 678`; the compact `012345678` appears after a reload (the client state
holds what was submitted; compaction happens inside the server action). The DB
is compact in both cases, so nothing wrong is stored — the wire/store contract
holds.

## 2. Full wizard walk + persistence — PASS

All eight steps filled and saved (real dates through the Radix calendars,
Skill/Language/Degree through their pickers), `Finish`, then reload:

```
PASS  walk step 1 → 2 … step 7 → 8 (each shows the save land before advancing)
PASS  Finish closes the wizard onto the preview
PASS  preview shows the saved summary / experience company / position / school /
      degree+major / skill / language / hobbies / reference / email / phone
PASS  after reload: the preview renders without any wizard run
PASS  reload keeps the <each section>
PASS  DB: one row per table, one resume for user A
      — {"resumes":1,"personal":1,"experiences":1,"educations":1,"skills":1,"languages":1,"refs":1}
PASS  DB: dates stored as date-only (2000-01-15 → 2000-01-20)
PASS  DB: phone compacted to 012345678, email stored
PASS  DB: summary + hobbies on the resumes row
PASS  observed 30 server-action POST(s) to /en/me/resume; every one returned 200
```

The write path was captured **on the wire** (`walkD`, via
`Network.getRequestPostData` on the Next server-action POST): the body is
`["skills",{"id":"b3cf9fb0-…","title":"Wire Check","level":"Expert"}]` — the
browser really posts each step's payload. The backend hop itself is a
server-side fetch, so `PUT`/`PATCH`/`GET /resume` are not visible in the
browser's network panel; they were verified at the API and DB layers instead
(`api.js` + the row checks above).

## 3. ⋮ Edit / Delete — PASS

```
PASS  the ⋮ trigger opens the entry menu (pointerdown)
PASS  the ⋮ menu offers Edit + Delete  — Edit,Delete
PASS  the form is the Experiences dialog, prefilled from the entry  — ACME Corp
PASS  the stored dates are loaded back (2000-01-15 / 2000-01-20)
PASS  Save closes the edit form
PASS  reload: the edit survived
PASS  DB: the edit was written (upsert by id, still one row)
PASS  the entry disappears from the preview / reload: the deleted entry is gone
PASS  DB: the experience row is gone  — {"n":0}
PASS  the emptied section is back in the missing chips
PASS  the chip opens the add form (empty, add mode)
PASS  the 'I currently work here' switch disables the end date
PASS  reload: the chip-filled entry survived (renders "Present")
PASS  DB: the chip-filled entry is is_current=true with a null end_date
PASS  the Job Preferences dialog opens/saves/reloads; DB position=QA Lead
```

(`walkB` printed 22 PASS before its last two SQL probes; the probe had a
script-side column typo — the live column is `is_current`, not `current` — so
`results-walkB.json` was never flushed. The two probes were re-run in
`walkB2.js`: **7/7**.)

## 4. Photo lifecycle — PASS (`walkC2`)

```
PASS  storage: the saved photo is the only object under resume/{user}
PASS  the second pick uploads (the dialog img changes to a new object)
PASS  storage: BOTH objects exist while the second is unsaved
PASS  storage: closing WITHOUT saving removed exactly the abandoned object
      — after=[{…f3edb66d…-photo.png}] abandoned=6c2fe8e6…-photo2.png
PASS  the preview still renders the saved photo (old one remains)
PASS  a .txt pick toasts 'Choose an image up to 5MB.'
PASS  the >5 MB PNG toasts the same message
PASS  storage: neither rejection created an object (still exactly one)
PASS  the dialog photo never changed (no half-state)
```

In the preview the photo renders through `DbImage` (`img[alt="Resume photo"]`,
`naturalWidth > 0`, src is the raw Storage object URL — i.e. the `unoptimized`
path), and it survives a reload. Before any photo the preview shows the 3 x 4
fallback, not a broken image.

## 5. CV file lifecycle — PASS

```
PASS  with no CV: the Download button is NOT rendered (absent, not disabled)
PASS  the PDF attaches: the card shows its name + size  — "my-cv.pdf","4 KB"
PASS  the Attachment chip is gone (the % can reach 100)   [50 → 55]
PASS  DB: one attached row with the storage-read size
      — {"status":"attached","actual_size":4291,"file_name":"my-cv.pdf"}
PASS  storage: the CV object is in the private resume-files bucket
PASS  reload: the CV card still shows the file name + size; Download now rendered
PASS  Download mints a signed URL through window.open
PASS  the signed URL actually fetches the uploaded bytes  — status=200 bytes=4291
PASS  the .docx replaces the CV on the card
PASS  DB: exactly one attached row, now the .docx  — {"status":"attached","actual_size":819,…}
PASS  storage: the replaced PDF object is gone (one object only)
PASS  a .png on the CV picker is refused with the type/size toast
PASS  a 6 MB file is refused client-side (no new create row, no POST)
      — rows 1 → 1; toasts=["Choose a doc, DOCX, PDF or txt file (max 5MB).",…]
PASS  Remove CV empties the card; chip comes back; Download is gone
PASS  storage: the CV object was removed from the bucket / DB: no row left
PASS  reload: the CV is still gone and the card is in its empty state
```

The signed URL returned **200 with byte-for-byte the uploaded PDF** (4291 B) —
the download really fetches the private object. The card's copy
("doc, DOCX, PDF, txt") is true at the storage layer, so a `.docx` (whose
browser `file.type` is often empty) uploads fine.

## 6. Cross-user isolation + spec edge cases — PASS (`api.js` 32/32)

Second account (no resume of its own):

```
PASS  GET /resume without a token → 401
PASS  a SECOND account reads exists:false with every section empty
PASS  B's POST /resume/attachments/sign answers []  — {"success":true,"data":[]}
PASS  B completing A's attachment id → 404, no existence oracle
PASS  B's sign still answers [] while A has a CV
PASS  B's DELETE /resume/attachments cannot remove A's CV
      — B answered {"deleted":true}; A still has the attachment + 1 row
PASS  B deleting A's entry id does NOT delete it
      — B answered status=200 {"id":"7466f47a…","deleted":true}; A's rows=1
PASS  B's PUT on A's experience id → 404 and A's row is untouched
PASS  B's PUT on A's skill id → 404 (no cross-user write)
PASS  B's PATCH /resume creates/writes B's OWN row, never A's
PASS  when B writes, B gets its OWN row and A's document is untouched
PASS  DB: exactly one resumes row per user (A=1, B=1 after B's write)
```

Note on the lead's wording "deleting another user's entry id must 404": the
spec explicitly specifies the opposite for DELETE — _"A DELETE for an absent or
foreign id → `{ id, deleted: true }`, no 404, no cross-user delete (the
`resume_id` predicate is the guard)"_. The implementation matches the spec: B's
DELETE returns 200 with `deleted: true` **and deletes nothing**; the 404 is on
the write path (PUT/PATCH/complete), which does 404 without leaking existence.
Verified both halves.

Edge cases, all from the spec's list:

```
PASS  endDate < startDate → 400  — {"code":"RESUME_DATE_ORDER",…}
PASS  current:false with no endDate → 400  — {"code":"RESUME_END_DATE_REQUIRED",…}
PASS  current:true with an endDate stores end_date = null  — {"is_current":true,"end_date":null}
PASS  districtId without provinceId → 400  — {"code":"RESUME_LOCATION_INCOHERENT",…}
PASS  a malformed :id → 400 (ParseUUIDPipe)
PASS  DELETE of an absent id → { id, deleted: true }, not 404
PASS  create for an already-attached id → 409 RESUME_ATTACHMENT_NOT_PENDING
PASS  complete with no object in storage → 409 RESUME_ATTACHMENT_NOT_UPLOADED,
      the row stays pending  — row={"status":"pending"}
PASS  complete for an id with no row at all → 404
PASS  complete twice is idempotent (same size, no new object)
PASS  declaredSize above the 5 MB cap → 400
PASS  A's own DELETE removes the CV; a second DELETE is still { deleted: true }
PASS  A's document survives the CV removal intact
```

Also verified: `idempotency_keys` holds **0 rows** repo-wide after ~40 resume
writes and no `Idempotency-Key` header exists anywhere in `apps/web` — the
middleware no-ops, exactly as the spec's edge case states. And the coder's
deviation #1 holds behaviourally (`stamp.js` 3/3): a child write leaves
`resumes.updated_at` untouched, while `PATCH /resume` does move it.

## 7. Final DB / storage state (before cleanup)

```
resumes            total=2   (A=1, B=1 — one per user, UNIQUE(user_id) held)
resume_personal    2   resume_experiences 1   resume_educations 1
resume_skills      2   resume_languages   1   resume_references 1
resume_job_preferences 1   resume_attachments 1 (an orphan `pending` row whose
                                              resume_id is null, from the
                                              never-uploaded probe — the shape
                                              the hourly orphan sweep targets)
product-images/resume/<A>/  1 object (the saved photo);  resume-files  []
```

## Harness failures, not product failures

Four `walkC` storage checks failed because my bucket constant was `listings`
while this dev environment's `SUPABASE_STORAGE_BUCKET` is **`product-images`**
(the photo URL is
`…/storage/v1/object/public/product-images/resume/<user>/…`). Re-run against the
right bucket, `walkC2` passes **9/9**. Two `walkB` probes failed on a SQL typo
of mine (`current` vs the real column `is_current`); both pass in `walkB2`
(**7/7**). Three `api.js` checks failed on my own assertions (Nest `@Post`
returns **201**, not 200 — twice; and the "never uploaded" case was probed with
a nonexistent id, which is correctly 404, instead of a `pending` row, which
correctly answers 409); all three pass after fixing the assertions (**32/32**).

No failure was worked around by changing product code, config, or a test.

## What I could NOT verify

1. **The failed-`GET /resume` error card** (coder focus item 5: a dead backend
   must render the error card, never the start card). Forcing it needs the
   backend stopped or a second `next dev` with a dead `API_URL`, and the backend
   is shared with the other agents in this session — so I did not induce it.
   The code path is a one-line branch (`Resume.tsx:81-91`) but it is **not
   exercised here**.
2. **A literal 100% completed profile.** The chip/% behaviour is verified (the
   CV fill moved 50 → 55, chips drop as sections fill), but reaching 100 would
   mean filling all 20 items including the three-level location picker; not
   walked.
3. **Steps 3–8 date extremes in the UI** (future dates etc.) — the spec records
   these as a known gap (server-side shape-only validation) and the unit tests
   cover the service rules.
4. Nothing else in the spec §7 list was skipped.

## Cleanup

| Artifact                                              | Action                                                  |
| ----------------------------------------------------- | ------------------------------------------------------- |
| `resumes` rows for both test users (children cascade) | deleted                                                 |
| the orphan `pending` `resume_attachments` row         | deleted                                                 |
| `product-images/resume/<A>/f3edb66d-…-photo.png`      | deleted from Storage                                    |
| `resume-files` objects                                | none were left (the CV was removed as part of the walk) |

Post-cleanup state: all nine `resume*` tables **0 rows**, `product-images`
prefix empty, `resume-files` empty — the DB and buckets are back to exactly the
state this ship started in (`resumes` had 0 rows, buckets empty). A re-opened
`/en/me/resume` shows the start card again. Nothing was committed; `git status`
is unchanged from the start of this run (65 entries, HEAD `79817cc`).

## Environment note for the reviewer

The dev environment's photo bucket is **`product-images`**, not the documented
default `listings` (`SUPABASE_STORAGE_BUCKET` in `apps/backend/.env`). That is
long-standing env config, not this ship — but it means the resume photo (like
avatars and listing photos) lands in a **public** bucket, which is the exposure
the ship's Known-gaps entry already records. Worth naming explicitly since the
spec §7 step says "the photo lives in the public listing bucket".
