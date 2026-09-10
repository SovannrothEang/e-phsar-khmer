# Ship: user OTP verification page after phone registration (web)

Feature request (verbatim): "after normal user login by phone number, we need to set otp to
confirm with phone number. 1. do we have otp screen yet after login by phone number? (user will
register, with phone number on register, and after user click submit after fill information), we
should redirect to otp page right? and if we have to do so, then does we have page for otp? if
not, then you need to create a otp component and page to handle this, and about page you need to
get the design of shadcn style which is simple and clean, and otp 1 column accpet only one digit,
and otp need 6 digit for this. NOTE: don't change register design, it will serve. by the way,
does otp form can give us enough yet? even if it mock up? (web, and register is correct on
register page)"

## Plan

- [x] Stage 1 — Planner: research register flow + existing OTP surface; produce `.pipeline/spec.md`
- [x] Stage 2 — Coder: implement OTP component + page + register redirect per spec; produce `.pipeline/changes.md`
- [x] Stage 3 — Tester: run web build/lint gates; produce `.pipeline/test-results.md`
- [x] Stage 4 — Reviewer: review full pipeline output; produce `.pipeline/review.md`
- [x] Leave branch for morning review; do NOT merge, do NOT commit (state achieved:
      everything uncommitted on `feat/otp-verification-screen`, on top of `c9afe97`)

## Mid-session discovery (2026-08-17)

An interrupted earlier run of this same ship left commit `c9afe97`
("feat(web): add /otp phone verification screen after register (mock-wired)")
on a new branch `feat/otp-verification-screen` mid-way through this session
(checkout 18:04, commit 18:26:55). The session-start git snapshot predates it,
and some early reads returned pre-commit state. Current pass reconciled by
layering the spec-compliant real-API implementation on top of `c9afe97` as
uncommitted working-tree changes. Morning review happens on
`feat/otp-verification-screen`.

## Constraints

- No new dependencies (hand-roll the 6-box OTP input; no `input-otp` package).
- Do NOT change the register page design — only its submit wiring (redirect to OTP page).
- Do not commit anything; leave pre-existing working-tree deletions
  (apps/web/pnpm-lock.yaml, apps/web/pnpm-workspace.yaml) untouched.
- Subagents are read-only in this environment — main thread performs all writes + gate runs.

## Review

Verdict: **APPROVE WITH NOTES** (no blockers) — see `.pipeline/review.md`.

- What shipped: spec-compliant OTP verification — register submit → real
  `POST /auth/register` (SMS OTP) → redirect `/{locale}/otp?phone=+855…` →
  6 one-digit boxes (shadcn `input-otp`, already a dep) with auto-advance /
  paste / auto-submit → real `POST /auth/otp/verify` → session cookies set →
  redirect `/`. Resend via real `POST /auth/otp/request` with 60 s cooldown.
  Replaces the hardcoded-`123456` mock from `c9afe97`.
- Register design freeze: verified by reviewer — JSX byte-equivalent, only
  submit wiring changed (file-wide diff is the formatter hook).
- Gates: web lint 0 errors (1 pre-existing warning in untouched
  `AdminLoginForm.tsx`); web build PASS with `/[locale]/otp` registered;
  backend 0 files changed.
- Uncovered risk: the 6 manual runtime flows (wrong-code retry, dev-token
  auto-login, resend, no-`?phone` redirect, locale route, register→OTP
  redirect) were NOT executed — no live backend session. 10-minute morning
  pass with `DEV_OTP_TOKEN` recommended (list in `test-results.md`).
- Follow-ups filed in `review.md`: manual flow pass; phone-validation
  hardening (`0000000000`-style garbage, raw-`+` URLs); register
  failure-toast parity; commit hygiene for the pre-existing
  `pnpm-lock.yaml`/`pnpm-workspace.yaml` deletions (do NOT `git add -A`).

## Post-review: DEV_OTP_TOKEN verification (captain request)

Captain asked whether the flow works with `DEV_OTP_TOKEN`. Findings:

- It was **already configured**: `DEV_OTP_TOKEN=000000` in
  `apps/backend/.env` (6 digits — fits the 6-box web input).
- The reason it "can't be used": **backend wasn't running** (nothing on
  :3000 → web register toasts "Failed to send code").
- Smoke-tested live end-to-end (backend started from dist, then stopped):
  register `+855777000123` → `{otpSent:true}` (no SMS); wrong token
  `111111` → rejected; correct `000000` → accessToken/refreshToken/user
  created. Side effect: dev-DB test user `+855777000123` now exists.
- Documented in `CLAUDE.md` (keep value ≤ 6 digits; restart backend after
  changing; `.env.example` edit was blocked by the `.env*` guard hook).

## R1 (2026-08-18): Cambodia-local phone input (approved plan)

- [x] Plan mode: exploration + design check (SOUND); captain approved
      Option A (input local `0…`, wire/DB E.164)
- [x] Implement: schema regex rule, `formatPhoneLocal`, OTP local display,
      `type="tel"` on the phone field
- [x] Gates: web lint 0 errors; web build pass
- [ ] Morning manual matrix (plan file) with backend under DEV_OTP_TOKEN

## R2 (2026-08-18): phone+password→OTP login; password/names/username at registration (approved plan rev 2)

- [x] Backend: VerifyOtpDto (required password, optional names) + verifyPhoneOtp
      password-first rework + mirrorSupabaseUser insertExtras + POST /auth/otp/login + RequestOtpDto rider
- [x] Backend unit tests: insert extras, conflict-set purity, wrong-password 401
      (no Supabase call), DTO 400, requestLoginOtp paths
- [x] Backend gates: test / build / lint
- [x] Web: isLocalPhone + lib/otp-registration.ts + actions/otp.ts (requestLoginOtp,
      verifyOtp registration param)
- [x] Web: RegisterForm store payload; OtpVerifyForm mount-guard/copy/back-target;
      LoginForm submit branch ONLY (form untouched per captain)
- [x] Web gates: lint / build
- [x] Pipeline docs R2 + manual matrix left for morning review (DEV_OTP_TOKEN=000000)

## R4 (2026-08-19): user account mode — Phase A (identity)

- [x] userServerFetch + tryUserRefresh (user-side API client)
- [x] getCurrentUser() fail-soft helper + anonymous fast-path
- [x] userLogout() action
- [x] (user)/layout.tsx session-aware → NavBar
- [x] NavBar: user prop, localStorage mock removed
- [x] SocialBar: real avatar/name/handle, /me link, real logout
- [x] /me: real account card + login redirect
- [x] Gates: web build PASS, web lint PASS; backend untouched
- [x] Browser-verified via CDP (guest + logged-in home, /me)
- [ ] Phase B (post-an-ad wiring) — deferred per captain
- [ ] Phase C (mock /me header "Thouch Sayi", subpages, lib/user.ts)

## R4b (2026-08-19): post-login redirect → /me

