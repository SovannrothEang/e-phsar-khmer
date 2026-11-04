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

- `components/filter/LocationSelectorFilter.tsx:117`
- `components/filter/SortFilter.tsx:59`
- `components/filter/PriceFilter.tsx:72`
- `components/filter/MoreFilters.tsx:211` (apply) and `:234` (clear all)

(Line numbers re-checked 2026-10-24; all five calls are still `router.replace`.)

Verify (headless CDP recipe in CLAUDE.md → "Web (Next.js)"): from a subcategory,
pick a Location / Sort / Price value, then `history.back()` must land on the
previous filter state — never past the subcategory page.

## 2. ~~Grid clicks outside brand/bodyType don't filter the feed~~ — done

**Done 2026-09-24 (`e70df0c`):** `GET /listings` gained `attrKey` + `attrValue`, and the subcategory page resolves the key from the set type via `SET_FIELD_KEYS`. Recorded in `CHANGELOG.md`. The original note is kept below for context.

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

## 4. Centre the map on the typed Location / Address text

The post form's location picker (`components/post/LocationMapPicker.tsx`) opens on
Phnom Penh until the seller drops a pin; it ignores the text they typed in the
Location/Address fields above it (the old Google-embed preview followed that text,
the Leaflet picker cannot without a geocoder). Fixing it means a geocoding lookup
— e.g. Nominatim `https://nominatim.openstreetmap.org/search?format=json&q=…`,
which requires a real Referer/User-Agent and is rate-limited, so it wants a
server-side call (a route handler or backend endpoint) with caching, not a
per-keystroke browser fetch.

## 3. Notification bell — one browser check left

Plan shipped 2026-11-01..04 (9/10; outcome in `CHANGELOG.md`). The user bell and
its panel are done; the residual row was a visual check that could not run without a
browser session:

- **4.2** Browser check with the `CLAUDE.md` chromium recipe at 390, 768, 1280 and
  1920 widths (light and dark): unread badge, open the panel, read one, delete one,
  mark all, "View all", a long Khmer body. Note that
  `apps/web/components/dashboard/notifications.tsx` still derives the **admin** bell
  from the report queues — that row (security plan 4.1) is separate.

## 4. Bakong demand-driven polling — a live sample and one decision

Plan shipped 2026-10-31..11-04 (7/9). Polling now runs only while a payment is open,
with the on-demand reconcile endpoint and the throttled check on the status read.

- **1.2** Batch check `check_transaction_by_md5_list` (≤50 md5 per call) — NBC does
  not document it and there is no schema for the response. Verify against a live
  account before trusting it; the code already falls back to the single check on
  error, so this is an efficiency win, not a correctness one.
- **1.3** Owner decision: shorten `PAYMENT_LATE_PAYMENT_GRACE_MS` (default 24 h) to
  the QR expiry plus a short margin, so abandoned QRs stop being polled. Needs proof
  that Bakong rejects an expired dynamic QR before the window shrinks.

## 5. Vercel usage investigation — two measurements

6/10. Rows 2.1 and 3.2 were superseded by the security plan (`APP_ROLE` and the
durable background-work work) and were deleted with the plan.

- **0.1** Controlled baseline: sign in on one idle tab for 10 minutes, then count
  requests per path per minute from `vercel logs`. Needs the captain's Vercel
  session.
- **4.1** Post-deploy re-measure with the same method once the background-work
  changes land, plus an independent review of those changes.

## 6. Push instead of poll — deploy and browser rows

4/7. P1.1–P1.3 shipped (backend publishes the three events, the web reacts, the safety
poll follows the socket state).

- **P0.1** Confirm the production socket from a browser (DevTools → Network → WS).
- **P2.2** Reconnect-storm check after a deploy: count WebSocket upgrades per hour for
  one parked and one active session.
- **P3.1** Independent review, `CHANGELOG.md` entry and a re-measure; blocked on the
  deploy.
- **P2.1** (optional, idle-visible disconnect) was never started and stays optional.

## 7. Signal-model key availability — one two-account browser matrix

12/13. The registration invariant, the heartbeat, the never-untargetable active set,
the held-send core and the content-free nudge all shipped.

- **K4.1** Two-account browser matrix: a brand-new account has a device row before any
  other page, a partner who never opened Messages is still targetable, and a held send
  lands when the recipient registers. Scenario 3 is verified; 1, 2 and 4 need a
  browser session (findings and commands are in `tasks/todo.md`).
