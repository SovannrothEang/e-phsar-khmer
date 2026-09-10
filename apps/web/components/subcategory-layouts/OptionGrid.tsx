"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import DbImage from "@/components/common/DbImage";

/** Minimal option row (brand/bodyType/model) — local type, web is standalone. */
interface Option {
  slug: string;
  name: string;
  image?: string | null;
}

type Props = {
  options: Option[];
  baseHref: string;
  paramKey: "brand" | "body_type" | "model";
  /** Section heading rendered above the grid (e.g. "Brand", "Body Type"). */
  title?: string;
};

export default function OptionGrid({
  options,
  baseHref,
  paramKey,
  title,
}: Props) {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const LIMIT = paramKey === "model" ? 18 : 20;
  const [showAll, setShowAll] = useState(false);
  const visibleOptions = showAll ? options : options.slice(0, LIMIT);
  const router = useRouter();

  // The design follows the SET, never the load result: an image-bearing set
  // (brands, body types, musical-instrument types, …) uses the icon-circle
  // design even while an object is missing — one dead image leaves a gap in its
  // circle, it never re-styles the tile or the grid. A text set (models,
  // furniture/property Type, job types) uses the bordered text design.
  // Majority, not "any": a shared option row (the `other` row is linked across
  // families) can carry an image from another family, and a single stray image
  // must not flip a whole grid's design.
  const withImage = options.filter((o) => !!o.image).length;
  const textTiles = paramKey === "model" || withImage * 2 < options.length;

  const handleClick = (e: React.MouseEvent, slug: string) => {
    // Prevent the Link from performing a full navigation
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());

    if (paramKey === "brand") {
      params.set("ad_field", slug);
      params.delete("ad_model");
    }

    if (paramKey === "body_type") {
      params.set("ad_type", slug);
    }

    if (paramKey === "model") {
      params.set("ad_model", slug);
    }

    const targetPath = pathname || baseHref;
    // PUSH, not replace: each pick is a navigation step, so Back walks the
    // drill-down back one choice at a time (replace overwrote the subcategory
    // entry, which sent Back straight past it to the category page). The view
    // also resets to the top — a pick changes which grids exist, and keeping
    // the old offset left the remaining grid's heading under the sticky bar.
    router.push(`${targetPath}?${params.toString()}`, { scroll: true });
  };

  return (
    <div className="bg-card rounded p-4 mb-2 pl-6">
      {title && <h2 className="text-base font-bold mb-4">{title}</h2>}
      <div
        className={
          textTiles
            ? "grid grid-cols-3 md:grid-cols-6 gap-2"
            : "grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-y-6 gap-x-4"
        }
      >
        {visibleOptions.map((opt) => {
          const targetPath = pathname || baseHref;

          const isSelected =
            (paramKey === "model" &&
              searchParams.get("ad_model") === opt.slug) ||
            (paramKey === "brand" &&
              searchParams.get("ad_field") === opt.slug) ||
            (paramKey === "body_type" &&
              searchParams.get("ad_type") === opt.slug);

          return (
            <a
              key={opt.slug}
              href={`${targetPath}?${paramKey === "model" ? "ad_model" : paramKey === "body_type" ? "ad_type" : "ad_field"}=${opt.slug}`}
              onClick={(e) => handleClick(e, opt.slug)}
              className={
                textTiles
                  ? `border py-2 px-1 text-xs text-center transition-colors flex items-center justify-center min-h-[40px] ${
                      isSelected
                        ? "text-blue-500 bg-blue-50 border-blue-100 font-medium"
                        : "hover:bg-muted bg-card"
                    }`
                  : `flex flex-col items-center text-center group ${isSelected ? "text-blue-500 font-medium" : ""}`
              }
            >
              {textTiles ? (
                <span>{opt.name}</span>
              ) : (
                <>
                  <div className="w-14 h-14 flex items-center justify-center rounded-full bg-blue-50 group-hover:bg-blue-100">
                    {opt.image ? (
                      <DbImage
                        src={opt.image}
                        alt={opt.name}
                        width={56}
                        height={56}
                        className="object-contain"
                      />
                    ) : null}
                  </div>
                  <span className="text-xs mt-2 block">{opt.name}</span>
                </>
              )}
            </a>
          );
        })}
      </div>
      {options.length > LIMIT && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full border rounded py-2 text-sm bg-muted hover:bg-gray-200"
          >
            {showAll ? "Show Less" : "Show More"}
          </button>
        </div>
      )}
    </div>
  );
}
