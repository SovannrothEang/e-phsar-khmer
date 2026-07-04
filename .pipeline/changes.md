# Changes: spec-detail-twelve (Foods field_schema)

**Date:** 2026-07-03
**Branch:** `ship/spec-detail-eleven` (established workflow stacks spec-detail ships on one branch)
**Spec:** `.pipeline/spec.md` (planner, no open questions)
**Source:** `apps/backend/spec-detail-twelve.md` + `spec-detail-one.md` L197-208 (Foods = 10 subcategories, one shared form)

## Summary

Populated `fieldSchema` on all **10 Foods subcategories** in
`apps/backend/src/categories/seeds/categories.seed.ts`. Every subcategory shares one
identical listing-creation form (same pattern as Pets/Jobs/Services). Seed-data only — no
schema change, no migration, no runtime code touched. **Foods was the last bare main
category; with this ship all 12 main categories carry field schemas.**

Implemented exactly as `spec.md` prescribed — the 11 fields written **inline** per the
established convention (matching `wardrobe-and-cabinets` / the just-shipped Pets block).
No deviation this time: the planner correctly prescribed inline (not a `commonListingFields`
const reference), so the coder followed the spec as-written.

## Files modified

- `apps/backend/src/categories/seeds/categories.seed.ts` — the `foods` category block
  (last entry in the `CATEGORIES` array, previously ~L11403-11416). The 10 bare entries
  (`{ slug, name, sortOrder }`) each gained an inline 11-field `fieldSchema` array.
  `slug` / `name` / `sortOrder` preserved verbatim; the array-closing `];` and all other
  categories are untouched.

## Field set (identical for all 10 subcats)

Order/values copied field-for-field from `commonListingFields` / the `wardrobe-and-cabinets`
block:

| #   | key           | type     | required | notes                                     |
| --- | ------------- | -------- | -------- | ----------------------------------------- |
| 1   | photos        | photos   | false    | `max: 8` (spec: `Photo (0/8)`)            |
| 2   | title         | text     | **true** |                                           |
| 3   | price         | price    | **true** |                                           |
| 4   | discount      | discount | false    |                                           |
| 5   | description   | text     | false    |                                           |
| 6   | location      | location | false    | absorbs "(set on Google Maps)"            |
| 7   | address       | text     | false    |                                           |
| 8   | deliveryFree  | boolean  | false    | label `Free Delivery` (spec: `Delivery`)  |
| 9   | contactName   | contact  | false    | spec: `Name`                              |
| 10  | contactPhones | contact  | false    | `max: 3` (spec: `Phone Number (up to 3)`) |
| 11  | contactEmail  | contact  | false    | spec: `Email`                             |

No `type` (Type) field and no `conditionField` — the Foods form has neither. Labels en-only.

Subcats (slug / name / sortOrder, all preserved): `meat`/Meat/1, `seafood`/Seafood/2,
`fruits`/Fruits/3, `vegetables`/Vegetables/4, `beverages`/Beverages/5, `grocery`/Grocery/6,
`bread-and-bakery`/**Bread & Bakery**/7, `beer-and-wine`/**Beer & Wine**/8,
`rice-and-cereal`/**Rice & Cereal**/9, `other-foods`/Other Foods/10.

## Care point: literal-`&` names

Three subcategory names contain a literal ampersand (`Bread & Bakery`, `Beer & Wine`,
`Rice & Cereal`). These were preserved exactly — **not** HTML-escaped. Verified post-edit:
`grep -c "&amp;"` → 0, and each literal name (`en: 'Bread & Bakery'` etc.) → 1.

## Verification (see `.pipeline/test-results.md` for full gate output)

- `fieldSchema:` count 136 → **146** (+10).
- Foods region: 10 fieldSchema arrays; each of the 11 keys appears exactly 10×;
  `required: true` ×20 (title+price); `max: 8` ×10 (photos); `max: 3` ×10 (contactPhones);
  `key: 'type'` ×0, `key: 'condition'` ×0; array closes cleanly with `];`.
- Lint / build / test all green; `eslint --fix` made no change (block already prettier-clean).
