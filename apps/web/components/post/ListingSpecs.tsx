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
// design order (fixed): brand/model first (cars), then the attribute keys in
// the observed design sequence, then Condition (only for condition-carrying
// categories — the same ones that show the Condition chip on the browse bar).
const ATTR_KEYS: [key: string, label: string][] = [
  ["year", "Year"],
  ["taxType", "Tax Type"],
  ["color", "Color"],
  ["jobType", "Job Type"],
  ["experience", "Experience"],
  ["engineType", "Engine Type"],
  ["transmission", "Transmission"],
  ["type", "Type"],
  ["bedrooms", "Bedroom"],
  ["bathrooms", "Bathroom"],
  ["facing", "Facing"],
  ["storage", "Storage"],
  ["ram", "RAM"],
  ["cpu", "CPU"],
  ["network", "Network"],
];

const CONDITION_CATEGORIES = [
  "cars-and-vehicles",
  "phones-and-tablets",
  "computers-and-accessories",
  "electronics-and-appliances",
];

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

  const conditionCarrier = !!cate && CONDITION_CATEGORIES.includes(cate.slug);

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

  for (const [key, label] of ATTR_KEYS) {
    const value = toText(attributes?.[key]);
    if (value) rows.push({ label, value, href: browseHref });
  }

  if (conditionCarrier && (condition === "used" || condition === "new")) {
    rows.push({
      label: "Condition",
      value: condition === "used" ? "Used" : "New",
      href: browseHref,
    });
  }

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
