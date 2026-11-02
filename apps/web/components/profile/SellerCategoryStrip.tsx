"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import CategoryTileBody from "@/components/common/CategoryTileBody";

/**
 * The minimal slice of the category tree this row renders. Local types, not
 * the backend DTOs — the web app is standalone, and these cross a client
 * boundary (the same convention `SubcategoryGrid` follows).
 */
export interface StripOption {
  slug: string;
  name: string;
  icon: string | null;
}

export interface StripCategory extends StripOption {
  /** Only the subcategories this seller has posted in. */
  subcategories: StripOption[];
}

export interface StripSelection {
  category?: string;
  subcategory?: string;
}

interface Props {
  /** The seller's own tree: every category they posted in, each carrying the
   *  subcategories they posted in. Both levels are already scoped. */
  categories: StripCategory[];
  category?: string;
  subcategory?: string;
  /** Fired with the whole next selection; the caller refetches and re-renders. */
  onSelect: (next: StripSelection) => void;
}

/**
 * Row three of the profile panel — the horizontal category navigation.
 *
 * **A row appears only while it still offers a choice.** With more than one
 * category the first row lists them; picking one swaps the row for that
 * category's subcategories; picking a subcategory ends the drill and **the row
 * disappears entirely**. A seller who posted in a single category never sees a
 * category row at all — that choice does not exist — so their subcategories are
 * the first row they get, which is the only way a seller like `hlandverify`
 * (one category, twelve subcategories) can narrow anything. A level with one
 * option or none renders no row either: one option is not a choice, and a tile
 * that cannot lead anywhere is worse than no tile.
 *
 * There is deliberately no breadcrumb and no marked tile — a trail, or a
 * highlighted "you are here", would only repeat the tap back at the user. The
 * filtered feed is the feedback. Going back is the browser's Back arrow, which
 * walks the drill because every pick pushes a history entry.
 *
 * The tiles are real anchors whose `href` is the same URL the drill writes, so
 * a middle-click opens the drilled view in a new tab and a copied link works;
 * a plain click is intercepted and handled in place, without a navigation.
 */
export default function SellerCategoryStrip({
  categories,
  category,
  subcategory,
  onSelect,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selected = categories.find((c) => c.slug === category);
  // A single-category seller's category is implicitly chosen, so the row that
  // actually has a choice is the one shown.
  const subcategorySource =
    selected ?? (categories.length === 1 ? categories[0] : undefined);
  const options = subcategorySource
    ? subcategorySource.subcategories
    : categories;

  // A completed drill shows no row: the choice has been made, the feed below is
  // already only that choice, and Back is the way up.
  if (subcategory) return null;

  if (options.length <= 1) return null;

  // Carries the bar's filters through: a tile tapped into a new tab (or whose
  // link is copied) must land on the same filtered view, not the seller's
  // whole catalogue. The in-place click path preserves them via `window.
  // location`, so the two never disagree.
  const hrefFor = (next: StripSelection) => {
    const qs = new URLSearchParams(searchParams.toString());
    if (next.category) qs.set("category", next.category);
    else qs.delete("category");
    if (next.subcategory) qs.set("subcategory", next.subcategory);
    else qs.delete("subcategory");
    const query = qs.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  /** Handles it in place — unless the visitor asked for a new tab/window. */
  const activate = (
    event: React.MouseEvent<HTMLAnchorElement>,
    next: StripSelection,
  ) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    if (event.button !== 0) return;
    event.preventDefault();
    onSelect(next);
  };

  return (
    // The hairline is what makes this read as the panel's third row rather than
    // a separate block, so it lives here: no row, no rule.
    <div className="border-t">
      {/* The same tiles and the same rhythm as the homepage's Browse By
          Category section: a bare circle-over-label, nothing behind it and no
          rule between them. */}
      <ul className="grid grid-cols-3 gap-x-8 gap-y-8 px-2 py-5 text-center sm:grid-cols-4 md:grid-cols-6">
        {options.map((option) => {
          const next: StripSelection = subcategorySource
            ? { category: subcategorySource.slug, subcategory: option.slug }
            : { category: option.slug };
          return (
            <li key={option.slug}>
              <a
                href={hrefFor(next)}
                onClick={(e) => activate(e, next)}
                className="group flex cursor-pointer flex-col items-center text-center"
              >
                <CategoryTileBody name={option.name} icon={option.icon} />
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
