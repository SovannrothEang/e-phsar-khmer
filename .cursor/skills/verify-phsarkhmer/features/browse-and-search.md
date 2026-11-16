# Browse and search

An anonymous visitor can browse the marketplace by category, open a listing's
detail page, search from the header (the whole catalogue from the home page, or
the current category when the header sits on a category page), and see a
complete empty state when nothing matches.

## Sub-features

- `browse-home` renders the categories strip, the trending carousel and the
  latest-ads feed.
- `browse-category` lists a category's subcategories and its live ad cards.
- `browse-detail` opens one listing with its title, price, buttons and contact
  block.
- `search-match` returns ads for a keyword from the header search box.
- `search-empty` shows the no-match state and the clear options.

## How to get to it (user POV)

- Open the storefront root: `http://localhost:3001/en` (or `/` and let it
  redirect to the visitor's locale).
- Choose a category tile on the home page (`Cars and Vehicles`, …).
- Choose any ad card in a feed to open its detail page.
- Type in the header search box — placeholder "What are you looking for..."
  (three ASCII dots), accessible name `Search` — and choose the `Search` button.
- Open a search URL directly (`/en/search?q=…`). On the home page, `View All`
  opens the full feed at `/en/all-ads`; there is no "All ads" search control.

## Driving it with cdp.mjs

Preconditions:

- `scripts/doctor.sh` exits 0.
- The browser is anonymous: run `node scripts/cdp.mjs reset` first.
- Seeded listings exist (doctor reports 124 listings).
- Commands below use the default origin `http://localhost:3001`. If the
  launcher printed a different port (`VERIFY_WEB_PORT`), substitute it.

- **Home feed.** Open the storefront. Run
  `node scripts/cdp.mjs open "http://localhost:3001/en" --wait-for "main"`.
  The page title is `PhsarKhmer, Buy and Sell Everything In Cambodia`, the
  heading `Welcome to PhsarKhmer, the biggest online market in Cambodia.` is
  present, and `Browse By Category`, `Trending`, `Latest Ads` and the category
  link `Cars and Vehicles` all appear in the ARIA snapshot.
- **Category page.** Choose the cars category. Run
  `node scripts/cdp.mjs click --role link --name "Cars and Vehicles" --wait-for "main"`.
  The URL becomes `/en/category/cars-and-vehicles`, the heading reads
  `Cars and Vehicles in Cambodia`, and the subcategory links (`Cars For Sale`,
  `Bicycles`, `Motorcycles For Sale`, …) are present. Their accessible names
  are duplicated (`Cars For Sale Cars For Sale`) because the seeded icons are
  null; substring matching on `--name` still works. Count the cards with
  `node scripts/cdp.mjs eval 'document.querySelectorAll("a[href*=adid]").length'`
  — expect 20 (at least 10).
- **Listing detail.** Open the first ad card. Listing cards are image-only
  links with no accessible name, so use the selector:
  `node scripts/cdp.mjs click --selector 'a[href*="adid"]' --wait-for "main"`.
  The URL is a `…-adid-<uuid>` slug. The page exposes several `h1`s: the first
  is the brand/model (`NMAX`), the next is the full listing title (e.g.
  `Yamaha NMAX 155 2022 - Gray`), and another is the contact hint. Assert the
  full title in the `h1` list or the ARIA snapshot, not with
  `document.querySelector("h1")`. The detail price is interpolated without a
  thousands separator (`$2350`) or is `Negotiable`; feed cards render
  `$2,350`. The contact block has two phone reveal buttons whose accessible
  name is the masked number plus `Show Phone Number`
  (`+85589700XXX Show Phone Number`), plus `Save`, `Report` and two `Share`
  controls.
- **Keyword search.** Return home, type, and submit. Run
  `node scripts/cdp.mjs open "http://localhost:3001/en" --wait-for "main"`,
  `node scripts/cdp.mjs fill --role searchbox --name "Search" --value "Honda"`,
  `node scripts/cdp.mjs click --role button --name "Search"`. The URL becomes
  `/en/search?q=Honda`. The page has a bare `Search` heading and a
  `Results for “Honda”` heading; assert the latter in the heading list or the
  body text. The feed contains at least one card whose title contains `Honda`
  (seeded examples: `Honda Dream 125 2023`, `Honda Civic 2018 One Owner`), and
  the page may also show a category-count sidebar and a `Product specs` block.
- **No-match state.** Search for a value with no ads and no close matches. Run
  `node scripts/cdp.mjs open "http://localhost:3001/en/search?q=zzzznomatch" --wait-for "main"`.
  The page shows `No ads match “zzzznomatch”`, the hint
  `Try a different keyword or fewer filters.`, and the links `Clear filters`
  and `Clear search`. No ad cards are present. On a keyword-only empty search
  `Clear filters` links to the same URL (there are no filter params to drop);
  only `Clear search` leaves the empty state.
- **Proof.** Capture the populated result state and the empty state. Run
  `node scripts/cdp.mjs aria --path .cursor/skills/verify-phsarkhmer/artifacts/browse-and-search/search.aria.txt`,
  `node scripts/cdp.mjs shot --path .cursor/skills/verify-phsarkhmer/artifacts/browse-and-search/search.png --full`,
  and the same pair for the empty state and the detail page. The snapshot names
  the query heading and the matching ad; the screenshot shows the app chrome.
  Save the commands and their stdout as `commands.txt` in the same directory.

## Gotchas

- **Cards are unnamed links.** They wrap the image only; `--role link --name
"<title>"` will not find them. Use `a[href*="adid"]`, or read the href with
  `eval` and `open` it.
- **Signed-in sessions replace the accessibility tree.** If the browser still
  holds a session, the mandatory "Set a backup passcode" dialog covers the page
  and `aria` returns only the dialog. Start with `reset` for these journeys.
- **Fuzzy search exists.** A near-miss query can return "similar ads" instead of
  the empty state; only a query with no matches at all (`zzzznomatch`) proves it.
- **Demo listings have no photos by default.** The launcher skips the Supabase
  Storage upload unless `VERIFY_SEED_PHOTOS=1`, so cards render the designed
  "no image" fallback. That is expected.
- **Two elements are named `Search`** — the textbox and its submit button. Use
  `--role searchbox` for the field and `--role button` for the submit.
- **Several headings share a name.** A detail page has the brand/model, the
  full title and the contact hint as `h1`s; a search page has a bare `Search`
  `h1` plus `Results for “…”`. Assert the specific text in the `h1` list or the
  ARIA snapshot.
- **Accessible names are duplicated in English too.** Seeded subcategory icons
  are null, so every locale renders the name twice in the icon fallback and the
  label. Substring matching is safe; exact-name assertions are not.
- **Prices are formatted per surface.** Feed cards render `$2,350`; the detail
  page interpolates `$2350` (no separator) or `Negotiable`. Assert the rendered
  string for the surface you are on.
- **Header search is route-scoped.** From `/en` it searches the whole
  catalogue; from a category page it adds `category`/`sub` to the query.
