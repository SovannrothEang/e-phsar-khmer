# Review: spec-detail-twelve (Foods field_schema)

**Branch:** `ship/spec-detail-eleven` **Date:** 2026-07-03 **Change class:** seed-data only (no migration / no runtime / no schema change)

**VERDICT: APPROVE**

## Summary

Seed-data-only change: `fieldSchema` was added to all 10 Foods subcategories in `apps/backend/src/categories/seeds/categories.seed.ts` (the final category block, L11399-12155). Each subcategory received one identical inline 11-field form matching the module-level `commonListingFields` const verbatim — no Type field, no Condition field, `photos.max = 8`, `contactPhones.max = 3`, labels en-only. No migration, no runtime code, no schema change. This maps exactly to `spec-detail-twelve.md` and to the spec/changes/test artifacts. Foods was the last bare main category; all 12 main categories now carry field schemas. I verified everything independently (the spec's `136→146` before-count is not diffable since `apps/backend/` is untracked, but the +10 delta and structural checks are fully consistent with only Foods being added).

## Verified (actual observed numbers)

- [x] `grep -c "fieldSchema:"` → **146** (matches expected 136→146, +10).
- [x] `grep -c "fieldSchema: \["` → **146** — every schema is an inline array literal.
- [x] `grep -c "fieldSchema: commonListingFields"` → **0** — no bare const references (const only ever spread).
- [x] `grep -c "commonListingFields.filter"` → **10** — the photos-spread sites are untouched.
- [x] `grep -c "&amp;"` → **0**; `grep -cF "gt;"` → **0** — no HTML-escape leakage.
- [x] Foods region (slug L11399 → EOF L12155): **10** `fieldSchema: [` arrays at L11407, 11482, 11557, 11632, 11707, 11782, 11857, 11932, 12007, 12082 — uniform +75-line spacing proves identical block length.
- [x] `meat` (L11407-11476) and `other-foods` (L12082-12151) are **byte-identical** to `commonListingFields` (L18-72) and to the `wardrobe-and-cabinets` inline block (L9716-9785): same field set, order, labels, types, `required`, `max`.
- [x] `key: 'condition'` appears **only** at L75 (the `conditionField` const def) — **0** in any fieldSchema, 0 in Foods.
- [x] `key: 'type'` last occurrence L10338 (< 11399) — **0** in Foods region.
- [x] `required: true` in Foods = **20** (title+price ×10; last at L12100 = `other-foods` price). `max: 8` = **10** (photos), `max: 3` = **10** (contactPhones) in-region; Pets-boundary occurrences (L11331/11386) correctly fall in the neighboring block.
- [x] Literal ampersand names intact, once each: `Bread & Bakery` (L11855), `Beer & Wine` (L11930), `Rice & Cereal` (L12005) — not escaped.
- [x] `CATEGORIES` array closes cleanly: L12151 `],` → L12152 `},` → L12153 `],` → L12154 `},` → L12155 `];`.
- [x] Neighbor **Pets** (detail-eleven, slug L10867) intact with **7** fieldSchema arrays (L10875-11325, `other-pets` last); same form shape, no Type key leaked in.
- [x] Spec mapping vs `spec-detail-twelve.md`: `Photo (0/8)`→`photos max:8`; `Delivery`→`deliveryFree` ("Free Delivery"); `Phone Number 1 (up to 3)`→`contactPhones max:3`; `Address` + `(Set location on google maps)`→`location` + `address`; no Type/Condition. Foods = 10 subcategories per `spec-detail-one.md` L197-208.
- [x] Gates (from `.pipeline/test-results.md`): lint / build (tsc) / test (13 suites, 97 tests) all green. Type literals all valid `FieldDef` members, confirmed by a passing build.

## Correctness / consistency notes

- **`Meat` vs `Meats`:** the spec header (`spec-detail-twelve.md` L1) says "Meats" but the seed name is `Meat` (L11405). This is a deliberate, documented decision (spec.md: keep the seed's "Meat") and is consistent with `spec-detail-one.md` L198. Not a defect.
- No seed-content test exists (the 97-test suite is a regression guard only). This is consistent with every prior spec-detail ship and acceptable for static seed data with no runtime consumer; the risk surface is a compile-time type check plus the structural grep gates, all of which pass. Nothing here warrants blocking.
- No security/performance surface: static literal data, idempotent upsert (`field_schema` written on conflict), not read at runtime.

## Follow-up tickets

1. **DRY the inline `fieldSchema` duplication (carried forward from the detail-eleven review — still applies, scope grew).** With Foods, the file now holds **146** inline `fieldSchema` arrays; the 10 Foods forms (plus Pets, `wardrobe-and-cabinets`, and every other exact-match category) are byte-identical to `commonListingFields` yet re-inline it rather than referencing it (~75 duplicated lines each). This ship added 10 more copies. **Non-blocking** — inline is the deliberate, planner-prescribed, repo-wide convention and this PR follows it faithfully. Recommend a **single systemic refactor ticket** (e.g. `fieldSchema: commonListingFields` for exact-match subcats), done once across all categories — not per-ship. It should not gate this or any individual spec-detail ship.
2. **(Pre-existing known gap, out of scope)** No `km`/`zh` translations for Foods subcategory names — en-only, consistent with all other categories; already tracked in the CLAUDE.md known-gaps list.
3. **(Pre-existing design note)** `field_schema` is not consumed at runtime (frontend forms hardcoded). Informational only; no action for this PR.

**Bottom line:** the code matches the spec field-for-field, touches only the 10 Foods subcategories, preserves slugs/names/sortOrder (including literal `&`), and leaves every other category and the array-closing `];` intact. Ship it.
