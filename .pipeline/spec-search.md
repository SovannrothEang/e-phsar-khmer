# Search page (`/search?q=…`) + real listing filters

## Context

Users cannot search ads today. The header search bar is a mock, and every filter
chip on the browse pages writes URL params that nothing reads. The backend feed
(`GET /api/v1/listings`) already has a `q` param, but it matches the title only.
Nothing indexes it, the input goes unescaped into the LIKE pattern, and no web
caller sends it.

This ship adds:

1. a real **`/[locale]/search`** results page, reached from the header search bar;
2. the **missing backend filters and sorts** (sort, date posted, commune, free
   delivery, final-price range);
3. **one shared URL-params → feed-query parser**, so the filter bar on the
   category and subcategory pages starts working too.

Postgres only. No search engine, per CLAUDE.md rule 6.

## Current state (verified 2026-09-30)

| Piece | File | Today |
|---|---|---|
| Header search bar | `apps/web/components/web/SearchBar.tsx` | Category dropdown comes from the mock `lib/categories`. The input has no state, no submit handler and no route. |
| Backend keyword | `apps/backend/src/listings/listings.service.ts:235` (feed), `:326` (`/me/all`) | `ilike(title, '%'+q+'%')`: title only, `%`/`_` not escaped, no index (seq scan). |
| Backend sort | same, `findFeed` | Fixed `created_at DESC, id DESC`. No `sort` param. |
| Backend location | `resolveQueryFilters` (`:404`) | `provinceSlug`, `districtSlug`. No commune. |
| Backend price | `findFeed` | `minPrice`/`maxPrice` compare the **original** `price`. Cards show the **discounted** price. |
| Feed helper | `apps/web/lib/api/categories.ts:282` `getListingsFeed` | Forwards category/subcategory/brand/bodyType/attr only. Ignores `nextCursor`. |
| Filter bar | `components/filter/{Sort,Price,LocationSelector,More}Filter(s).tsx` | Writes `sort`, `min_ad_price`, `max_ad_price`, `loc_pro/dis/com`, `keyword`, `date` to the URL. **No page forwards them.** |
| Location filter data | `LocationSelectorFilter.tsx:12` | Reads the mock `lib/location.ts` (the 2019, ~21 %-complete extract), and its URL values are mock `proId`s. Those can never match a real listing. |
| Subcategory chips | `components/subcategory-layouts/LSPYCEHeader.tsx` | Year/Engine/Condition chips are local `useState`: not in the URL, not wired. |
| All Ads page | `app/[locale]/(user)/all-ads` + `AllAdsHeader.tsx` | Filters the mock `lib/posts` in the browser. |
| Views | `listings.views_count` | Nothing increments it, so the "Most Hit" sort has no data. |

## Decisions

### D1. Route and URL contract

`/[locale]/search`: an RSC page under `(user)`, public, `robots: noindex`.

The search page, category page, subcategory page and all-ads page share **one
URL vocabulary**. Existing param names are kept where they exist, so links that
already work keep working.

| URL param | Meaning | Backend param |
|---|---|---|
| `q` | Keyword. Trimmed, max 100 chars; empty means browse all. | `q` |
| `category` | Category slug (search page only; the category pages take it from the path). | `categorySlug` |
| `sub` | Subcategory slug (search page only). | `subcategorySlug` |
| `loc_pro` / `loc_dis` / `loc_com` | **Real slugs** (value change, see D6). | `provinceSlug` / `districtSlug` / `communeSlug` |
| `min_ad_price` / `max_ad_price` | Final-price range, USD. | `minPrice` / `maxPrice` |
| `condition` | `new` \| `used` | `condition` |
| `date` | `today` \| `week` \| `month` | `postedWithin` |
| `delivery` | `1` = free delivery only | `deliveryFree=true` |
| `sort` | `latest-ads` (default) \| `price-asc` \| `price-desc` | `sort` = `newest` \| `price_asc` \| `price_desc` |

- `MoreFilters`' `KEYWORD_PARAM` changes from `"keyword"` to **`"q"`**, so there is one
  keyword param everywhere.
- The web sort values stay as they are, and one mapping in the parser translates
  them. `new-ads` is a duplicate of `latest-ads` and **is removed**. `most-hit` is
  **hidden** until views are counted (see Out of scope). An unknown or legacy
  value falls back to `latest-ads`.

### D2. Keyword matching: tokenized trigram `ILIKE`, title + description

- Split `q` on whitespace and keep at most **5 tokens**, each 1–50 chars. Every
  token must match: `AND` across tokens, and within a token
  `title ILIKE p OR description ILIKE p`.
