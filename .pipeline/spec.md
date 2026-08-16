# Spec: Fix admin category/subcategory image disappearance

## Problem statement

Admin-uploaded images for categories and subcategories (/wanderer/dashboard) vanish some time after upload. Categories lose ALL images at once ("complete nothing left"); subcategories keep some and lose others, losses observed around remove/edit operations. The DB `icon` column is the only thing the UI reads — when it is nulled or the storage object is deleted, the image disappears.

## Root cause analysis

### Finding 1 (PRIMARY — categories mass wipe): seed re-run resets every category icon to NULL

`apps/backend/src/db/seed.ts:38-41`:

```ts
.onConflictDoUpdate({
  target: categories.slug,
  set: { sortOrder: cat.sortOrder, icon: cat.icon ?? null },
})
```

- The seed data (`apps/backend/src/categories/seeds/categories.seed.ts`) defines NO icons — the only `icon` occurrence is the optional type field at line 13. So `cat.icon ?? null` is always `null`, and every `pnpm --filter backend db:seed` re-run executes the equivalent of `UPDATE categories SET icon = NULL` for all 12 seeded slugs.
- `db:seed` is documented as idempotent and is re-run routinely (every field_schema ship re-seeds). Nothing automatic re-runs it (no CI/deploy config in repo; `apps/backend/package.json` `db:seed` is manual) — the wipe fires on each manual re-seed, which matches "after upload for a while disappear".
- Storage objects are NOT deleted — they're orphaned in the bucket; only the DB column is nulled.

### Finding 2 (explains the asymmetry): the subcategory upsert omits `icon`

`apps/backend/src/db/seed.ts:69-75`:

```ts
.onConflictDoUpdate({
  target: [subcategories.categoryId, subcategories.slug],
  set: {
    fieldSchema: sub.fieldSchema ?? null,
    sortOrder: sub.sortOrder ?? i,
  },
})
```

No `icon` in SET → subcategory icons survive re-seeds. This is exactly why "subcategories some has the image" while categories lost everything. The fix is to make the category upsert match this convention.

### Finding 3 (secondary, web): edit forms always send `icon`, seeded from a placeholder fallback — column pollution

- `apps/web/actions/admin-categories.ts:28-33` and `apps/web/actions/admin-subcategories.ts:29-34`: `iconToSrc()` returns `"/placeholder.svg"` when the DB icon is null.
- Edit forms initialize from that value: `apps/web/app/wanderer/dashboard/categories/page.tsx:140` (`cateIcon: category.cateIcon`), `apps/web/app/wanderer/dashboard/subcategories/SubCategoriesClient.tsx:188` (`subIcon: category.subIcon`).
- Update actions always include icon in the PATCH: `apps/web/actions/category.ts:43` and `apps/web/actions/subcaetgory.ts:45` (`icon: parsed.data.X || null`).
- Result: editing any image-less row (rename only) PATCHes `icon: "/placeholder.svg"` — a truthy string the backend accepts (`UpdateCategoryDto.icon` is bare `@IsOptional() @IsString()`, `apps/backend/src/admin/dto/update-category.dto.ts:25-27`) — writing a fake path into the DB. It does not delete real objects, but it pollutes the column and makes "has icon?" indeterminable.

### Finding 4 (by-design deletions that match "disappear after remove")

These are working as intended, not bugs — listed so the captain understands which losses are permanent by design:

- X-remove + Save: `image-upload.tsx:103-106` sets `onChange("")` → PATCH `icon: null` → `admin-subcategories.service.ts:151-153` / `admin-categories.service.ts:138-140` delete the old storage object after commit.
- Replace image + Save: same guard deletes the replaced object.
- Category delete cascades ALL its subcategories (FK `onDelete: 'cascade'`, `categories.schema.ts:36-38`) and removes all their icon objects: `admin-categories.service.ts:158-171`. Deleting a category silently destroys every subcategory image under it.

### Hypothesis verdicts