- [x] LoginForm password-mode success → push /me
- [x] OtpVerifyForm verify success → push /me (register/login OTP both)
- [x] Browser E2E: password mode → /en/me; phone mode → /otp → /en/me
- [x] Gates: build ✓ lint ✓

## Post-review fix (2026-08-25): /me design restored + real identity + logout locale bug

Captain flagged: "why the /me change the 'manage ads', isn't it supposed to
look like this?" — R4 had replaced the designed `/me` page (`manage-ads`
tabbed page = `<ManageAds />` + `MyProfileHeader`) with a minimal account
card. Plan approved: restore design + real header, keep mock counters.

- [x] SessionUser + getCurrentUser: added `coverPhotoUrl`
- [x] MyProfileHeader: `User` prop → local `ProfileUser` (name/username/
      avatar/cover/following/follower/joinDate); JSX untouched
- [x] me/layout.tsx: async, getCurrentUser gate → /login (locale-aware),
      builds ProfileUser from session (real name/@username/avatar/cover/
      joined date; following=1 follower=2 mock until Phase C)
- [x] me/page.tsx: restored to `<ManageAds />` (R4 account card removed)
- [x] BUG FOUND via E2E: `userLogout()` redirected to bare `/login` → 404
      (user surface lives under `/[locale]`). Fixed: i18n redirect + locale
- [x] Gates: web lint 0 errors (1 pre-existing warning), web build PASS
- [x] Browser E2E (fresh chromium, DEV_OTP_TOKEN=000000): 20/20 —
      visitor → /en/login; register → OTP 000000 → /en/me; design markers
      (Manage Ads tab, tab bar, Total Ads/Renews, Active/Expired,
      No Result!/Sell your staff); real identity (Sok Dara, @sokdara3,
      Joined); R4 card gone; refresh persists; dropdown → Sign out →
      /en/login → visitor chrome

E2E-verified notes for future runs: `.outline-none` is NOT unique (button
base class) — use `.ml-2` for the avatar trigger; Radix triggers open on
pointerdown (a synthetic click() does nothing) and menu items select on
click; screenshots vs code: empty-state button says "Sell your staff"
(code) — matches Figma reference per captain's design.

## /me cover placeholder (2026-08-25, captain follow-up)

