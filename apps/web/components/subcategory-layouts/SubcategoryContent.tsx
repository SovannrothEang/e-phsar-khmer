"use client";

import { useSearchParams } from "next/navigation";
import OptionGrid from "./OptionGrid";

/** Minimal option row shape (web standalone; backend rows mapped at the page boundary). */
export interface OptionRow {
  slug: string;
  name: string;
  image?: string | null;
}

type Props = {
  categorySlug: string;
  subcategorySlug: string;
  /** Brand options (cars) — null when the subcategory has no live brands. */
  brands?: OptionRow[] | null;
  /** Body-type options (cars) — null when no rows apply. */
  bodyTypes?: OptionRow[] | null;
  /** Models of the selected brand — null unless a brand is selected. */
  models?: OptionRow[] | null;
};

export default function SubcategoryContent({
  categorySlug,
  subcategorySlug,
  brands,
  bodyTypes,
  models,
}: Props) {
  const baseHref = `/category/${categorySlug}/${subcategorySlug}`;
  const searchParams = useSearchParams();

  const brandSlug = searchParams.get("ad_field");
  const bodyType = searchParams.get("ad_type");

  // Force lowercase comparison to avoid "Kia" vs "kia" issues
  const selectedBrand = brands?.find(
    (b) => b.slug.toLowerCase() === brandSlug?.toLowerCase(),
  );

  return (
    <>
      {/* BRAND GRID: Show when no brand is selected */}
      {!selectedBrand && !!brands?.length && (
        <OptionGrid options={brands} baseHref={baseHref} paramKey="brand" />
      )}

      {/* MODEL GRID: Show when a brand is selected */}
      {selectedBrand && !!models?.length && (
        <OptionGrid options={models} baseHref={baseHref} paramKey="model" />
      )}

      {/* TYPE GRID: Show when no type is selected */}
      {!(categorySlug === "jobs" ? brandSlug : bodyType) &&
        !!bodyTypes?.length && (
          <OptionGrid
            options={bodyTypes}
            baseHref={baseHref}
            paramKey={categorySlug === "jobs" ? "brand" : "body_type"}
          />
        )}
    </>
  );
}
