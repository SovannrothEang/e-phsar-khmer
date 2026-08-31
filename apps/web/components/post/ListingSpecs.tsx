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
    {
      label: "Brand",
      value: brand?.name,
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
    },
    {
      label: "Model",
      value: model?.name,
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
    },
    { label: "Year", value: toText(attributes?.year), href: browseHref },
    { label: "Tax Type", value: toText(attributes?.taxType), href: browseHref },
    {
      label: "Condition",
      value:
        condition === "used" ? "Used" : condition === "new" ? "New" : undefined,
      href: browseHref,
    },
    { label: "Color", value: toText(attributes?.color), href: browseHref },
  ];

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
              {row.value ?? "—"}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