- Escape `\`, `%` and `_` in every token (`ESCAPE '\'`) using a pure exported
  helper, `escapeLike`.
- A GIN `gin_trgm_ops` index on `title` **and** on `description` lets Postgres
  serve the leading-`%` match with a BitmapOr instead of a sequential scan.
- **Why not `tsvector` FTS:** Khmer has no word spaces, so the `simple`/`english`
  parsers split it badly. A trigram substring match handles Khmer, Latin, partial
  words ("toyo") and model numbers ("s25") the same way. Relevance ranking and
  typo tolerance (`similarity()`) are Phase 2.
- `/listings/me/all` gets the same escaped, tokenized matcher (shared private
  helper `keywordCondition(q)`), so the two call sites cannot drift.

### D3. Price filters and sorts use the final price, via a generated column

Migration adds a **stored generated column**:

```sql
effective_price numeric(14,2) GENERATED ALWAYS AS (
  CASE discount_type
    WHEN 'percent' THEN price * (1 - COALESCE(discount_value,0) / 100)
    WHEN 'amount'  THEN GREATEST(price - COALESCE(discount_value,0), 0)
    ELSE price
  END) STORED
```

- It must equal `applyDiscount` in `apps/web/lib/utils.ts`. The spec's unit test
  pins both against the same fixture table (0 %, 10 %, 100 %, amount < price,
  amount > price, null price, null discount).
- `minPrice`/`maxPrice` switch from `price` to `effective_price`. **This is a
  behaviour change**: today's filter compares the original price. Nothing on the
  web sends these params yet, so no caller breaks.
- A null price ("Negotiable") is excluded whenever a price bound is set. That
  matches `filterPostsByPrice`.
- The DTO rejects `minPrice > maxPrice` with a 400. The web parser swaps the two
  before sending.

### D4. Sort-aware keyset cursor

`sort` ∈ `newest` (default) | `price_asc` | `price_desc`.

| sort | ORDER BY |
|---|---|
| `newest` | `created_at DESC, id DESC` (unchanged) |
| `price_asc` | `effective_price ASC NULLS LAST, id DESC` |
| `price_desc` | `effective_price DESC NULLS LAST, id DESC` |

- Cursor format: base64 JSON `{ s, v, id }` (`s` = sort, `v` = the last row's
  sort value, which may be `null`, `id` = the last id).
- A cursor whose `s` differs from the request's `sort` is **ignored** (restart at
  page 1). The legacy `{createdAt, id}` cursor is still accepted for `newest`,
  so existing clients keep paging.
- Next-page predicate for the price sorts (asc shown; desc flips `>`):
  - `v` not null: `ep > v OR (ep = v AND id < cid) OR ep IS NULL`
  - `v` null (already in the null tail): `ep IS NULL AND id < cid`
- The cursor encode/decode and predicate builder live in a pure exported module,
  `listings/feed-cursor.ts`, so they can be unit-tested without a database.

### D5. New filters

| Param | Rule |
|---|---|
| `postedWithin=today\|week\|month` | `coalesce(published_at, created_at) >= X`. `today` = since 00:00 **Asia/Phnom_Penh**; `week` = now − 7 d; `month` = now − 30 d. (`published_at` first, because a draft can sit for days before it is published; `created_at` as the fallback because seeded rows skip the publish endpoint and have no `published_at` — amended in round 2, 2026-09-30.) |
| `communeSlug` | Resolved inside the district, like `districtSlug` inside the province. Ignored without `districtSlug`. An unknown slug short-circuits to `[]` (existing pattern). |
| `deliveryFree=true` | `delivery_free = true`. `false`/absent applies nothing. |
| `includeTotal=true` | Adds `meta.total` (a `count(*)` over the same WHERE, run with `Promise.all` alongside the page query). Only the search page asks for it; the other feeds don't pay for it. |
| `includeFacets=true` | Adds `meta.facets` (per-category counts, see D5a). Search page only. |

### D5a. Category facets (per-category counts)

The search page's sidebar shows how many results each category (and, once a
category is picked, each of its subcategories) holds **for the current query**.

**Semantics (standard "exclude own dimension" faceting):** facet counts use
every active filter (`q`, location, price, condition, date, delivery) **except
the category dimension itself**. So picking "Cars" does not collapse the other
categories to 0: the user still sees "Phones (12)" and can switch.

| Facet | WHERE | GROUP BY |
|---|---|---|
| `categories` | all filters **minus** `categorySlug` + `subcategorySlug` | `category_id` |
| `subcategories` (only when `categorySlug` is set) | all filters **minus** `subcategorySlug`, **plus** the category | `subcategory_id` |

