# Review: Fix admin category/subcategory image disappearance

## Verdict

APPROVE WITH NOTES — the diff is exactly the spec's three-line fix, the root cause is independently re-confirmed, and every claimed tolerance path checks out in code; notes are branch hygiene and follow-ups only.

## Evidence audit

Independently re-verified (all file:line from the working tree on fix/image-disappear-after-upload):

1. **Diff fidelity:** seed.ts:40 is now `set: { sortOrder: cat.sortOrder }`; insert-side `icon: cat.icon ?? null` at seed.ts:35 untouched. Web guards at apps/web/actions/category.ts:43-46 and apps/web/actions/subcaetgory.ts:45-48 match the spec verbatim. Nothing else in code changed (git diff main: only the 3 code files + .pipeline docs + tasks/todo.md + the pre-existing pnpm deletions).
2. **Primary root cause CONFIRMED:** apps/backend/src/categories/seeds/categories.seed.ts has exactly one `icon` occurrence — line 13, the optional type field. No seed datum sets an icon, so the old `cat.icon ?? null` was always null → every db:seed re-ran `UPDATE categories SET icon = NULL` across the 12 seeded slugs.
3. **Asymmetry explanation CONFIRMED:** subcategory upsert (seed.ts:69-75) SET is `{ fieldSchema, sortOrder }` — never contained icon. That is genuinely why subcategory icons survived.
4. **Placeholder loop CONFIRMED:** iconToSrc returns "/placeholder.svg" for null icons (admin-categories.ts:28-33, admin-subcategories.ts:29-34 — literal byte-identical to both new guards); edit forms init from it (categories/page.tsx:140, SubCategoriesClient.tsx:188); old `|| null` persisted the truthy placeholder.
5. **Backend null tolerance:** UpdateCategoryDto/UpdateSubcategoryDto `icon` is `@IsOptional() @IsString()`; service gate `if (dto.icon !== undefined) patch.icon = dto.icon` (admin-categories.service.ts:99, subcategories equivalent) writes null — pre-existing proven path (X-remove).
6. **Self-heal storage safety:** polluted row healing fires the cleanup gate (`dto.icon !== undefined && oldIcon && dto.icon !== oldIcon`, admin-categories.service.ts:138-140), but removeByPublicUrl("/placeholder.svg") finds no `/object/public/<bucket>/` marker and doesn't start with http → silent return (files.service.ts:105-119). No storage side effect. Real-icon rename-only edits send the identical URL (iconToSrc pass-through) → gate skips → no delete.
7. **Single callers:** updatecategories only at categories/page.tsx:147; updatesubcategories only at SubCategoriesClient.tsx:196. Only the four action files touch /admin/categories|subcategories in web. deleteUploaded (files.ts:54) has zero callers — dead-code claim confirmed.
8. **Create flows:** create form defaults cateIcon:"" (page.tsx:65) / subIcon:"" (SubCategoriesClient.tsx:99) → existing `|| null` suffices; correctly no guard added. zod `cateIcon`/`subIcon` are bare `z.string()` — "" validates and maps to null (X-remove preserved; image-upload X button calls onChange("")).
9. **isActive edge case:** absent from both insert values and SET clauses — admin toggles survive re-seed. Admin-created rows (non-seed slugs) never hit the conflict target — unaffected.
10. **Gates:** not re-run by the reviewer (read-only); test-results.md claims are specific and internally consistent, and the lone lint-warning file (AdminLoginForm.tsx) is confirmed absent from the diff.

## Findings

1. [note] Working tree also carries pre-existing deletions of apps/web/pnpm-lock.yaml + pnpm-workspace.yaml (present before this branch's work) plus tasks/todo.md and .pipeline docs. Committing the branch wholesale would ride those along — stage selectively when landing.
2. [note] Legacy short-identifier icon values (not starting with "/" or "http") render as placeholder and now heal to null on edit instead of persisting "/placeholder.svg" — strictly better; pre-existing quirk already disclosed in test-results.md.
3. [follow-up] Translations upsert clobbers admin renames on re-seed: seed.ts:47-56 and 84-91 `set: { name: value }` overwrite admin-edited 'en' names (admin update writes to category_translations/subcategory_translations locale 'en', admin-categories.service.ts:106-117). Same class of bug as the icon one — the next most impactful seed clobber.
4. [follow-up] sortOrder still resets on re-seed (seed.ts:40 and 73) — spec flags it; confirmed still present (correctly left alone here).

No blockers.

## Follow-up tickets

1. One-off SQL cleanup: `UPDATE categories SET icon = NULL WHERE icon = '/placeholder.svg'` (same for subcategories); self-heal-on-edit only reaches rows someone edits.
2. Ops script to re-link already-nulled category icons — the storage objects still exist under the `category/` scope in the bucket; the seed never deleted objects.
3. Seed: drop `sortOrder` from the category/subcategory upsert SETs (seed.ts:40, 73) if admin manual ordering should survive re-seeds.
4. Seed: stop clobbering admin-edited 'en' translations (seed.ts:47-56, 84-91) — e.g. onConflictDoNothing for translations, or a documented decision that seed names are authoritative.
5. Remove or wire up dead `deleteUploaded` (apps/web/actions/files.ts:54) — orphaned-upload leak.

## Captain's morning-review summary

- What was broken: every `db:seed` re-run executed the equivalent of `UPDATE categories SET icon = NULL` — the seed defines no icons but its upsert SET included icon. Subcategories never had icon in their SET, which is exactly why they partially survived. Separately, editing any image-less row wrote the fake path "/placeholder.svg" into the DB because edit forms pre-fill from a placeholder fallback.
- The fix is 3 changed lines across 3 files: drop icon from the seed's SET clause, and map ""/"/placeholder.svg" → null in both update server actions. No backend, DTO, dependency, or API-contract changes.
- Nothing in storage was ever deleted by the bug — old category icons are still in the bucket and recoverable manually; polluted DB rows self-heal to null on their next edit with zero storage side effects.
- Gates are green per the tester (149/149 backend tests, builds, lints; one pre-existing warning in an untouched file); the one live-DB re-seed check was not executed and is honestly disclosed as an uncovered risk.
- Still manual after this ships: the one-off SQL cleanup for placeholder-polluted rows, re-linking the nulled icons, and the follow-up seed clobbers (sortOrder, en-translation names) plus the dead deleteUploaded action.
