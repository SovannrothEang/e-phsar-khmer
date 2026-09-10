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
  /** Brand options — null when the subcategory has no live brands. */
  brands?: OptionRow[] | null;
  /** Models of the selected brand — null unless a brand is selected. */
  models?: OptionRow[] | null;
  /** Linked attribute sets (body types, types, bedrooms, …) — each has a
   *  design title (e.g. "Body Type") and non-empty options. */
  sets?: { slug: string; title: string; options: OptionRow[] }[];
};

export default function SubcategoryContent({
  categorySlug,
  subcategorySlug,
  brands,
  models,
  sets,
}: Props) {
  const baseHref = `/category/${categorySlug}/${subcategorySlug}`;
  const searchParams = useSearchParams();

  const brandSlug = searchParams.get("ad_field");
  const attrSlug = searchParams.get("ad_type");

  // Force lowercase comparison to avoid "Kia" vs "kia" issues
  const selectedBrand = brands?.find(
    (b) => b.slug.toLowerCase() === brandSlug?.toLowerCase(),
  );

  // A set the user has already applied steps aside for the next choice — the
  // Body Type grid disappears once a body type is picked, leaving Brand (the
  // applied filter is still shown by the bar, the breadcrumb and the feed).
  const pendingSets = sets?.filter(
    (set) => !set.options.some((o) => o.slug === attrSlug),
  );

  return (
    <>
      {/* BRAND GRID: Show when no brand is selected */}
      {!selectedBrand && !!brands?.length && (
        <OptionGrid
          options={brands}
          baseHref={baseHref}
          paramKey="brand"
          title="Brand"
        />
      )}

      {/* MODEL GRID: Show when a brand is selected */}
      {selectedBrand && !!models?.length && (
        <OptionGrid
          options={models}
          baseHref={baseHref}
          paramKey="model"
          title="Model"
        />
      )}

      {/* ATTRIBUTE GRIDS (Body Type, Type, Bedroom, Accessories, …): each
          linked set renders its own card with the design title; an applied set
          is filtered out above */}
      {pendingSets?.map((set) => (
        <OptionGrid
          key={set.slug}
          options={set.options}
          baseHref={baseHref}
          paramKey="body_type"
          title={set.title}
        />
      ))}
    </>
  );
}
