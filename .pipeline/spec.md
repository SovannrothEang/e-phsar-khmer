# Spec: Ship spec-detail-twelve (Foods listing form)

## OPEN QUESTIONS

None. This target is fully determined.

## Summary

Ship `apps/backend/spec-detail-twelve.md` (the **Foods** main-category listing form) by populating `fieldSchema: FieldDef[]` on all **10** Foods subcategories in `categories.seed.ts`. This is seed-data only: no migration, no runtime code, no schema change (the `field_schema` JSONB column already exists).

The Foods form is a **field-for-field exact match** to the module-level `commonListingFields` const (photos `max: 8`; `title`/`price` required; no `Type` picker; no `Condition` field). Per `spec-detail-twelve.md` line 15 (which points at `spec-detail-one.md` L198-207), **all 10 subcategories share this one identical form**. So every Foods subcategory receives the same 11-field inline array. This is the same shape as the just-shipped Pets (spec-detail-eleven), with 10 subcats instead of 7.

## Files to modify

- `apps/backend/src/categories/seeds/categories.seed.ts` — the **only** file to change. Foods category block is at **L11398-11418** (it is the last entry in the `CATEGORIES` array); its subcategories are the 10 bare `{ slug, name, sortOrder }` entries at **L11403-11416**. Add a `fieldSchema: [...]` property to each of the 10 subcategory objects, after `sortOrder`.

No other files. No `db:generate` / migration. No `.spec.ts`.

## Subcategory slugs (preserve slug / name / sortOrder VERBATIM — note the literal `&` in three names)

All 10 are currently bare (no `fieldSchema`). Add the identical field array (below) to each:

| sortOrder | slug               | name.en          |
| --------- | ------------------ | ---------------- |
| 1         | `meat`             | `Meat`           |
| 2         | `seafood`          | `Seafood`        |
| 3         | `fruits`           | `Fruits`         |
| 4         | `vegetables`       | `Vegetables`     |
| 5         | `beverages`        | `Beverages`      |
| 6         | `grocery`          | `Grocery`        |
| 7         | `bread-and-bakery` | `Bread & Bakery` |
| 8         | `beer-and-wine`    | `Beer & Wine`    |
| 9         | `rice-and-cereal`  | `Rice & Cereal`  |
| 10        | `other-foods`      | `Other Foods`    |

Do not rename, re-slug, re-order, or HTML-escape any of these. (The `spec-detail-twelve.md` header says "Meats"; the seed name is "Meat" — keep the seed's "Meat".)

## Resulting field set (identical for all 10 subcategories — 11 fields, in this exact order)

This equals `commonListingFields` verbatim. **Write it INLINE** (see Conventions). The simplest correct action is to copy the `fieldSchema` array body from the existing `wardrobe-and-cabinets` block (`categories.seed.ts` L9716-9785), which is byte-for-byte this set:

1. `{ key: 'photos', label: { en: 'Photos' }, type: 'photos', required: false, max: 8 }` ← from `Photo (0/8)`
2. `{ key: 'title', label: { en: 'Title' }, type: 'text', required: true }`
3. `{ key: 'price', label: { en: 'Price' }, type: 'price', required: true }`
4. `{ key: 'discount', label: { en: 'Discount' }, type: 'discount', required: false }`
5. `{ key: 'description', label: { en: 'Description' }, type: 'text', required: false }`
6. `{ key: 'location', label: { en: 'Location' }, type: 'location', required: false }` ← Location + "(Set location on google maps)" folded here
7. `{ key: 'address', label: { en: 'Address' }, type: 'text', required: false }`
8. `{ key: 'deliveryFree', label: { en: 'Free Delivery' }, type: 'boolean', required: false }` ← from `Delivery`
9. `{ key: 'contactName', label: { en: 'Name' }, type: 'contact', required: false }`
10. `{ key: 'contactPhones', label: { en: 'Phone Number' }, type: 'contact', required: false, max: 3 }` ← from `Phone Number 1 (up to 3)`
11. `{ key: 'contactEmail', label: { en: 'Email' }, type: 'contact', required: false }`

No `condition` field and no `type` (select) field — the Foods form has neither.

## Conventions followed

- **Inline, NOT a const reference.** Write the 11 fields inline in each subcategory (matching `wardrobe-and-cabinets`, detail-nine). Do **not** write `fieldSchema: commonListingFields`. Verified: `commonListingFields` is referenced in this file **only** as `...commonListingFields.filter((f) => f.key === 'photos')` (10 spread sites) and is never used as a whole `fieldSchema` value.
- **Photos `max` per-spec:** `spec-detail-twelve.md` line 2 says `Photo (0/8)` → `max: 8`. Do not generalize.
- **Delivery** → `deliveryFree` (`type: 'boolean'`, label `Free Delivery`).
- **Address + "(Set location on google maps)"** → one `location` field + one `text` `address` field (no separate maps field).
- **Name / Phone Number (up to 3) / Email** → `contactName` / `contactPhones` (`max: 3`) / `contactEmail`, all `type: 'contact'`.
- Labels are `en`-only.
- Same form applied identically to all subcategories (like Jobs/Services shared-form ships).
- Seed upsert in `src/db/seed.ts` writes `field_schema` on conflict → re-running `db:seed` stays idempotent.

## Edge cases

- Keep the file valid TypeScript: each new `fieldSchema` property goes after `sortOrder` inside the object, and each subcategory object keeps its trailing comma. The `type` string literals (`'photos'`, `'price'`, `'discount'`, `'location'`, `'boolean'`, `'contact'`, `'text'`) must match the `FieldDef` union exactly (`categories.schema.ts`) or `check-types` fails.
- Touch **only** the 10 Foods subcategories. Do not alter any other category, the `commonListingFields` const, or the `...filter(...)` spread sites.
- Do not add `km`/`zh` keys (out of scope; en-only per convention).
- Foods is the final category in the array — do not drop the array-closing `];` at L11419.

## Verification steps

1. **Count gate:** `grep -c "fieldSchema:" apps/backend/src/categories/seeds/categories.seed.ts` → **136 before → 146 after** (10 added; the tip skips the `fieldSchema?:` type-def line).
2. **Types:** `pnpm --filter backend build` passes (nest build → tsc).
3. **Lint:** `pnpm --filter backend lint` clean.
4. Spot-check: each of the 10 Foods subcategories (`meat` … `other-foods`) now has an 11-element `fieldSchema` with `photos.max === 8` and `contactPhones.max === 3`, and no other category block changed.
