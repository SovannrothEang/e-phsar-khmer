# Image delivery and detail-page performance — measured results

Plan: `Plans.md` → "Faster listing pages and image delivery" (2026-11-02).
This file holds the numbers tasks 0.1 (baseline) and 5.1 (repeat) ask for, so
they are not buried in a commit message. `tasks/perf-images.md` holds the
optimizer spike from the same plan.

## Environment (measured 2026-11-05)

Local stack, not the deploy target — compare the shapes, not the absolutes:

- Postgres 17 in Docker on `localhost:6543`, Redis on `6379`, both seeded
  (273 listings).
- Backend `nest start --watch` on `:8080`, `NODE_ENV=development`.
- Web from a **production build** (`next build` then `next start -p 3001`).
- Chrome for Testing 152 through `chrome-devtools-axi`, warm disk cache.
- Fixture: `/en/queen-bed-adid-fa905a84-bf9e-4eed-825a-fa2996d3a3b8` — one
  photo, the seed bed image.

## Detail page — TTFB and total (5 runs, anonymous)

```powershell
1..5 | ForEach-Object {
  curl.exe -s -o NUL -w "%{http_code} %{time_starttransfer} %{time_total} %{size_download}`n" `
    "http://localhost:3001/en/queen-bed-adid-fa905a84-bf9e-4eed-825a-fa2996d3a3b8"
  Start-Sleep -Milliseconds 400
}
```

| Run | Status | TTFB (s) | Total (s) | Bytes  |
| --- | ------ | -------- | --------- | ------ |
| 1   | 200    | 0.605    | 0.613     | 165865 |
| 2   | 200    | 0.092    | 0.098     | 165822 |
| 3   | 200    | 0.068    | 0.073     | 165822 |
| 4   | 200    | 0.082    | 0.087     | 165822 |
| 5   | 200    | 0.068    | 0.073     | 165822 |

Median TTFB **0.082 s**; TTFB ≈ total, i.e. nothing waits behind a later wave.
Run 1 is the cold render; the steady state is ~70 ms.

## Detail and feed — paint timings

Measured in the browser with a buffered `largest-contentful-paint` observer
(`chrome-devtools-axi eval`), 390×844 mobile emulation for the detail page and
1280×900 for the feed.

| Surface        | TTFB   | FCP    | LCP         | LCP element           | Overflow |
| -------------- | ------ | ------ | ----------- | --------------------- | -------- |
| listing detail | 44 ms  | 144 ms | **144 ms**  | `IMG` (hero, `w=750`) | none     |
| feed (1280)    | 186 ms | 888 ms | **1476 ms** | `IMG` (grid card)     | none     |

## Image bytes per surface

Original `seed-queen-bed.jpg`: **235,300 B** (230 KB), `cache-control:
public, max-age=3600`. Optimized responses: `public, max-age=14400,
must-revalidate` (4 h).

| Surface              | Request                          | Bytes  | vs original |
| -------------------- | -------------------------------- | ------ | ----------- |
| Grid card (25vw)     | `/_next/image?…&w=384&q=75` AVIF | 10,323 | **−95.6%**  |
| Grid card (25vw)     | same, WebP                       | 12,034 | −94.9%      |
| Hero 640–768 px      | `w=640` AVIF                     | 25,499 | −89.2%      |
| Hero (this viewport) | `w=750` AVIF                     | 33,629 | **−85.7%**  |
| Hero (this viewport) | `w=750` WebP                     | 41,060 | −82.5%      |
| Hero 1280+ desktop   | `w=1080` AVIF                    | 62,204 | −73.6%      |

The feed renders 24 cards with
`sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"`, so a
1280 px four-column screen picks `w=384` — **~10 KB per card**, against the
plan's ≤ 40 KB goal.

## Category tree cache (task 1.2)

The public tree is the slowest call on the detail page. It is now fetched with
`next: { revalidate: 300 }`; the seller-scoped tree stays `no-store`.

| Check                                     | Evidence                                                                                                                                                         |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Second view inside 5 min makes no request | One entry in `apps/web/.next/cache/fetch-cache` (289,500 B); after two more detail loads the count stayed 1 and the entry's mtime was unchanged (`04:41:29.329`) |
| The window is really 5 minutes            | An earlier entry written at `04:36:24` was rewritten at `04:41:29` — exactly the revalidate window                                                               |
| Locales do not mix                        | A `/km/...` load added a second entry; that HTML carries 1,747 Khmer runs including the breadcrumb (`គ្រឿងសង្ហារិម …`), while the `en` HTML does not             |

## Before → after

The "before" column is the plan's own 2026-11-02 evidence (remote DB), so the
two environments differ; the direction of each row is what matters.

| Metric        | Before (2026-11-02)               | After (2026-11-05)                 |
| ------------- | --------------------------------- | ---------------------------------- |
| Detail TTFB   | 0.64–1.09 s                       | 0.082 s median (local)             |
| Card image    | original upload, avg 305 KB       | 10.3 KB AVIF at `w=384`            |
| Hero image    | original upload                   | 33.6 KB AVIF at `w=750`            |
| Image cache   | 1 h (Supabase default)            | 4 h, `must-revalidate`             |
| Category tree | fetched every page view (~0.96 s) | cached 5 min, one fetch per locale |

## Not verified here

- The signed-in browser pass: there are no local credentials, and
  `OTP_PROVIDER=plasgate` means the OTP path would send a real SMS. The
  follow-state lookup (`FollowSlot`) is therefore verified anonymously plus by
  type/build only.
- Lightbox zoom, the detail skeleton caught mid-stream, and the two upload
  checks (large JPEG, bad file) — they still need a manual pass (task 5.3).
- Whether the container keeps `.next/cache/images` on a persistent volume, and
  the first repeat-request `x-nextjs-cache: HIT` after a cold start (task 2.6).

## Known limits of the five-minute tree cache

- The cache is per Next instance, not per deployment: a cold start refetches,
  and the "one fetch per locale" result above holds per instance.
- The same helper feeds the post-an-ad category picker and the ad-edit form
  config, so a **newly created** category can be missing there for up to five
  minutes. The agreed trade-off only named renames; this is the same window.
- `sms_deliveries` has no `created_at` index, so the admin audit page's default
  sort is a table sort. Fine at seed size; add the index before the table grows.
