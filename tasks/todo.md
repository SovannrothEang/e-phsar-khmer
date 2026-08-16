# Ship: admin image upload disappearing bug

Feature request (verbatim): "check and figure it out about the image upload issues which
cause the image after upload for a while disapear, like category, it complete nothing left,
and the subcategories some has the image and some also disapear after remove"

## Plan

- [x] Stage 1 — Planner: investigate root cause of disappearing images; produce `.pipeline/spec.md`
- [x] Stage 2 — Coder: implement fix per spec; produce `.pipeline/changes.md`
- [x] Stage 3 — Tester: run build/lint/test gates; produce `.pipeline/test-results.md`
- [x] Stage 4 — Reviewer: review full pipeline output; produce `.pipeline/review.md`
- [x] Leave branch `fix/image-disappear-after-upload` for morning review; do NOT merge

## Review

Verdict: **APPROVE WITH NOTES** (no blockers) — see `.pipeline/review.md`.

- Root cause: `db:seed` re-runs nulled every category icon (upsert SET included `icon`, seed data has none); subcategories' upsert omits `icon`, hence the asymmetry. Secondary: edit forms wrote `/placeholder.svg` into the `icon` column.
- Fix: 3 lines across 3 files (`seed.ts` SET clause; placeholder guards in `actions/category.ts` + `actions/subcaetgory.ts`).
- Gates: backend 149/149 tests, backend build+lint clean, web build (type gate) clean, web lint 0 errors (1 pre-existing warning in untouched `AdminLoginForm.tsx`).
- Uncovered risk: no live-DB re-seed execution test (code-reading + build only); no browser-level round-trip test.
- Follow-ups filed in review.md: SQL cleanup of polluted rows, icon re-link ops script, sortOrder + en-translation seed clobbers, dead `deleteUploaded`.

## Constraints

- No new dependencies; no API contract changes; minimal diff.
- Subagents are read-only in this environment — main thread performs all writes + gate runs.
- Do not commit unrelated pre-existing deletions (apps/web/pnpm-lock.yaml, pnpm-workspace.yaml).

## Review

(to be filled at the end)
