# Changes: Fix admin category/subcategory image disappearance

Implements `.pipeline/spec.md`. Three files changed, minimal diff, no new dependencies, no API contract changes.

## Files modified

| File                              | Change                                                                                                                                       |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/backend/src/db/seed.ts`     | Dropped `icon` from the category upsert `onConflictDoUpdate` SET clause (line 40). Insert-side `icon: cat.icon ?? null` (line 35) untouched. |
| `apps/web/actions/category.ts`    | `updatecategories`: `icon` now maps `""` and `"/placeholder.svg"` → `null` instead of persisting the placeholder.                            |
| `apps/web/actions/subcaetgory.ts` | `updatesubcategories`: same guard for `subIcon`.                                                                                             |

## Behavioral diffs

- Re-running `pnpm --filter backend db:seed` no longer executes the equivalent of `UPDATE categories SET icon = NULL` across all 12 seeded slugs; admin-uploaded category icons survive re-seeds (matches the existing subcategory upsert convention, which never had `icon` in SET — root cause of the categories-vs-subcategories asymmetry).
- Editing an image-less category/subcategory (e.g. rename only) now PATCHes `icon: null` instead of writing the fake path `"/placeholder.svg"` into the DB (edit forms are seeded from `iconToSrc()` which returns the placeholder for null icons). Column pollution stops.
- Already-polluted rows (`"/placeholder.svg"` in `icon`) self-heal to null on their next edit, with no storage side effects (`removeByPublicUrl` silently skips non-storage paths).
- Create flows unchanged: forms start at `""`, which `|| null` already maps to null.

## Verification performed at implement time (coder)

- Edit excerpts uniqueness-scoped (`method: "PATCH",` prefix) because the bare `icon:` line is byte-identical in create/update bodies of both action files.
- Zod schemas: `cateIcon`/`subIcon` are `z.string()` — required, non-nullable, no transforms; `""` passes validation and still maps to null (X-remove path preserved).
- Placeholder literal confirmed byte-identical in `admin-categories.ts:32` and `admin-subcategories.ts:33`.
- Single caller per update action (form `onSubmit`); no other path sends placeholder values.
- Backend tolerance of `icon: null` is a proven path (X-remove already PATCHes null; `UpdateCategoryDto.icon` is `@IsOptional() @IsString()`).
- Seed premise re-confirmed: `categories.seed.ts` has exactly one `icon` occurrence (the optional type field, line 13) — no seed data sets icons.

## Out of scope (tracked in spec follow-ups)

- One-off SQL cleanup for already-polluted `icon` columns.
- `sortOrder` also resets on re-seed (same SET clauses) — same pattern if wanted later.
- `deleteUploaded` dead code in `apps/web/actions/files.ts` (orphaned-upload leak) — separate ticket.
- Manual re-linking of already-nulled category icons (storage objects still exist under `category/` in the bucket).
