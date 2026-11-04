# Image delivery — measured results

Plan: `Plans.md` → "Faster listing pages and image delivery" (2026-11-02).
This file holds the measurements the plan's DoDs ask for, so the numbers are not
buried in a commit message.

## 0.2 Optimizer spike — VERIFIED (2026-11-04, production build)

Ran the real supplier of these images: the Next image optimizer inside the
**standalone production build** (`node .next/standalone/apps/web/server.js`), on
Windows (the host this repo is developed on), via the host's `curl`:

| Request                                                                          | Result                                                                                                                             |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `/_next/image?url=%2Fads%2Flandforsale.jpg&w=640&q=75` with `Accept: image/avif` | **200**, `content-type: image/avif`, 15 325 bytes, `cache-control: public, max-age=14400, must-revalidate`, `x-nextjs-cache: MISS` |
| same URL, `Accept: image/webp`, `q=50`, `w=640`                                  | **200**, `content-type: image/webp`                                                                                                |
| `q=60` (not in `next.config.ts` `qualities`)                                     | **400** — the optimizer validates the quality                                                                                      |
| `w=320` (not in `deviceSizes`/`imageSizes`)                                      | **400** — the optimizer validates the width                                                                                        |

Two findings that shaped the implementation:

1. **`sharp` was not linked.** It is an _optional_ dependency of `next` 16, and
   pnpm did not link it for `apps/web`, so every `/_next/image` request in
   production would have failed and every listing image would have fallen back
   to nothing. `sharp@^0.34.5` is now an explicit dependency of `apps/web`.
2. **Quality and width are a contract, not a hint.** Only
   `qualities: [25, 50, 75, 100]` and the configured `deviceSizes`/`imageSizes`
   are accepted; anything else is a 400. The lightbox thumbnail URL therefore
   uses `quality: 50`.

Still unverified here (needs the deploy): whether the container keeps
`.next/cache/images` on a persistent volume, and the repeat-request
`x-nextjs-cache: HIT` on the first request after a cold start.

## 2.x Surface sizes (what each image now asks for)

| Surface                             | `sizes`                                                     | Why                                                |
| ----------------------------------- | ----------------------------------------------------------- | -------------------------------------------------- |
| Feed grid card                      | `(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw`  | the feed is 1 / 2 / 4 columns                      |
| List card image                     | `200px`                                                     | the box is a fixed `w-[200px]` at every breakpoint |
| Detail hero (single / collage main) | `(max-width: 768px) 100vw, (max-width: 1280px) 60vw, 760px` | the gallery owns the content column                |
| Collage tile                        | `(max-width: 768px) 33vw, (max-width: 1280px) 20vw, 250px`  | a strip tile                                       |
| Gallery thumbnail strip (job ads)   | `(max-width: 640px) 130px, 155px`                           | fixed narrow column                                |
| Lightbox thumbnail                  | `width: 96, quality: 50` via `getImageProps`                | the library's strip renders 56 px                  |

The plan's benchmark (55 seed photos, avg 305 KB / 1267 px): WebP 480 px ≈ 21 KB,
WebP 1000 px ≈ 91 KB. A 250 px collage tile now costs ~10–21 KB instead of the
original upload.
