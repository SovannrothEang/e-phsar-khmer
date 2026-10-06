import NotFoundPage from "@/components/not-found/NotFoundPage";

export const metadata = { title: "404 Not found" };

/**
 * Nearest boundary for every dead URL under `(user)` — a random slug, an
 * unknown category/subcategory, or a listing that is gone. Sitting inside the
 * `(user)` group is the whole point: it renders wrapped in
 * `(user)/layout.tsx`, so the 404 keeps the site's navbar and footer.
 */
export default function NotFound() {
  return <NotFoundPage />;
}
