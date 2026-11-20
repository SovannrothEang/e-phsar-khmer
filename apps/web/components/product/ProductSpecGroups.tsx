import type { ProductSpecGroup } from "@/types/product";
import { foldSpecRows } from "@/lib/product/spec-rows";

/**
 * The trusted spec sheet, one section per row, full width (captain,
 * 2026-10-31): stacked cards read as one continuous spec sheet, not a
 * two-column comparison of unrelated sections. Shared by the product page and
 * the listing detail so the same sheet cannot render two ways.
 */
export function ProductSpecGroups({ groups }: { groups: ProductSpecGroup[] }) {
  return (
    <div className="mt-5 space-y-4">
      {groups.map((group, groupIndex) => (
        <div
          key={`${group.title}-${groupIndex}`}
          className="rounded-md border border-border/70 bg-background/40 p-4"
        >
          <h3 className="type-card-heading flex items-center gap-2 text-foreground">
            <span
              className="inline-block h-4 w-1 rounded-full bg-[#00a0e9]"
              aria-hidden
            />
            {group.title}
          </h3>
          <dl className="mt-2 divide-y divide-border">
            {foldSpecRows(group.rows).map((row, rowIndex) => (
              <div
                key={`${row.label}-${rowIndex}`}
                className="grid grid-cols-[minmax(120px,40%)_1fr] gap-4 py-2.5"
              >
                <dt className="type-body-sm text-muted-foreground">
                  {row.label}
                </dt>
                <dd className="type-body flex flex-col divide-y divide-border text-foreground">
                  {row.values.map((value, valueIndex) => (
                    // The divider matches the row separators and spans the
                    // value column only (the `dd`), with breathing room above
                    // and below instead of touching the text.
                    <span
                      key={valueIndex}
                      className="block py-2 first:pt-0 last:pb-0"
                    >
                      {value}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
