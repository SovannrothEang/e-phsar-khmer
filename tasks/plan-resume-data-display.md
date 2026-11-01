# Plan — Resume data display (the view's filled states)

Status: **proposal for the captain's sign-off.** Nothing built from this plan yet; no
persistence exists — Stage 1 below is in-session UI only.

## 1. How the data flows

**Stage 1 (in-session, no backend).** Each form already exists (the wizard steps, reused as
edit/add forms). The only structural change:

- Every dialog reports its **entry** upward on Save — the same `onDataChange` pattern Step 1
  already uses for personal details.
- `ResumeStartBuilding` holds the whole resume as one object:

```ts
resume = {
  personal: ResumePersonalData,   // exists today
  summary: string,
  experiences: ExperienceEntry[], // company, position, location, start, end|present, description
  educations: EducationEntry[],   // school, degree, major, start, end|present, description
  skills: SkillEntry[],           // title, level
  languages: LanguageEntry[],     // title, level
  hobbies: string,
  references: ReferenceEntry[],   // name, company, position, phones[], email
  attachment: null,               // upload path not built yet
}
```

- The view renders from this object; the **chips and % derive from it** (`entries.length > 0`,
  fields non-empty) — the current "saved once" flag is replaced by real data.
- **Entry editing = one shared form per section + an index:** Add opens blank, kebab → Edit
  opens pre-filled, Save = append (add) or replace at index (edit), kebab → Delete removes.
  The forms keep their current look; only their data source/sink changes.
- **Wizard and view converge:** the wizard's Next validates and writes the same entry into the
  same object, so either path produces identical data.
- Refresh still resets everything (Stage 2 fixes that).

## 2. Display spec per section

Entry rows follow the captain's two mocks. Italic grey = the date line; the ⋮ menu sits on the
first line, right-aligned.

### Educations (mock)

```
RUPP                                        ⋮
2022-Feb - Present            (italic, muted)
Bachelor's Degree  in Computer Science
[+ Add Education]
```

- Dates render as `yyyy-MMM` joined by `-`, ending in `Present` when "currently attend" was on
  (e.g. `2022-Feb - 2024-May`).
- Degree and Major share one line with a wide gap (`Degree  in Major`); description, when
  present, follows clamped to 2 lines (proposal).

### Languages and Skills (mock — identical pattern, one line)

```
English • Intermediate                      ⋮
[+ Add Language]
```

Title bold, bullet, level; same for Skills (`TypeScript • Expert`).

### Work Experiences (proposed, mirror of Educations)

```
ACME                                        ⋮
2020-Jan - Present
Engineer · Phnom Penh         (location only when set)
Show your most relevant…      (description clamped to 2 lines when present)
[+ Add Experience]
```

### Summary (proposed, text block)

The text itself, clamped to ~4 lines with "…" (click to expand), ⋮ at the right, and the bottom
link becomes **Edit Summary** when filled (it stays **Add Summary** while empty).

### Hobbies & Interests (proposed)

Same as Summary: text clamped ~4 lines, ⋮ menu, **Edit Hobbies & Interests** when filled.

### References (proposed, mirror of Educations)

```
Dr. Sok                                     ⋮
Professor, RUPP
012 999 888 · sok@rupp.edu    (rows render only the parts that exist)
[+ Add Reference]
```

### Attachment / CV upload and Job Preferences

Pending their own designs — they slot into the same plan (Attachment shows file name + size +
Replace; Job Preferences mirrors an entry row).

### Empty state

Unchanged: icon + description + "+ Add X" (mocks 43 etc.), so every section reads the same
whether empty or filled.

## 3. The ⋮ menu (proposal — needs the captain's confirm)

- **Edit** — reopens that section's form pre-filled.
- **Delete** — removes the entry immediately; the chips/% update live. (Confirm: instant vs a
  confirmation step.)

## 4. Defaults to confirm

1. Ordering — dated sections newest-first by start date; Skills/Languages in the order added.
2. Dates — exactly the mock's `2022-Feb - Present`; education uses month/year granularity even
   though the picker stores a full date (the day is simply not displayed).
3. Long text — clamp with "…" + expand on click.
4. Saving — each form's Save writes immediately (in-session now, server later); no separate
   page-level Save.

## 5. Stage 2 — persistence (the "where does the data live" answer, for later)

- One table per section (`resume_summaries`, `resume_experiences`, `resume_educations`,
  `resume_skills`, `resume_languages`, `resume_hobbies`, `resume_references`,
  `resume_attachments`), following the repo's relational conventions; personal extras in
  `resume_personal`.
- `GET /resume` (assembled, own user) + per-entry `POST/PATCH/DELETE` endpoints.
- The view loads from the endpoint; each Save writes; the wizard writes through the same
  endpoints. CV upload goes to Storage with a `resume_attachments` row.
- This is a separate epic from the display work below.

## 6. Build sequence (when approved)

1. **Lift the section state** — dialogs report entries up; `ResumeStartBuilding` keeps the
   resume object; no visible change yet.
2. **Filled displays** — per the spec above, including the ⋮ Edit/Delete menu.
3. **Derived chips/%** — replace the saved-once set with data-derived completion; wizard Next
   writes entries.
4. **Stage 2 (separate):** backend tables + endpoints + upload.

## Open items needing the captain's word

- ⋮ menu: Edit + Delete OK? Delete instant or confirmed?
- Ordering: newest-first, or as added?
- Long text: clamp + expand, or always full?
- Experience/Education rows: show the description on the card (clamped), or keep rows to
  title/dates/position?
- Job Preferences form and Attachment upload designs.
