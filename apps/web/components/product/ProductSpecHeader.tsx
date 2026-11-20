import { BadgeCheck } from "lucide-react";
import DbImage from "@/components/common/DbImage";
import type { ProductDetail } from "@/types/product";

const FAMILY_LABELS: Record<string, string> = {
  car: "Cars",
  motorcycle: "Motorcycles",
  phone: "Phones",
  tablet: "Tablets",
  smartwatch: "Smart Watches",
};

/** Best-effort powertrain chip from the spec sheet's own Fuel Type row. */
function fuelTypeOf(
  groups: { rows: { label: string; value: string }[] }[],
): string | null {
  for (const group of groups) {
    for (const row of group.rows) {
      if (/^fuel(?:\s+type)?$/i.test(row.label.trim())) return row.value;
    }
  }
  return null;
}

/**
 * The trusted product header — image, brand, badge, model name, family/fuel
 * chips and the staff note. Shared by the product page and the listing
 * detail's inline spec block so both show the same identity. Label strings
 * come from the caller so this file stays free of i18n hooks (the same
 * convention as `ProductCard`).
 */
export function ProductSpecHeader({
  product,
  trustedBadge,
  trustedNote,
  id,
  headingLevel: Heading = "h1",
}: {
  product: ProductDetail;
  trustedBadge: string;
  trustedNote: string;
  /** Anchor id, used by the listing detail's `View full specs` chip. */
  id?: string;
  /** The ad page already has an h1 (the ad title), so it passes "h2". */
  headingLevel?: "h1" | "h2";
}) {
  const fuelType = fuelTypeOf(product.specGroups);

  return (
    <header
      id={id}
      className="scroll-mt-20 overflow-hidden rounded-sm border border-border bg-card"
    >
      <div className="grid gap-6 p-6 md:grid-cols-[minmax(320px,420px)_1fr] md:items-center">
        <div className="flex aspect-[4/3] w-full items-center justify-center rounded-md bg-muted/40 p-4">
          <DbImage
            src={product.image ?? ""}
            alt={`${product.brandName} ${product.modelName}`}
            width={768}
            height={512}
            className="h-full w-full object-contain"
            fallback={
              <span className="type-page-title text-muted-foreground">
                {product.brandName.charAt(0).toUpperCase()}
              </span>
            }
          />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <p className="type-body-sm uppercase tracking-[0.08em] text-muted-foreground">
              {product.brandName}
            </p>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#00a0e9]/30 bg-[#00a0e9]/10 px-2.5 py-1 type-meta text-[#00a0e9]">
              <BadgeCheck className="size-3.5" />
              {trustedBadge}
            </span>
          </div>
          <Heading className="type-page-title mt-2 text-foreground">
            {product.modelName}
          </Heading>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-3 py-1 type-meta text-foreground">
              {FAMILY_LABELS[product.family] ?? product.family}
            </span>
            {fuelType ? (
              <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-3 py-1 type-meta text-foreground">
                {fuelType}
              </span>
            ) : null}
          </div>
          <p className="type-body-sm mt-4 max-w-prose text-muted-foreground">
            {trustedNote}
          </p>
        </div>
      </div>
    </header>
  );
}