Response shape (slugs only; the web already holds the localized names from
`getAllCategories`, so the listings module stays locale-free):

```jsonc
"meta": {
  "nextCursor": "…", "hasMore": true, "limit": 20,
  "total": 143,                       // includeTotal
  "facets": {                         // includeFacets
    "categories":    [{ "slug": "cars-and-vehicles", "count": 98 }, …],
    "subcategories": [{ "slug": "cars-for-sale",     "count": 71 }, …] // or omitted
  }
}
```

- Categories/subcategories with 0 matches are **omitted** by the GROUP BY. The
  web decides how to show them (D8: hidden).
- Implementation: a private `buildFeedConditions(query, { skip: ['category','sub'] })`
  so the page query, the total and both facet queries share **one** condition
  builder and can't drift. The facet queries join `categories`/`subcategories`
  for the slug. The page query, total and facets run in one `Promise.all`.
- Cursor and sort never apply to count or facet queries.
- Invariant (a unit-testable property): with no category filter,
  `sum(facets.categories.count) === total`.

### D6. The location filter moves to real data

`LocationSelectorFilter` drops `lib/location.ts` and loads its levels from the
public `GET /locations/provinces[/…/districts[/…/communes]]` endpoints, through
the existing `getLocationDistricts`/`getLocationCommunes` actions plus a
provinces action. The URL values become **slugs**. Old mock-id URLs no longer
resolve, so they show as "no location selected". Nothing real ever read them, so
nothing is lost.

`filterPostsByLocation` (mock-only) is deleted together with the All Ads mock
filtering (D8).

### D7. One parser, used by every feed page

New file `apps/web/lib/search-params.ts`:

- `parseFeedParams(searchParams): FeedQuery`. The **only** place URL params
  become backend params. It trims and caps `q`, validates enums, swaps an
  inverted price range and drops garbage.
- `getListingsFeed` in `lib/api/categories.ts` takes the widened `FeedQuery`
  (adding `q, provinceSlug, districtSlug, communeSlug, minPrice, maxPrice,
  condition, postedWithin, deliveryFree, sort, cursor, includeTotal`) and returns
  `{ items, nextCursor, total? }`.
- Callers: the new search page, the category page, the subcategory page (merging
  the parsed params with its existing brand/attr resolution), and All Ads.
  **Side effect: the filter bar on every category and subcategory page starts
  filtering for real.** That fixes the bug where the bar was UI-only.

### D8. Pages

**Header `SearchBar`**
- The category dropdown reads real categories. `NavBar` gets them from an RSC
  parent via `getAllCategories` and passes them as a prop, so no mock import
  remains. The selected entry stores `{kind: 'category'|'sub', slug, name}`.
- It is a controlled input. Enter or the search icon calls
  `router.push('/search?q=…&category=…' | '&sub=…')`.
- On `/search` the bar is pre-filled from the URL.
- Icons render through `DbImage` (per the DB-image rule). A null icon renders the
  existing glyph fallback.

**`/[locale]/search` page** (RSC)
- Layout reuses the category page's shell: a breadcrumb (Home › Search), an
  `h1` reading **Results for "q"** (or **All ads** when `q` is empty) with the
  `total`, then the sticky filter bar with Location, Sort, Price and MoreFilters.
  MoreFilters holds Condition, Date posted, Free delivery and the keyword.
- The grid/list `Tabs` reuse `GridCardPost`/`ListCardPost` via `toCardPost`,
  exactly like `AllAdsHeader`.
- **Category sidebar with counts** (`components/search/CategoryFacets.tsx`),
  fed by `meta.facets` (D5a) and the localized tree from `getAllCategories`:
  - Top row **All categories (total)**. Then each category with a non-zero count,
    as `Name (n)`, in the category `sort_order` (not by count, so the list does
    not reshuffle while the user filters).
  - The selected category is highlighted and **expands** to its subcategories
    with counts; the selected subcategory is highlighted too.
  - A click is a `Link` that sets `category` (clearing `sub`) or `sub`,
    **keeps every other param**, and drops any cursor.
  - Categories with 0 matches are hidden, but a **selected** category is always
    shown, even at 0, so the user can see and undo it.
  - Desktop (≥ `lg`): a left column beside the results. Mobile: a horizontally
    scrolling chip row above the results with the same `Name (n)` labels.
- A **category/subcategory chip row** above the results removes `category`/`sub`
  in one click.
