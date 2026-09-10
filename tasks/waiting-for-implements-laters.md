# Waiting for implementation (later)

Deferred work — seen and deliberately parked, not forgotten. Do NOT start these
unprompted; pick one up when asked. Each entry carries enough context to act
without re-deriving it. (The wider backlog lives in CLAUDE.md → "Known gaps".)

## 1. Unify the filter chips with the grid picks (Back undoes one filter at a time)

Captain, 2026-09-10: "unify the filter chips too" — recorded, not implemented.

Context: the grid picks (brand / body type / model in
`components/subcategory-layouts/OptionGrid.tsx`) now use `router.push`, so Back
walks the drill-down one choice at a time:
`?ad_type=sedan&ad_field=mg` → Back → `?ad_type=sedan` → Back → `cars-for-sale`.
The four shared chip filters still call `router.replace`, which rewrites the
current history entry instead of adding one — so filtering by Sedan and then
changing Price means a single Back loses both.

The change — `router.replace(...)` → `router.push(...)`, keeping each call's
existing `{ scroll: false }` (chips must not jump the viewport; scroll-to-top is
deliberate for the grid picks only, which change which grids exist):

- `components/filter/LocationSelectorFilter.tsx:110`
- `components/filter/SortFilter.tsx:87` (the helper is already named `pushSort`)
- `components/filter/PriceFilter.tsx:96`
- `components/filter/MoreFilters.tsx:202` (apply) and `:211` (clear all)

Verify (headless CDP recipe in CLAUDE.md → "Web (Next.js)"): from a subcategory,
pick a Location / Sort / Price value, then `history.back()` must land on the
previous filter state — never past the subcategory page.

## 2. Grid clicks outside brand/bodyType don't filter the feed

Clicking a Network, Job Type, Type, Accessory, … tile highlights it and updates
`ad_type`, but `GET /listings` accepts only `brand` / `bodyType` attribute
params, so the feed ignores every other attribute filter. Needs a backend param
(generic `attr=<key>:<value>` or per-key params) plus the page's slug → name
mapping it already does for brand/bodyType.

## 3. Admin Edit dialog keeps a non-storage image value in the form

`components/dashboard/image-upload.tsx` now hides a stored value that is not a
Storage object (shows "No <label> stored"), but the form still carries the raw
string, so pressing Save re-persists it (`icon: parsed.data.image || null` in
`actions/brand.ts` and siblings). Option: drop non-Storage values on save so the
stale bundled `/sub-img` paths clear themselves as admins edit. Captain's earlier
call was to leave the data alone, so this one needs an explicit go-ahead.
