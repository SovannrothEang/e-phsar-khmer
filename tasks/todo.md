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
