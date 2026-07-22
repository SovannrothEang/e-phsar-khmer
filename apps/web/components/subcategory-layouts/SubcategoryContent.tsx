import { useSearchParams } from "next/navigation";
import OptionGrid from "./OptionGrid";

type Props = {
  categorySlug: string;
  subcategorySlug: string;
  subcategory: any;
};

export default function SubcategoryContent({
  categorySlug,
  subcategorySlug,
  subcategory,
}: Props) {

const baseHref = `/category/${categorySlug}/${subcategorySlug}`;
const searchParams = useSearchParams();

const brandSlug = searchParams.get("ad_field");
const bodyType = searchParams.get("ad_type");
const model = searchParams.get("ad_model");

// 1. Force lowercase comparison to avoid "Kia" vs "kia" issues
const selectedBrand = subcategory.brands?.find(
  (b: { slug: string }) => b.slug.toLowerCase() === brandSlug?.toLowerCase()
);

  return (
    <>
      {/* BRAND GRID: Show when no brand is selected */}
      {!selectedBrand && subcategory.brands && (
        <OptionGrid
          options={subcategory.brands}
          baseHref={baseHref}
          paramKey="brand"
        />
      )}

      {/* MODEL GRID: Show when a brand is selected */}
      {selectedBrand && selectedBrand.model && (
        <OptionGrid
          options={selectedBrand.model}
          baseHref={baseHref}
          paramKey="model"
        />
      )}

      {/* TYPE GRID: Show when no type is selected */}
      {!(categorySlug === "jobs" ? brandSlug : bodyType) && subcategory.bodyTypes && (
        <OptionGrid
          options={subcategory.bodyTypes}
          baseHref={baseHref}
          paramKey={categorySlug === "jobs" ? "brand" : "body_type"}
        />
      )}

    </>
  );
}