- **Load more:** a client component `FeedResults` (shipped name) holds the cursor and
  calls a server action `loadMoreListings(query, cursor)` in
  `actions/listings.ts` that reuses `getListingsFeed`. It appends pages. A
  changed URL remounts it via `key` = the serialized query.
- **Empty state:** "No ads match "q"", a "Clear filters" link (keeps `q`) and a
  "Clear search" link.
- `generateMetadata`: title `"<q> | <site>"`, `robots: { index: false }`.

**`/[locale]/all-ads`**
- `AllAdsHeader` swaps the mock `posts` and its browser-side filter pipeline for
  the real feed through the same parser. The page is "search with no `q`", but
  it keeps its own route and banner. (A redirect to `/search` is an open
  question, O2.)

**i18n:** new strings go under a `Search` namespace in all six
`messages/*.json`: `en` values in `en`, and `en` values copied into
`km/zh/ko/id/vi` for now (next-intl throws on a missing key).

## Backend changes (files)

| File | Change |
|---|---|
| `src/listings/dto/query-listings.dto.ts` | `q` gains `@MaxLength(100)`; new `sort` (`@IsIn`), `postedWithin` (`@IsIn`), `communeSlug`, `deliveryFree` (`@Transform` 'true' → boolean), `includeTotal`. Cross-field min ≤ max check. |
| `src/listings/feed-cursor.ts` (new) | Pure: `encodeCursor`, `decodeCursor` (legacy-aware), `cursorPredicate(sort, cursor)`, `orderByFor(sort)`. |
| `src/listings/listings.service.ts` | `keywordCondition` (tokenize + `escapeLike`); `findFeed` uses the cursor module, the new filters, `effective_price` and the optional count; `findMine` uses the same `keywordCondition`; `resolveQueryFilters` resolves the commune. |
| `src/db/schema/listings.schema.ts` | `effectivePrice` via `generatedAlwaysAs`; indexes `listings_title_trgm_idx`, `listings_description_trgm_idx` (GIN `gin_trgm_ops`) and `listings_status_effective_price_idx (status, effective_price, id)`. |
| `drizzle/migrations/0031_*.sql` | `CREATE EXTENSION IF NOT EXISTS pg_trgm;`, the column, the 3 indexes. **Check the Supabase extension schema:** if `pg_trgm` lives in `extensions`, the opclass must be written as `extensions.gin_trgm_ops`. Hand-edit the generated SQL if drizzle-kit emits the bare name. |
| `src/listings/README.md` | Only if one exists. Otherwise skip (no new README in this ship). |

## Web changes (files)

| File | Change |
|---|---|
| `lib/search-params.ts` (new) | `parseFeedParams`, `FeedQuery`, sort-value mapping. |
| `lib/api/categories.ts` | Widen `getListingsFeed`; return `total`. |
| `app/[locale]/(user)/search/page.tsx` (new) | Search page (D8). |
| `components/search/FeedResults.tsx` (new; shipped name, was `SearchResultsMore`) | Grid/list views + load-more, reused by search, category, subcategory and all-ads pages. |
| `components/search/CategoryFacets.tsx` (new) | Category sidebar/chip row with counts (D5a, D8). |
| `actions/listings.ts` | `loadMoreListings`, `getLocationProvinces`. |
| `components/web/SearchBar.tsx`, `NavBar.tsx` | Real categories, controlled input, submit. |
| `components/filter/LocationSelectorFilter.tsx` | Real geo data, slug params (D6). |
| `components/filter/MoreFilters.tsx` | `KEYWORD_PARAM = "q"`; free-delivery toggle; condition select. |
| `components/filter/SortFilter.tsx` | Drop `new-ads`, hide `most-hit`. |
| `app/[locale]/(user)/category/[categorySlug]/page.tsx`, `…/[subcategorySlug]/page.tsx` | Forward `parseFeedParams(searchParams)` into the feed call. |
| `components/all-ads/AllAdsHeader.tsx` | Real feed. |
| `messages/*.json` (6) | `Search` namespace. |

## Tests / verification gate