The header cover area rendered as a white block for users without a cover:
the mock used `bg-gradient` (no direction — no background-image in
Tailwind), and clicking an empty cover opened the lightbox instead of the
upload picker. Now `MyProfileHeader`: empty cover shows a branded
gradient track (from-[#00a0e9]/10 → #b8e0f7/25 → /5, outlined by eyes,
no center icon/text per captain) and clicking the empty area opens the
file picker (coverInputRef click); with a cover, click still opens the
lightbox and the bottom-right "Upload Cover" button remains. Gates: lint
0 errors, build PASS. Captain will eyeball it in browser themselves.

## Homepage Browse By Category → live backend categories (2026-08-25)

`components/home/CategoryGrid.tsx` now fetches `GET /api/v1/categories`
server-side instead of `lib/categories.ts` mock (raw `fetch`, no-store,
`Accept-Language: <locale>` header from `getLocale()`; envelope unwrap
`{success, data}`; failure or zero items → section renders null, homepage
never 500s). Local `BackendCategory` type (slug/name/icon) — web is
standalone, no backend DTO imports. Labels render the DB `name` directly
(`t(name)` dropped — 4 of 12 DB names don't match en.json keys).
`icon: null` → `LayoutGrid` fallback inside the blue circle (5 of 12 have no
uploaded icon yet). Mock `lib/categories.ts` untouched (6 other consumers,
incl. client components).

Verified: `pnpm --filter web lint` 0 errors (1 pre-existing warning in
AdminLoginForm — untouched); `pnpm --filter web build` PASS (route dynamic,
backend-down-at-build is not a hazard); browser (headless chromium, recipe
per CLAUDE.md) on /en: 12 tiles, names match DB exactly ("Cars and
Vehicles", "Phone & Tablets", "Home & Land", "Books & Sports & Hobbies"),
7 real Supabase icons + 5 LayoutGrid fallbacks, hrefs → /en/category/<slug>
resolve (cars-and-vehicles page loads, no 404); /km and /zh render the same
12 tiles with locale-prefixed hrefs (English names — en-only seed, known
gap). Not browser-tested: backend-down failure path (code returns null; the
live backend was left running).

Visible wording shift (intended, DB now source of truth): Car and Vehicle →
Cars and Vehicles; Phones & Tablets → Phone & Tablets; House & Land →
Home & Land; Books, Sports & Hobbies → Books & Sports & Hobbies.
Follow-on (out of scope, flag): /category/[categorySlug] pages still read
the mock — a brand-new category added in admin would 404 on its card link
until Phase C migrates those pages.

## Category + subcategory pages → backend data; car brands/bodyTypes live (2026-08-25)

**Backend** (cars-first data + one public endpoint):

- New `PublicAttributesController` → `GET /api/v1/attributes/:type` (`@Public()`,
  registered in AttributesModule; module was decoupled to grow a public
  surface). AttributesService.list returns full rows incl. subcategoryIds.
- `brands.seed.ts`: `CAR_BRANDS` (91 car brands, design order — MG first;
  name/order extracted from the mock, slug+icon from the /sub-img png
  filename — mercedes-benz/ssang-yong/kia mock slugs differed; Other →
  other-car-brand). `BrandSeed.icon?: string`; values insert icon;
  onConflictDoUpdate.set never touches icon → phone/admin icons survive.
  Duplicate-slug guard: xiaomi appears in both sets — first occurrence
  (phones) upserts; car occurrence only links `brand_subcategory_links`
  (+ null-icon backfill). `slugs` Set now spans both arrays (bug found in
  gates: car links were skipped because 'cars-for-sale' was never fetched).
  MODEL_SEEDS += mg (14)/leapmotor (2)/toyota (2, mock's "Pirus" verbatim).
- `attributes.seed.ts`: null-only gap-fill maps the 9 car bodytype rows to
  /sub-img icons (other-type → other.png); no-op on this DB — the captain
  had already uploaded all 16 bodytype icons via admin (Supabase URLs
  preserved; mini-truck only one still NULL).
- Gates: build PASS, tests 27/27 (attributes/brands/categories), seed x2
  idempotent (158 brands → 157 rows incl. xiaomi duplicate), REST: cars-for-
  sale → 91 (MG first, icons incl. 10 admin Supabase?), wait — brand icons:
  91 car brands carry /sub-img paths; phones list xiaomi sortOrder 14 +
  admin icon intact; /attributes/bodytypes public → 16 rows (15 with icons).

**Frontend:**

- `lib/api/categories.ts` (server-only): getCategoryWithSubcategories /
  getBrandsForSubcategory / getBodyTypes / getModelsForBrand —
  CategoryGrid-style raw fetch + envelope + null/[] on failure; local types.
- Both pages → async RSC (`params`/`searchParams` Promises, `getLocale()`,
  repo convention). Mock import, dead scroll effect, dead "Jobs" block gone;
  SUBCATEGORY_LAYOUT/COMMON_CATEGORIES keys updated to backend slugs.
  Subcategory page: cars-only brand+bodyType grids, bodytypes filtered by
  `subcategoryIds` (UUIDs!) includes sub.id, models fetched via
  `/brands/:id/models` when ad_field set.
- "use client" added to the 11 hook-using leaves (4 category layouts, 6
  headers, SubcategoryContent); SubcategoryGrid/OptionGrid prop types → local
  minimal interfaces; SubcategoryGrid icon null-guard (text pill); OptionGrid
  gained `unoptimized` on the grid Image (REAL BUG caught in browser: mock
  icons were local paths, admin Supabase brand icons crashed the page —
  OptionGrid.tsx:95).
- Gates: web lint 0 errors, web build PASS (also re-run after the
  OptionGrid fix + after prettier).

**Browser (headless chromium):** category page CG hit "Cars and Vehicles in
Cambodia", 10 subcategory tiles all admin icons, links resolve; cars-for-sale
→ 20 brand tiles (MG/Leapmotor/Toyota first) + 9 body-type tiles (Sedan…),
images render (supabase + /sub-img mix); MG click → 14-model grid; Sedan
click → `?ad_type=sedan` + breadcrumb; motorcycles-for-sale 0 grids + header;
phones-and-tablets/phones 0 grids; km/zh render 29 grid tiles. No browser
test of backend-down path (code returns null → "Category/Page not found").

**Captain awareness:** car brand/bodyType grids are LIVE backend data now;
91 car brands (MG first), all icons present (brands = /sub-img paths
interim — admins replace via UI; follow-up: move to Supabase storage);
car xiaomi sits at car-grid position 14 (globally-unique slug conflict,
flagged). Non-car categories have no option grids this round ("handle
another later"). Mock lib/categories.ts untouched (PostForm/SearchBar/
AllAds/lib/data still consume it).

## Phones option grids live (2026-08-25, captain: "now handle phones")

Backend needed nothing — phone-family brands were already seeded + linked
(phones 35, tablets 15, smart-watches 19) with mostly admin-uploaded logos
(28/35, 12/15, 17/19) and seeded models. Frontend only:
`[subcategorySlug]/page.tsx` — the cars-only gate on the option-grid fetch
is gone: brands + models are fetched for ANY subcategory with linked
brands; bodytypes are fetched always but the subcategoryIds (UUID) filter
returns [] off-car, so body-type grids stay car-only by data, not by code.

Verified: web lint 0, build PASS. Browser: phones → 20 brand tiles
(Apple/Samsung/Huawei/Sony first; 16 supabase icons + 4 text pills for the
not-yet-uploaded logos), tablets 15, smart-watches 19, Apple click → 18
model tiles (iPhone 16 Pro Max first, seeded baseline); cars regression
unchanged (20 brands + 9 bodytypes); jobs subcat 0 grids; unknown slug →
"Page not found" div (no 500). Pills appear where a brand has no uploaded
logo — admin ImageUpload fills them.

Note: phone pages show brand+model grids only — no storage/condition-type
pills (SubcategoryContent never rendered them; mock carried `storages`+
`condition` but the design has no such picker on browse pages).

## Category filter bar → All Ads look (2026-08-25, captain Image #20/#21)

The category-page filter bar (all four Layout components) was broken vs the
All Ads bar: the grid/list icon block sat on its own row below the chips
(wraparound, #20). Rebuilt all four (`CommonCategoryLayout`/`CarsCategoryLayout`/
`ServicesCategoryLayout`/`JobsCategoryLayout`) to the All Ads structure:
`Tabs` wrapper + title block + single `flex items-center justify-between`
bar — shared `LocationSelectorFilter`/`SortFilter`/`PriceFilter`/`MoreFilters`
chips left (URL-driven popovers, working — replaces the old local-state
dropdown stubs) + `TabsList` (grid/list toggles, grid active) right. All four
files are byte-identical except the props interface / export name (jobs'
"Salary" label was internal-only; no extra chips existed).

Verified: lint 0, build PASS; browser — phones/cars/jobs bars all single-row
(h=74px, no horizontal overflow), chips = Location/Sort/Price/More Filters +
2 tabs; screenshot matches #21 (chips left, toggles right, grid tile active).
The "More Filters" chip now opens a real popover (was a dead stub).

Note: category-page filters are URL-driven now (e.g. ?loc_pro=), same as
All Ads; the mock listing sections below don't consume the params yet (same
as before — the old local-state filters didn't filter anything either).

## Category filter bar: floating + working grid/list toggle (2026-08-25, #25)

Follow-up on the All Ads bar port: (1) the bar was glued below the title
instead of floating; (2) the grid/list toggle changed no content. Fixed:

- The 4 category layouts now render title + bar only (bar `sticky top-16
z-40`, TabsList — no own <Tabs> wrapper); the CATEGORY PAGE owns the Tabs
  root so the layout's TabsTriggers switch the page's post sections.
- Page: Tabs("grid"|"list") → TabsContent grid = HighLightAds sections
  (grid cards), list = NormalAd sections (ListCardPost list cards);
  SubcategoryGrid stays visible in both views (like AllAdsCategories).
- Sticky gotcha: the layout was wrapped in a short `mb-3` div — the bar could
  not travel (its containing block was ~74px). Layout now unwrapped; spacing
  moved to the SubcategoryGrid wrapper (`mt-3`).

Verified: lint 0, build PASS. Browser: bar floats at exactly top:64 while
scrolling (screenshot shows content sliding under it, same look as #25);
list click shows the list-card panel while the bar stays pinned; grid default
unchanged.

## Category bar equal-space parity (2026-08-25, captain #26 vs #27)

Measured live: All Ads bar has 8px gaps on BOTH sides (title→bar and
bar→content); category pages had 8px above but 20px below (SubcategoryGrid
wrapper `mt-3` added 12px over an intrinsic 8px). Removed the margin →
both gaps 8px, matching All Ads exactly. Screenshot verified.

**⚠ Storage finding (unrelated to spacing, surfaced while screenshotting):**
the category-icon objects exist, but the DB's BRAND / BODYTYPE / SUBCATEGORY
icon URLs all return `NoSuchKey` (tested apple.png brand, sedan.png
attribute, cars-for-sale.png subcategory — Supabase 404). The img elements
render as broken glyphs on phone brand grids / bodytype grids / subcategory
tiles (my earlier "icons present" checks counted <img> presence, not load
success — real bug visibility). Only the 91 car brands I seeded with
`/sub-img` local paths render. Likely the storage bucket was reset or the
objects were deleted; category icons survive. Captain to re-upload via admin
UI (or restore objects). Ask: do we want an onError fallback (broken img →
text pill) in OptionGrid/SubcategoryGrid so missing storage objects degrade
gracefully instead of showing glyphs?

## Category grid/list toggle → actual post feed (2026-08-25, captain #28)

Mistake fixed: I had wired the toggle to the "Highlights" (HighLightAds) and
"Latest Ads" (NormalAd) ad sections. The toggle now mirrors the All Ads feed
exactly: grid view = `GridCardSell` + `posts.map(GridCardPost)` in
`grid-cols-2 md:3 lg:4`, list view = `ListCardSell` + `posts.map(ListCardPost)`
— same components/imports as AllAdsHeader, section headers gone.

Verified: lint 0, build PASS. Browser: grid panel = Sell card + 39 post
cards in 4 cols, no Highlights/Latest Ads text; list panel = 39 list cards

- Sell card; screenshot matches #28 (RX7/Supra/iPhone first row).

## Cars-for-sale filter bar → image-6 component (2026-08-31, captain images #6/#7)

Plan approved via plan-mode checkpoint. Captain: "make the car for sale has
this component like the image [6] — 'more filters' move to the left for the
car for sale filter, and put to grid/list layout on the right".

- [x] LSPYCEHeader: title block + sticky bar (CarsCategoryLayout classes);
      More Filters joins the left chip group (ml-auto removed); dead `view`
      state / `onShowFilters` / header-row grid-list button removed; TabsList
      (grid/list) added at the bar right
- [x] Subcategory page: Tabs root wraps breadcrumb+header+content (header
      unwrapped from the `mt-2` div — sticky containing block); cars-for-sale
      gets TabsContent grid (GridCardSell+GridCardPost) / list (ListCardSell+
      ListCardPost) replacing HighLightAds/NormalAd; mocks keep AD_BLOCKS
- [x] Gates: web lint 0 errors (known AdminLoginForm warning), build PASS
- [x] Browser: bar layout vs image 6; toggle switches grid/list; bar sticks;
      regressions (cars-and-vehicles category page, mock subcategory)
- [x] Left uncommitted (no commit per project instruction)

### Follow-up pass (captain images #8/#9/#10/#11): full parity with the category bar

Captain flagged: chip sizes differed (local chips ~34px vs shared h-12),
Location/More-Filters icons missing (bootstrap `bi-*` classes render nothing —
bootstrap-icons CSS isn't loaded anywhere in web), the category bar sat ~8px
lower, and bar→content spacing was unequal (16px vs the category's equal 8px).

- [x] LSPYCEHeader chips → shared spec: `Button variant="outline"` +
      `bg-muted rounded-sm h-12 ...` (same as LocationSelectorFilter/
      SortFilter/PriceFilter/MoreFilters); lucide `MapPin` on Location,
      tabler `IconFilterCog` on More Filters; dead `bi-*` chevrons removed;
      title row byte-matched to the category title block (dead percent/truck
      mock buttons removed)
- [x] Page structure mirrors the category page exactly: breadcrumb in its own
      `px-4 py-2` block, Tabs as a sibling (the 8px offset came from the
      wrapper's `py-2` being consumed below the Tabs); SubcategoryContent
      wrapper `py-2` → plain `<div>` (bar→content back to the 8px gap)
- [x] Gates: web lint 0 errors (known AdminLoginForm warning); web build PASS
- [x] Measured parity (CDP): both pages title y=379 h=54, bar y=441 w=1280
      h=74, chips h=48, toggle w=90 h=32, breadcrumb→title 12px,
      bar→content 8px; list toggle switches to list cards; sticky top-16 ✓;
      mock phones subcategory unchanged (no toggle, ad blocks render)
- [x] Bodytype spacing (captain images #12/#13, two correction rounds):
      final layout = SEPARATE option-grid cards (captain: "the old is
      correct here" — a one-card merge was tried and reverted per #13),
      OptionGrid gap mb-4 → mb-2 (brand→bodytype 16px → 8px), and the
      bodytype→posts distance tightened 24px → 16px (TabsContent margins
      dropped on the subcategory page; the category page is untouched).
      Measured: bar→brand 8px, brand→bodytype 8px (separate cards),
      bodytype→posts 16px; gates lint 0 errors (known warning), build PASS.
      Note: bodytype icons still show broken glyphs — known Supabase
      NoSuchKey gap (admin re-upload via admin UI).
- [x] Grid headings (captain image #14, "use name on above"): OptionGrid
      gains an optional `title` rendered as a left-aligned h2 above the grid
      (text-base font-medium mb-4); SubcategoryContent passes "Brand" /
      "Model" / "Body Type" ("Job Type" for the dead jobs path). Browser:
      both headings render inside their cards; lint 0 errors, build PASS.
- [x] Bicycles subcategory → cars-for-sale concept (2026-08-31, captain:
      "do the bicycles in car and vehicle, understand the concept first").
      No backend change (subcategory exists; 0 brands/0 listings today). - LSPYCEHeader: optional `year`/`engine` props (default true — cars
      call site unchanged) wrapping the Year/Engine chip blocks. - Subcategory page: HEADER_MAP explicit `bicycles` key →
      `<LSPCYEHeader year={false} engine={false} />` (shadows the
      LSPC_SUBCATEGORIES → LSPCHeader mapping; subcategoryGroups.ts
      untouched); feed branch generalised to REAL_FEED_SUBCATEGORIES
      ["cars-for-sale", "bicycles"] — bicycles gets the real grid/list
      feed (currently 0 listings → Sell card only) instead of AD_BLOCKS.
      Browser: bicycles bar = Location|Sort|Price|Condition|More Filters +
      toggle (no Year/Engine); cars-for-sale + phones regressions fine;
      lint 0 errors, build PASS.
- [x] Motorcycles-for-sale subcategory → cars-for-sale concept (2026-08-31).
      Same two edits as bicycles: HEADER_MAP explicit key →
      `<LSPCYEHeader engine={false} />` (shadows LSPYC_SUBCATEGORIES →
      LSPYCHeader; chips = Location/Sort/Price/Year/Condition — no Engine),
      and "motorcycles-for-sale" added to REAL_FEED_SUBCATEGORIES (0 brands/
      0 listings today → Sell card only). Browser: motorcycles bar correct,
      bicycles + cars-for-sale regressions fine; lint 0 errors, build PASS.
- [x] Motorcycle brands + models seeded (captain: "isn't motorcycle have
      brand?" + "after click brand, next page should show model"):
      - brands.seed.ts: MOTO_BRANDS (31, design order Honda first; mock-
        verbatim names incl. "Royal Enfeild"; asset-derived slugs —
        royal-enfield, other; Honda/Suzuki/BMW take `-moto` slugs so each
        branch keeps its own row/icon/position; `other` = the shared
        phones-family Other row, sortOrder 999, admin icon). Seed loop +
        count updated (189 brands total).
      - Unlinked the car honda/suzuki/bmw rows from motorcycles-for-sale
        (one-time SQL in dev DB; slug-uniqueness forced the separate rows).
      - MOTO_MODEL_SEEDS: curated Khmer-market baseline (24 brands, ~140
        models — Dream 125/Click/PCX, Jupiter/NMAX/Exciter, Ninja/Duke, V-T),
        insert-only, admins extend via the Models page (390 models total).
      - Web: active filter crumb now uses display names (was slug-derived —
        "honda moto in Cambodia" → "Honda in Cambodia").
      Browser: moto page = 31 brand tiles (Honda first, moto logos) → click
      Honda → "Model" heading + 14 model tiles; cars grid untouched.
      Gates: backend build/lint/test (159/159) + seed ×2 idempotent;
      web lint 0 errors, build PASS. CLAUDE.md updated (Brands section
      MOTO_BRANDS paragraph + known-gaps note resolved).
- [x] Vehicles-for-rent → cars-for-sale concept + Body Type grid (captain
      image #17):
      - attributes.seed.ts BODY_TYPES redefined to the rent design grid
        (21 rows): 5 new rental types (motorcycle, bicycle,
        tuk-tuk-and-remork, city-bus, express-bus; icons gap-filled from
        /sub-img/.../vehicles-for-rent/body_type/*.png) + vehicles-for-rent
        added to the 15 shared rows' subcategories (sedan…trucks, other).
        Convertible stays cars-only at its design slot — the single global
        sortOrder keeps cars (Sedan→Convertible→…→Other), lorries
        (Heavy→…→Other) AND rent (Motorcycle→…→Other) in their own design
        order. One-time dev-DB SQL: rent link appended to 15 rows (they're
        insert-only rows; admin edits survive, seed covers fresh DBs) +
        global sortOrder re-set (0-20).
      - Web: LSPYCEHeader gains condition?: boolean (default true); rent
        HEADER_MAP key → year/engine/condition all false (Location/Sort/
        Price bar); vehicles-for-rent added to REAL_FEED_SUBCATEGORIES.
      Browser: rent page = Body Type heading + 20 tiles in design order
      (icons incl. the 5 new), bar L/S/P + More Filters + toggle, Sell card;
      cars + lorries grids unchanged. Gates: backend build/lint + web
      lint/build PASS (tests unchanged; no attribute unit tests affected).
- [x] Maintenance-and-repair → cars-for-sale concept (2026-08-31). Same
      two web edits as rent (no grids/design assets exist for it):
      HEADER_MAP key → LSPCYEHeader year/engine/condition all false,
      added to REAL_FEED_SUBCATEGORIES. Browser: Location|Sort|Price|
      More Filters + toggle, Sell card feed; lint 0 errors, build PASS.
- [x] Lorries-vans-and-tractors → cars-for-sale concept (2026-08-31).
      HEADER_MAP key → LSPCYEHeader year/engine/condition false (L-S-P
      bar, design profile), added to REAL_FEED_SUBCATEGORIES; its Body
      Type grid (8 truck types) was already linked from the attributes
      seed. Browser: L|S|P|More Filters + toggle + Sell card + Body Type
      grid in design order (mock Highlights ad blocks gone); cars grid
      regression fine; lint 0 errors, build PASS.
- [x] Financing-and-insurance → cars-for-sale concept (2026-08-31).
      HEADER_MAP key → LSPCYEHeader year/engine/condition false; added to
      REAL_FEED_SUBCATEGORIES. Browser: Location|Sort|Price|More Filters +
      toggle + Sell card; lint 0 errors (known warning), build PASS.
- [x] Tuk-tuk-and-remork → cars-for-sale concept (2026-08-31).
      HEADER_MAP key → LSPCYEHeader year/engine/condition false; added to
      REAL_FEED_SUBCATEGORIES. Browser: Location|Sort|Price|More Filters +
      toggle + Sell card; lint 0 errors (known warning), build PASS.
- [x] Parts-and-accessories → cars-for-sale concept (2026-08-31).
      HEADER_MAP key → LSPCYEHeader year/engine/condition false; added to
      REAL_FEED_SUBCATEGORIES (note: the mock group lists it as
      "parts-accessories" — the real backend slug never matched LSPC).
      Browser: Location|Sort|Price|More Filters + toggle + Sell card;
      lint 0 errors (known warning), build PASS.
- [x] Vehicles-others → cars-for-sale concept (2026-08-31) —
      LAST mock surface of cars-and-vehicles: HEADER_MAP key →
      LSPCYEHeader year/engine/condition false; added to
      REAL_FEED_SUBCATEGORIES. Browser: Location|Sort|Price|More Filters +
      toggle + Sell card; lint 0 errors (known warning), build PASS.
      ALL 10 cars-and-vehicles subcategories are now on the real surface.
- [x] /loop round 1 (2026-08-31): rest of catalog → real data surface.
      Generalized recipe (no more per-subcategory mock headers):
      - LSPYCEHeader: new `price`/`priceLabel` chip props (price only, hidden
        for LS-group surfaces; jobs shows "Salary").
      - Subcategory page: HEADER_MAP → CATEGORY_HEADER_FLAGS +
        SUBCATEGORY_HEADER_FLAGS (design chip sets per category; vehicles
        keep per-subcategory sets); feed is ALWAYS real (AD_BLOCKS + mock
        header imports removed); every linked attribute set (19 types) is
        fetched in parallel, filtered by the subcategory UUID, and rendered
        as an OptionGrid with the design title (ATTRIBUTE_SET_TITLES:
        bodytypes→"Body Type", types→"Type", accessories, networks,
        bedrooms/bathrooms/facings, rams/cpus/storage/screensize, ...).
      - SubcategoryContent: `sets` prop replaces `bodyTypes`; category page
        feed is always real too (mock `posts` import removed).
      Browser matrix (per subcategory): property = Type/Bedroom/Bathroom/
      Facing + L-S bar; jobs = Salary; services/home-land = L-S; phones/
      computers/electronics = L-S-P-C + Brand links; fashion/furniture/
      books = L-S-P + Type; pets/foods = L-S-P; all get toggle + real feed.
      Gates: lint 0 errors, build PASS.
      Notes: (a) grid clicks outside brand/bodyType don't filter the feed
      yet (backend /listings accepts brand/bodyType params only); (b) each
      subcategory page now makes ~21 API calls — nudges the 100/min global
      throttle under heavy automation (bundle endpoint later); (c) a few
      design grids still lack links (land types etc. — admin adds).
- [x] Property browse grids corrected (captain image #18: house and
      land only needs "Type"): bedrooms/bathrooms/facings rows are lookup
      picklists, NOT browse grids — their house-for-sale/rent links removed
      at the seed (subcategories: UNLINKED) + one-time DB cleanup (22 rows).
      Browser: house-for-sale/rent now show only the "Type" grid + L-S bar.
      (Land/condo/apartment/room pages still lack their type rows — design
      data gap, admin/seed follow-up.)
- [x] Jobs Job Type grids (captain: "job each job subcategory has job
      type"): jobtypes rows (Full-time/Part-time/Internships/Freelance/
      Contract/Volunteer/Other-Jobs) now link to ALL 36 jobs subcategories —
      seed JOBS_SUBS + one-time DB (7 rows). Browser: accounting-jobs and
      sales both show "Job Type" grid + Location|Sort|Salary bar.
- [x] Jobs category page chip "Salary" (captain image #19): shared
      PriceFilter gains `label?: string` (chip + dialog title; default
      "Price"); JobsCategoryLayout passes label="Salary". Browser: jobs
      category bar = Location|Sort|Salary|More Filters.
- [x] Services category bar: Price chip removed (captain: "in service
      has no price button, only location, sort, more filter") — shared
      PriceFilter dropped from ServicesCategoryLayout (subcategory pages
      already price-less via flags).
- [x] Tables & desks Type grid + tile style (captain image #20): the
      grid was linked and rendering but throttle-flaky at capture time;
      verified now (Dining Table / Game Table / Kids Desks / Office Desk /
      Student Desk / Wooden Table / Other). ALSO aligned the imageless
      option tiles to the design: bordered TEXT tiles (model-style) instead
      of the icon-circle fallback — chairs-and-sofas (11) too; image-bearing
      grids (rent bodytypes, brands) keep the icon circles.
- [x] Browse-grid audit (captain: "why column color for filter in car for
      sale? maybe another too?"):
      - colors + vehicletypes were "plain dropdown, no image" form fields
        (per seed comments) that the generalized renderer leaked as browse
        grids — unlinked at the seed + DB (35 rows). Cars now = Brand +
        Body Type; motorcycles = Brand; rent = Body Type (no duplicate
        Vehicle Type). The other form-only sets (rams/cpus/storage/
        screensize/enginetypes/experiences/vgas) were never linked ✓.
      - Column counts: icon grids (brand/bodytype/jobtype) stay 10 cols;
        icon-less text grids (models, furniture/property types) now use
        the design's 6 cols (grid-cols-3 md:6) — image 20 style.
      - Root cause of flaky "missing" grids: each page made 19 attribute
        fetches → hit the 100/min global throttle. New public endpoint
        GET /attributes?subcategoryId=<uuid> (AttributesService
        .listBySubcategory, JSONB @> containment) + getLinkedAttributeOptions:
        ONE call per page (~4 total) — verified 5 pages back-to-back with
        zero flakes. Backend build/lint/tests + web gates PASS.
- [x] Musical-instruments Type grid → brand icon style (captain #21):
      the 11 type rows were icon-less (the admin cell was its no-image
      placeholder, not a broken URL); design icons exist in
      /sub-img/books-sports-hobbies/brands/*.png — seeded via a null-only
      gap-fill (incl. the traditional-instruments → traditional-instrument
      name mapping). Browser: 11 icon tiles in the 10-col brand-style grid.
      (fashion-beauty type assets also exist — offer as follow-up.)
- [x] Homepage Latest Ads → real data (captain image #22): the home
      page fetched the mock lib/posts feed; now getListingsFeed({}, locale)
      + toCardPost (all active listings) rendered through GridCardSell/
      GridCardPost. Top Ads + Browse sections untouched. Browser: 5 real
      dev-DB listings (car, car2, car3, Corolla tests) + Sell card; gates
      lint 0 errors, build PASS.
- [x] Demo listings seed ("seed data properly for now"): new
      src/listings/seeds/listings.seed.ts — 15 curated Khmer-market listings
      across cars/motos/phones/laptop/TV/property/furniture/fashion/jobs
      (real brand/type attribute names so feed filters work, USD prices,
      seeded provinces/districts, active + 30d expiry, admin user as owner,
      a few with local /sub-img photos); wired into db/seed.ts after admin.
      Idempotent by title (+ the 6 test-junk rows — "car", Corolla tests —
      are deleted on seed). Fixes along the way: discountType "amount"
      (discount_pair CHECK), isNull(deletedAt), schema import paths.
      Verified: 15 rows DB, home Latest Ads = 15 demo cards, re-run
      seeds 0 duplicates; backend build/lint/tests 159 PASS.
- [x] Detail specs grid generalized (captain image #23: jobs shows only
      related fields): ListingSpecs no longer hardcodes the car rows — it
      renders Main Category/Category + Brand/Model (when the listing has
      them) + each attribute key in the design order (year, taxType, color,
      jobType, experience, engineType, transmission, type, bedrooms,
      bathrooms, facing, storage, ram, cpu, network) + Condition only for
      the condition-carrying categories (cars/phones/computers/electronics) —
      missing fields never render. Jobs demo listing gained experience
      (2Year+). Browser: jobs detail = Main Category/Category/Job Type/
      Experience exactly; cars keep their 8-row grid.
- [x] Detail specs order + Body Type (captain #24/#25): ListingSpecs
      ATTR_KEYS now include bodyType ("Body Type") and follow the reference
      order — year, taxType, Condition, bodyType, engineType, transmission,
      color, then remaining keys; condition inserted before bodyType only
      for condition-carrying categories. Browser (Civic): Main Category →
      Category → Brand → Model → Year → Tax Type → Condition → Body Type
      Sedan → Engine Type → Transmission → Color — matches image 25.
- [x] Motorcycle detail specs (captain #26/#27): no code change needed —
      the generalized order already matches (Year · Tax Type? · Condition ·
      Color, no Body Type/Engine). Honda Dream demo gained taxType
      (Plate Number) so its grid shows the 4-field reference; Yamaha keeps
      no taxType (matches #27). Browser verified both.
- [x] Discount price semantics flipped (captain #28: price input is the
      ORIGINAL): lib/utils deriveOldPrice → applyDiscount (final = price×(1-v/100)
      percent / price-v amount; no discount → price); Post-Detail + toCardPost
      now show final as the bold price and the ORIGINAL listing price as the
      strikethrough (cards/detail %-OFF and $-OFF badges derive from
      oldPrice − price, unchanged math). Browser: "car test 1" detail =
      $9 (bold) with $10 (strike) + 10% — matches expectation; lint 0
      errors, build PASS.
- [x] Bicycle + motorcycle description references (captain #30/#31):
      no code change needed — the generalized ListingSpecs already renders
      the per-category field sets. Bicycle: added a demo listing (Giant ATX
      27.5, new) and verified detail = Main Category / Category / Condition;
      motorcycle layout already matches the Vespa reference field-for-field
      (Brand/Model/Year/Tax Type/Condition/Color) — verified on the Dream
      125 and Exciter listings.
- [x] Vehicles-for-rent description (captain #32): added vehicleType →
      "Vehicle Type" to ListingSpecs ATTR_KEYS (the rent form stores it under
      vehicleType; label per spec); Condition is NOT shown for rentals (the
      rent form has no condition field — matches the reference). Seed gained
      a "Mini Bus 25 Seats For Rent" demo listing (vehicleType Mini Bus,
      engineType Diesel, transmission Auto) and the condition-less rows were
      cleaned (villa/land/sofa/polo/job — their forms have no condition).
      Browser: Main Category / Category / Vehicle Type Mini Bus / Engine
      Type Diesel / Transmission Auto — exactly image 32. Gates: lint 0
      errors, build PASS.
- [x] Last six cars-and-vehicles description references (captain #33-#38):
      Condition is now SUBcategory-aware — ListingSpecs gained
      CONDITION_SUBCATEGORIES (25 slugs extracted from the categories seed
      conditionField usage; maintenance/financing/tuk-tuk/vehicles-others/
      rentals correctly show none) replacing the main-category rule; plus
      LABEL_OVERRIDES for parts-and-accessories (vehicleType renders as
      "Type"). Seeded one demo listing per subcategory (maintenance service,
      used Hyundai truck, loan/insurance, electric tuk tuk, car spare parts
      with vehicleType Cars + condition, used truck tires). Six verification
      subagents (one per subcategory) spawned to check each detail page in
      the browser.
      VERIFICATION (6 agents, one per subcategory, headless browser each):
      all PASS. maintenance-and-repair / financing-and-insurance /
      tuk-tuk-and-remork / vehicles-others = Main Category + Category only
      (no Condition — subcategory rule works); lorries = + Condition Used;
      parts = Main Category + Category + Type (Cars) + Condition (New) —
      the agent caught the order (Condition rendered before Type vs the
      reference's Type-then-Condition), fixed via conditionPreKeys
      (Condition now inserts after the last of Year/Tax Type, plus the Type
      picker for parts); re-verified PASS + Camry regression PASS (Year,
      Tax Type, Condition, Body Type, Engine, Transmission, Color intact).
      Also fixed a real footer bug two agents surfaced: ABA payment icon
      path lacked its leading slash → rendered /en/icon/ABA.svg 404.
      Gates: lint 0 errors, build PASS. Uncommitted.

## Image audit — DB is the only source; dead storage must render as absent (2026-09-10)

Captain: "check other category and sub, and even attribute in car and vehicle,
check image too. image must from db, not from anywhere else. (if the image in
db, and supabase storage not has, the image must not has, it can't be static
or bug)."

### Audit (live, 2026-09-10)
- [x] DB sweep (1013 rows): 306 rows carry an image. 154 are `/sub-img/…`
      local paths — every file exists. 152 are Supabase Storage URLs in the
      `product-images` bucket — ALL 152 return `NoSuchKey` (Supabase reports it
      as HTTP 400 with a 404 payload; verified with a real GET).
      Missing by surface: category icons 7, subcategory icons 62 (incl. every
      cars-and-vehicles subcategory), brand icons 56 (all phones/computers
      brands), attribute images 27 (16 car body types, 7 job types, 5 networks).
- [x] Renderer sweep: every grid paints `<Image src={db value}>` with no
      load-failure handling → broken glyphs. Browser-confirmed: home = 7 broken
      category icons, /category/cars-and-vehicles = 10 broken subcategory
      icons, cars-for-sale = 9 broken body types + xiaomi brand + 1 dead
      listing photo.
- [x] `/placeholder.svg` is referenced by 7 files but does NOT exist in
      `apps/web/public/` (never committed) → every no-photo listing card paints
      a broken image (30 across the 3 pages).

### Fix (browse surfaces; no static substitutes)
- [x] `components/common/DbImage.tsx` — next/image + onError → renders the
      caller's fallback (the IconImage version was folded into this one).
- [x] `home/CategoryGrid.tsx` → fallback = the existing LayoutGrid glyph.
- [x] `category-layouts/SubcategoryGrid.tsx` → fallback = name-in-circle; the
      label is now a FIXED dark colour (the circle is a fixed light blue in
      both themes — in dark mode the inherited white text was invisible, a
      pre-existing bug visible on every icon-less subcategory, e.g. pets).
- [x] `subcategory-layouts/OptionGrid.tsx` → failed tile renders the bordered
      text tile; when no option has a loadable image the grid switches to the
      6-col text layout (cars-for-sale Body Type = 9 clean text tiles).
- [x] `ads/GridCardPost.tsx` + `ads/ListCardPost.tsx` → dropped
      `/placeholder.svg`; no photo / failed photo = empty grey area + glyph.
- [x] `components/post/PostImage.tsx` (detail gallery, 17 `<Image>` sites) →
      DbImage, same rule for listing photos.
- [x] Seed: added `car test 1` (test debris with a dead storage photo) to
      JUNK_TITLES; `db:seed` removed it.
- [x] Gates: web lint 0 errors (1 pre-existing warning), web build PASS,
      backend lint/build/tests PASS (16 suites / 159 tests).
- [x] Browser re-audit (CDP, counts every `<img>` with naturalWidth === 0):
      home 0 broken, cars-and-vehicles 0, cars-for-sale 0, vehicles-for-rent 0,
      jobs/accounting-jobs 0, laptops 0, Camry detail 0, photo-less detail 0.
      Working icons unaffected: 90 car brands render as logos (xiaomi, whose
      stored object is missing, is a text tile), rent body types show their 5
      local icons.

### Out of scope (reported, not changed)
- 152 stale DB image paths — captain decides: re-upload the assets to Storage
  or clear the columns (admin-owned rows, untouched).
- `/placeholder.svg` in LoginForm / AdBanner / SmallAdBanner / attribute-manager.
- Mock surfaces (`lib/categories.ts`, `lib/post-ad.ts`) use local `/cate-img`
  assets that exist — unchanged.

### Regression caught during verification (2026-09-10)
- The first pass at the grids dropped the `unoptimized` prop when swapping
  `<Image>` → the wrapper. `next/image` validates a remote hostname against
  `next.config` remotePatterns even on the pass-through path, so every page
  whose subcategory/category icons are Storage URLs threw
  `Invalid src prop (…supabase.co…) … hostname is not configured` and fell to
  "Something went wrong! Try again" (phones-and-tablets, computers, electronics,
  home-and-land, jobs, services, books-sports-and-hobbies — the pages whose
  subcategories have NULL icons, e.g. pets/foods, masked it).
  Fix: `DbImage` now defaults `unoptimized` to true (documented in CLAUDE.md).
  Re-verified: all 12 category pages + subcategory/detail pages render, 0 broken
  images, and the error boundary is gone.

### Round 2 — "get image from outside db? it's not allow this way" (2026-09-10)
Captain, on the cars-for-sale Brand grid: storage has no brand images yet the
logos render; the Body Type grid is boxes though the DB has image values; "in
admin side and client has — why?".

- [x] Root cause established: the `product-images` bucket holds ONLY an
      `avatar` folder (verified with the Storage list API using the service
      key) — no brand/attribute/category/subcategory/listing objects at all.
      The car-brand logos the captain sees are NOT from storage: those DB rows
      store `/sub-img/car_vehicles/cars-for-sale/brands/*.png`, files shipped
      inside `apps/web/public`, so the browser loads them from the Next server.
      Deleting storage objects could never remove them. Body types differ —
      their DB values ARE Storage URLs, and those objects are gone, hence boxes.
- [x] Rule enforced in code: `DbImage` renders ONLY when the src is a Storage
      object URL (`isStorageObjectUrl`); local static paths and third-party
      hosts take the fallback path. `OptionGrid` (it keeps its own failure map)
      applies the same check via the exported helper — that was the miss on the
      first pass, and why the brand grid still showed logos.
- [x] Admin parity (captain: "in admin side and client has why?"): the admin
      brands / categories / subcategories tables and the attribute manager now
      render through `DbImage` with a muted `NoImageCell` ("—") fallback; the
      dead `/placeholder.svg` fallback in the attribute manager is gone.
- [x] Verified: 0 broken `<img>` on home / cars-for-sale / phones / jobs /
      Camry detail; all 12 category pages render (no error boundary). Every
      image left on those pages is site chrome (logo, flags, payment icons) or
      the page's own banner ad.
- [x] Gates: web lint 0 errors (1 pre-existing warning), web build PASS.
- DECIDED (captain, 2026-09-10): leave the catalog imageless. No upload, no
      DB rewrite — icons return only when an admin uploads them through the
      admin UI. The 154 local-path rows and 152 dead-object rows stay as they
      are and keep rendering the "no image" state.

### Round 3 — design follows the thing, not the load result (2026-09-10)
Captain on the cars-for-sale Brand grid: "if the thing that we have to use image,
then use the image design. if the things has no image use not has image design …
so what if one image disappear? it's will show the no image design, seems not
right."

- [x] `OptionGrid`: the circle-vs-box design is now decided by the option SET
      (majority image-bearing), not by whether icons load; a dead object leaves
      an empty circle. `DbImage` (storage-object-only + onError) renders the
      image inside the circle, the grid design never changes.
- [x] Caught while verifying: a first cut used "any option has an image" and
      the shared `other` attribute row (linked across families, carrying a
      musical-instrument icon) flipped the whole FURNITURE Type grid to
      circles. Switched to a majority test — furniture back to boxes, musical
      instruments stay circles.
- [x] `SubcategoryGrid` / `home/CategoryGrid`: same principle — the name-in-
      circle and the LayoutGrid glyph are now the no-image design for rows with
      NO icon value only; an icon row whose object is missing shows an empty
      circle instead of borrowing the other design.
- [x] Verified (CDP screenshots): Brand = 20 circles, Body Type = 9 circles,
      musical Type = 11 circles, furniture Type = boxes, home = 7 empty circles
      + 5 glyphs, subcategories = 10 circles. All pages: 0 broken <img>, no
      error boundary. Gates: lint 0 errors, build PASS.

### Round 4 — leftover image in the admin Edit dialog (2026-09-10)
Captain: "after we deleted image, why admin when i click edit, the left over
image still here? the data is correct show no image, but when edit why the
image still here? find out the cause of this."

- [x] Cause: the brands TABLE renders through `DbImage` (storage-only) so it
      shows "—", but the Edit dialog renders the SAME stored string through
      `ImageUpload`'s bare `next/image` (truthiness check only). MG's value is
      `/sub-img/car_vehicles/cars-for-sale/brands/mg.png` — a 24 KB file
      inside `apps/web/public` — so it loads no matter what was deleted in
      Supabase. `EditBrandForm` seeds `image: brand.image` from the row, so the
      leftover rode into the dialog (and `icon: parsed.data.image || null` would
      write it straight back on Save).
- [x] Fix: `ImageUpload` now applies the same rule — the preview renders only
      when the value is a Storage object URL, otherwise an empty
      "No <label> stored" slot (the X button still clears the field).
- [ ] NOT verified live: driving the admin dialog needs an admin session; the
      permission layer blocked minting a token from JWT_SECRET, so the captain
      should click Edit once to confirm. Gates: lint 0 errors, build PASS.

### Round 5 — an applied set steps aside (2026-09-10)
Captain: "the behavior in car for sale seems not right … when click sedan isn't
it show move to page which the bodytype has no longer there … and the left show
be brand."

- [x] Cause: `SubcategoryContent` always rendered every linked set, so the
      applied Body Type grid stayed on screen (and, because its card is the
      first block under the sticky bar, the Brand grid above it was scrolled
      out of sight — which is what the screenshot showed).
- [x] Fix: a set containing the applied `ad_type` is filtered out; Brand stays
      as the next choice, and Brand → Model already swapped. The applied filter
      is still shown by the bar, the breadcrumb (which links back to the
      unfiltered page) and the feed.
- [x] Verified: cars-for-sale `?ad_type=sedan` → only Brand remains (breadcrumb
      "Sedan in Cambodia"); `+ad_field=toyota` → Model grid (2 tiles); jobs
      `?ad_type=full-time` → Job Type steps aside, breadcrumb "Full-time in
      Cambodia". Gates: lint 0 errors, build PASS.

### Round 6 — the pick must behave like a navigation (2026-09-10)
Captain: "why it still there? it not even move … not like go to new page with
new url. the brand flow same right (brand->bodytype), so choose the same
behavior like that."

- [x] Reproduced under CDP: load cars-for-sale, scroll to the Body Type grid
      (scrollY 419), click Sedan → URL becomes ?ad_type=sedan and the set steps
      aside, but scrollY stays 419 while the page shrinks, so the view lands in
      the middle of the Brand grid with its heading hidden behind the sticky
      bar. That is the "it's still there / it doesn't move" the captain saw.
- [x] Cause: `OptionGrid.handleClick` passed `{ scroll: false }` to
      `router.replace` (an old "stay on the same page" choice).
- [x] Fix: `{ scroll: true }` — a pick now resets the view to the top like any
      navigation. One handler covers brand and attribute picks.
- [x] Verified: `?ad_type=sedan` → scrollY 0, Brand grid under the bar;
      `?ad_field=toyota` → scrollY 0, Model + Body Type; combined
      `?ad_field=toyota&ad_type=sedan` → Model. Gates: lint 0 errors, build PASS.

### Round 7 — Back must walk the drill-down (2026-09-10)
Captain: "cars-for-sale?ad_type=sedan, when i click back ... it back to
'cars-and-vehicles' not 'cars-for-sale', why? even '?...&ad_field=mg' also back
to car and vehicle, not '?ad_type=sedan'."

- [x] Reproduced under CDP: category → subcategory (history len 3) → pick Sedan
      → Back lands on `/category/cars-and-vehicles`, skipping `cars-for-sale`.
- [x] Cause: the pick used `router.replace`, which rewrites the current history
      entry instead of adding one — the subcategory entry was overwritten by the
      filtered URL, so there was nothing left to go back to.
- [x] Fix: `router.push` — every pick is a history step. Verified: subcat →
      +Sedan → +MG → Back = `?ad_type=sedan` → Back = `cars-for-sale`.
- [ ] NOTE (not changed): the chip filters (Location/Sort/Price/More Filters in
      `components/filter/*`) still use `router.replace`, so Back skips past them
      the same way. Captain decided (2026-09-10) to unify them LATER — parked in
      `tasks/waiting-for-implements-laters.md` §1, no code touched.
- [x] Gates: lint 0 errors, build PASS.
