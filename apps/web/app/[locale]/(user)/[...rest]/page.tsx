import { notFound } from "next/navigation";

/**
 * Catch-all for a URL under a locale that no real route claims.
 *
 * `[slug]/page.tsx` only matches a SINGLE segment, so before this file
 * `/en/anything/at/all` matched nothing and Next fell through to its built-in
 * 404 — no navbar, no footer, and the wrong tab title, while `/en/anything`
 * correctly got the designed page. This route claims the leftovers and hands
 * them straight to `notFound()`, so every dead URL renders the same boundary.
 *
 * It cannot shadow a real route: Next ranks a static segment above a dynamic
 * one and both above a catch-all, so `/category/…`, `/me/…`, `/[slug]/about`
 * and friends all still win. It only ever sees what nothing else matched —
 * anything else is a routing regression, not a nuance.
 */
export default function CatchAllPage() {
  notFound();
}