**Backend unit tests (Jest)**
- `escapeLike`: `%`, `_`, `\`, mixed, Khmer passthrough.
- Tokenizer: whitespace collapse, 5-token cap, 50-char cap, empty → no condition.
- `feed-cursor`: round-trip per sort; the legacy cursor is accepted for `newest`;
  a sort-mismatch cursor is ignored; garbage is ignored; the null-tail predicate.
- WHERE compilation (same style as the existing `attrKey` test): each token
  arrives as a bound param with `ESCAPE`; `effective_price` is used for
  min/max; `communeSlug` without `districtSlug` is ignored.
- Facets: the category facet conditions omit `category_id`/`subcategory_id`;
  the subcategory facet includes `category_id` but omits `subcategory_id`;
  facets are absent without `includeFacets`; subcategory facets are absent
  without `categorySlug`; an unknown `categorySlug` short-circuits to
  `total: 0` with empty facets.
- `effective_price` ↔ `applyDiscount` parity table: a SQL-expression fixture
  test against the dev DB, or a documented manual query if no DB test harness
  exists.

**Gates:** `pnpm --filter backend test`, `pnpm --filter backend build`,
`pnpm --filter backend lint`, `pnpm --filter web build`, `pnpm --filter web lint`.

**Migration:** `db:migrate`; confirm with `\d listings` that the column and 3
indexes exist; `EXPLAIN` a `q=toyota` feed query and confirm it uses a
**Bitmap Index Scan on `listings_title_trgm_idx`** (on a small table the planner
may still pick a seq scan; if so, `SET enable_seqscan=off` for the check).

**Browser (CDP recipe from CLAUDE.md):**
1. Header: type "toyota" → Enter → lands on `/en/search?q=toyota`; results are all Toyota ads and the count matches.
2. Pick a category in the dropdown and search → the `category` chip shows; removing it widens the results.
3. `q=%` returns **only** listings whose text contains `%` (not everything).
4. A Khmer keyword from a seeded listing is found.
5. Price 1000–5000 on a discounted listing: the filter matches on the **shown** price.
6. Sort price ↑ / ↓: order is correct, "Negotiable" ads come last, and "Load more" produces no duplicates or gaps across pages.
7. Location province → district → commune narrows the results; the URL carries slugs.
8. The cars-for-sale filter bar: price + location now change the feed (regression of the UI-only bug).
9. Facets: with `q=toyota` the sidebar counts add up to the header total. Picking a category keeps the other categories' counts unchanged and expands the subcategory counts. Adding a price range changes every count.
10. Empty query `/search` = all ads. An impossible query shows the empty state and both clear links work.

## Out of scope (Phase 2+)

- Relevance ranking (`similarity()` / `ts_rank`), typo tolerance, highlighting.
- `GET /search/suggest` autocomplete (subcategories + brands + top titles).
- **Views counter** and the `most-hit` sort. They need a view-increment path
  (throttled per viewer) first.
- Wiring the subcategory `LSPYCEHeader` Year/Engine/Condition chips to the URL.
  Those need attribute-key resolution per subcategory.
- Multi-attribute filters driven by `field_schema` (year range, storage, bedroom…).
- Saved searches and alerts (outbox + BullMQ).
- `name_km` in the location picker (the geo endpoints still serve only `name`).
- Searching users or sellers. Chat search is impossible server-side (E2E).

## Risks

- **Keyset on a non-unique, nullable sort key** is where duplicate and skipped
  rows come from. Mitigation: the null-tail predicate plus `id` tiebreaker, and
  the unit tests in D4.
- **Generated-column drift**: if `applyDiscount` changes, the SQL won't follow.
  The parity test is the guard, and a comment in both places points at the other.
- **The `/me/all` keyword change** now also matches descriptions: slightly wider
  results in "My Ads" search. Acceptable, and noted in changes.md.
- **Trigram index write cost** on `description` (a text column of unbounded
  length). Fine at the current scale; revisit if listing inserts become hot.
- **Query cost per search page:** up to 4 queries (page + total + 2 facet
  GROUP BYs), all hitting the same trigram-filtered set. Fine at the current
  scale. If it gets hot, merge total + category facet into one query
  (`GROUP BY ROLLUP(category_id)`) before reaching for caching.
- **The location URL value change** (mock ids → slugs) silently resets old
  shared links' location filter.

## Resolved questions (2026-09-30, user)

- **O1.** Price filter uses the final price: **yes** (D3).
- **O2.** `/all-ads` keeps its own route and banner: **yes**; no redirect.
- **O3.** Description is in keyword search v1: **yes** (D2).
- **O4.** Category facet with per-category counts: **yes**, changed from the
  draft's "no". Counts for each category, and for the subcategories of the
  selected category (D5a, D8).
- **O5.** "Most Hit" is **hidden** until views are counted.

## Implementation note (2026-09-30)

Shipped as specified, with two additions found during implementation:
`LSPYCEHeader` (the subcategory bar) turned out to be entirely local-state mock chips,
so its Location/Sort/Price/More chips were swapped for the shared URL filters and
Condition wired to the URL; and `SearchBar` sits in a `Suspense` boundary
(it reads `useSearchParams` from a layout). Ship log: `tasks/todo.md`.