1. Seed overwrite — CONFIRMED for categories (Finding 1); REFUTED for subcategories (Finding 2 shows the asymmetric SET clause).
2. Cleanup misfire on update — REFUTED in current code. Both services read `oldIcon` BEFORE the tx update and gate on `dto.icon !== undefined && oldIcon && dto.icon !== oldIcon` (`admin-categories.service.ts:89-95,138-140`; `admin-subcategories.service.ts:100-106,151-153`). A name-only PATCH from a row with a real icon sends the identical URL → no delete.
3. Signed vs public URL expiry — REFUTED. `ImageUpload` persists `signed.data.publicUrl` (`image-upload.tsx:73-74`); `getPublicUrl` (`supabase.service.ts:118-122`) returns a tokenless permanent `/object/public/<bucket>/<path>` URL. The signed URL is used only for the one-time PUT.
4. Remove-button collateral — REFUTED. `removeByPublicUrl` (`files.service.ts:105-125`) matches the exact `/object/public/<bucket>/` marker and strips query params; paths are `scope/<uuid>-name` so no prefix collisions. `deleteUploaded` (`apps/web/actions/files.ts:54-70`) is dead code — never called anywhere — so no wrong-path batch deletes originate from the web.

## Proposed fix

1. `apps/backend/src/db/seed.ts:40` — drop `icon` from the category upsert SET clause:
   - Before: `set: { sortOrder: cat.sortOrder, icon: cat.icon ?? null },`
   - After: `set: { sortOrder: cat.sortOrder },`
   - Keep the insert-side `icon: cat.icon ?? null` (line 35) — only affects brand-new rows. This matches the subcategory upsert convention and the documented "seeds never overwrite admin edits" philosophy (brands/models/attributes).
2. `apps/web/actions/category.ts` (`updatecategories`, line 43) — stop persisting the placeholder:
   ```ts
   icon:
     parsed.data.cateIcon && parsed.data.cateIcon !== "/placeholder.svg"
       ? parsed.data.cateIcon
       : null,
   ```
3. `apps/web/actions/subcaetgory.ts` (`updatesubcategories`, line 45) — same guard with `subIcon`.

No backend DTO/service changes; no new dependencies; no API contract changes. Create actions need no guard (their forms start at `""`, which `|| null` already maps to null).

Edge cases: the placeholder literal `"/placeholder.svg"` is duplicated in `admin-categories.ts:32` and `admin-subcategories.ts:33` — the guard must match it exactly. `icon: null` already flows through today (X-remove path), so `@IsOptional()` + the service's `dto.icon !== undefined` check handle it: proven path.

## Alternatives considered

- Backend DTO transform (`/placeholder.svg` → null): rejected — changes validation behavior/API surface; the web-side guard is sufficient.
- Extract seed upserts into a testable helper + unit spec: rejected as beyond minimal — `seed.ts` is a top-level-runnable script (`seed().catch(...)` at module scope); restructuring it is a separate refactor.
- Making edit forms omit `icon` when untouched (dirty tracking): rejected — bigger change; values already round-trip correctly with the guard.

## Test plan

- `pnpm --filter backend test` (existing suites; `files.service.spec.ts` covers `removeByPublicUrl`)
- `pnpm --filter backend build` && `pnpm --filter backend lint`
- `pnpm --filter web build` (web type gate — web has no check-types script) && `pnpm --filter web lint`
- No new unit tests required: the seed change is in a non-importable script and the web change is in server actions (web has no jest setup). Model to follow if tests are later wanted: `apps/backend/src/brands/brands.service.spec.ts` (mock-drizzle pattern).
- Optional manual verification (needs dev DB env): PATCH a category icon, run `pnpm --filter backend db:seed`, confirm `GET /admin/categories` still returns the icon.

## Risks / follow-ups

- Removing `icon` from the seed SET means a future seed-defined icon would not propagate on re-run. Acceptable — matches subcategory behavior.
- Note: the same SET clauses also reset admin-edited `sortOrder` on re-seed (category line 40, subcategory line 73). Out of scope; same pattern if the captain wants it.
- Lost category icons are recoverable only manually: the storage objects still exist under `category/` in the bucket (the seed never deleted objects, only nulled columns) — re-upload or write a one-off ops script to relink.
- `deleteUploaded` in `apps/web/actions/files.ts` is dead code (documented cancel-cleanup never wired) — orphaned-upload leak, opposite problem; separate ticket.
- Placeholder values already written into prod `icon` columns (`/placeholder.svg`) will need a one-off cleanup (`UPDATE categories SET icon = NULL WHERE icon = '/placeholder.svg'`, same for subcategories) — not part of this code fix.

## OPEN QUESTIONS

None.
