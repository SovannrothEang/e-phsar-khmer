import NotFoundPage from "@/components/not-found/NotFoundPage";

export const metadata = { title: "404 Not found" };

/**
 * Fallback boundary for anything under a locale that is NOT inside `(user)`.
 * Same design as the `(user)` boundary, so a dead URL looks the same wherever
 * it is caught — it just arrives without the site chrome.
 */
export default function NotFound() {
  return <NotFoundPage />;
}
