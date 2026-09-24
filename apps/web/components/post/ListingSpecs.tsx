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
  // Home & Land sit before `type`: the property form reads Bedroom → Bathroom
  // → Facing → Size → Type, so the published grid has to as well. The keys are
  // the schema's own **singular** `bedroom`/`bathroom` — this list carried the
  // plural forms from before the family had a form, and a key that is not here
  // is invisible on the detail page even though the listing stores it.
  ["bedroom", "Bedroom"],
  ["bathroom", "Bathroom"],
  ["facing", "Facing"],
  ["size", "Size"],
  ["type", "Type"],
  ["accessory", "Accessory"],
  ["screenSize", "Screen Size"],
  ["storage", "Storage"],
  ["ram", "RAM"],
  ["cpu", "CPU"],
  ["vga", "VGA"],
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
  "machinery",
  "consumer-electronics",
  "security-cameras",
  "lighting",
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

/**
 * Units appended to a value on the PUBLISHED grid (captain, 2026-09-23:
 * "size: m²", reference showing `Size | 220m²`).
 *
 * The unit belongs to the display, not to the seller's input: the post form's
 * Size field is a bare number with no suffix, which is what the captain's form
 * mock shows. So it is added here rather than in the input or in the stored
 * attribute — the JSONB keeps `"220"` and only this grid renders `220m²`.
 * `size` is Home & Land's only such key (areas throughout: land, rooms, condos,
 * houses, commercial).
 */
const VALUE_SUFFIX: Record<string, string> = { size: "m²" };

/**
 * Subcategories whose reference lists Storage before Condition, so Condition
 * moves to after the spec block. Phones and Tablets only (captain, 2026-09-22);
 * the computers family declares `storage` too but keeps Condition where it is
 * until its own reference is checked.
 */
const STORAGE_BEFORE_CONDITION = new Set(["phones", "tablets"]);

/**
 * Mirrors `CONDITION_SLOT`'s `afterScreenSize` in the post form: All-in-One and
 * Monitors read Screen Size first and Condition directly under it, so their
 * published grid has to as well — otherwise the same listing says
 * `Screen Size | Condition` while it is being posted and `Condition | Screen
 * Size` once it is live. Scoped rather than added to the shared list: Laptops
 * and Desktops declare `screenSize` too but use the `lead` slot (Condition
 * first), so a blanket rule would invert those instead of fixing these.
 */
const CONDITION_AFTER_SCREEN_SIZE = new Set(["all-in-one", "monitors"]);

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
  // Year/Tax Type (cars/motorcycles), the Type picker — both the cars parts
  // form, which keys it `vehicleType`, and the computers one, which keys it
  // `type`; the reference shows "Type" then "Condition" on each — and the
  // Accessory picker, which holds the same "what kind of thing is this" slot on
  // Phone Accessories. When none of those are present it falls back to just
  // after Brand/Model (or Category).
  const conditionPreKeys = new Set(
    subcate?.slug === "parts-and-accessories"
      ? ["year", "taxType", "vehicleType", "type", "accessory"]
      : ["year", "taxType", "type", "accessory"],
  );
  // Phones and Tablets show Storage BEFORE Condition (captain's reference), so
  // Condition follows the spec block instead of leading it. Scoped rather than
  // added to the shared list: the computers family also declares `storage`, and
  // its own reference has not been reviewed — same per-subcategory shape as
  // `CONDITION_SLOT` in the post form.
  if (subcate && STORAGE_BEFORE_CONDITION.has(subcate.slug)) {
    conditionPreKeys.add("storage");
  }
  if (subcate && CONDITION_AFTER_SCREEN_SIZE.has(subcate.slug)) {
    conditionPreKeys.add("screenSize");
  }
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
      value: `${value}${VALUE_SUFFIX[key] ?? ""}`,
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
