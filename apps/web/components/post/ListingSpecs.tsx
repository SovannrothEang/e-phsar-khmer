import { Link } from "@/i18n/routing";
import type { ComponentProps } from "react";

export interface ListingSpecsProps {
  cate?: { slug: string; name: string };
  subcate?: { slug: string; name: string };
  brand?: { slug: string; name: string };
  model?: { slug: string; name: string };
  attributes?: Record<string, unknown> | null;
  condition?: "new" | "used" | null;
}

type Href = ComponentProps<typeof Link>["href"];

interface Row {
  label: string;
  value?: string;
  href?: Href;
}

const toText = (v: unknown): string | undefined => {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
};

// Only fields the listing's own category/form relates to are rendered. The
// design order (fixed, per the reference image): brand/model first (cars),
// then year, taxType, Condition (only for condition-carrying categories —
// the same ones that show the Condition chip on the browse bar), bodyType,
// engineType, transmission, color, then the remaining keys.
const ATTR_KEYS: [key: string, label: string][] = [
  ["year", "Year"],
  ["taxType", "Tax Type"],
  ["bodyType", "Body Type"],
  ["vehicleType", "Vehicle Type"],
  ["engineType", "Engine Type"],
  ["transmission", "Transmission"],
  ["color", "Color"],
  ["jobType", "Job Type"],
  ["experience", "Experience"],
  ["type", "Type"],
  ["bedrooms", "Bedroom"],
  ["bathrooms", "Bathroom"],
  ["facing", "Facing"],
  ["storage", "Storage"],
  ["ram", "RAM"],
  ["cpu", "CPU"],
  ["network", "Network"],
];

// Subcategories whose listing forms carry a Condition field (mirrors the
// `conditionField` usage in categories.seed.ts — a subcategory-level rule,
// so e.g. maintenance/rentals/financing/tuk-tuk/vehicles-others show none).
const CONDITION_SUBCATEGORIES = new Set([
  "cars-for-sale",
  "bicycles",
  "motorcycles-for-sale",
  "lorries-vans-and-tractors",
  "parts-and-accessories",
  "phones",
  "tablets",
  "smart-watches",
  "phone-accessories",
  "laptops",
  "desktops",
  "all-in-one",
  "monitors",
  "printers-and-scanners",
  "computers-parts-and-accessories",
  "washing-machines-and-dryers",
  "fridges-and-freezers",
  "air-conditioning-and-heating",
  "tools",
  "consumer-electronics",
  "cameras-and-camcorders",
  "tvs-videos-and-audio",
  "home-appliances",
  "video-games-consoles-toys",
  "musical-instruments",
]);

// The parts-and-accessories form keys its "Type" picker (Cars/Bicycles/…) as
// `vehicleType` — same key as the rentals' "Vehicle Type"; label per design.
const LABEL_OVERRIDES: Record<string, Record<string, string>> = {
  "parts-and-accessories": { vehicleType: "Type" },
};

export default function ListingSpecs({
  cate,
  subcate,
  brand,
  model,
  attributes,
  condition,
}: ListingSpecsProps) {
  const browseHref: Href | undefined =
    cate && subcate
      ? {
          pathname: "/category/[categorySlug]/[subcategorySlug]",
          params: {
            categorySlug: cate.slug,
            subcategorySlug: subcate.slug,
          },
        }
      : undefined;

  const conditionCarrier =
    !!subcate && CONDITION_SUBCATEGORIES.has(subcate.slug);
  const labelOverrides = subcate ? LABEL_OVERRIDES[subcate.slug] : undefined;

  const rows: Row[] = [
    {
      label: "Main Category",
      value: cate?.name,
      href: cate
        ? {
            pathname: "/category/[categorySlug]",
            params: { categorySlug: cate.slug },
          }
        : undefined,
    },
    {
      label: "Category",
      value: subcate?.name,
      href: subcate && cate ? browseHref : undefined,
    },
  ];

  if (brand?.name) {
    rows.push({
      label: "Brand",
      value: brand.name,
      href:
        brand && cate && subcate
          ? {
              pathname: "/category/[categorySlug]/[subcategorySlug]",
              params: {
                categorySlug: cate.slug,
                subcategorySlug: subcate.slug,
              },
              query: { ad_field: brand.slug },
            }
          : undefined,
    });
  }

  if (model?.name) {
    rows.push({
      label: "Model",
      value: model.name,
      href:
        model && cate && subcate && brand?.slug
          ? {
              pathname: "/category/[categorySlug]/[subcategorySlug]",
              params: {
                categorySlug: cate.slug,
                subcategorySlug: subcate.slug,
              },
              query: { ad_field: brand.slug, ad_model: model.slug },
            }
          : model
            ? browseHref
            : undefined,
    });
  }

  // Condition sits directly after the fields the design places before it:
  // Year/Tax Type (cars/motorcycles) — plus the Type picker for parts
  // (reference shows "Type" then "Condition"). When none of those are
  // present it falls back to just after Brand/Model (or Category).
  const conditionPreKeys = new Set(
    subcate?.slug === "parts-and-accessories"
      ? ["year", "taxType", "vehicleType"]
      : ["year", "taxType"],
  );
  const showCondition =
    conditionCarrier && (condition === "used" || condition === "new");
  let conditionInserted = false;
  const pushCondition = () => {
    if (!showCondition || conditionInserted) return;
    rows.push({
      label: "Condition",
      value: condition === "used" ? "Used" : "New",
      href: browseHref,
    });
    conditionInserted = true;
  };

  for (const [key, label] of ATTR_KEYS) {
    const value = toText(attributes?.[key]);
    if (!value) continue;
    if (!conditionPreKeys.has(key)) pushCondition();
    rows.push({
      label: labelOverrides?.[key] ?? label,
      value,
      href: browseHref,
    });
  }
  pushCondition();

  if (rows.every((r) => r.value === undefined)) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5 mb-5">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="text-xs text-muted-foreground">{row.label}</div>
          {row.href && row.value ? (
            <Link
              href={row.href}
              className="text-sm text-[#00a0e9] hover:underline underline-offset-2 break-words"
            >
              {row.value}
            </Link>
          ) : (
            <span className="text-sm text-[#00a0e9] break-words">
              {row.value}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
