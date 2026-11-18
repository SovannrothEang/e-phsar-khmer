import type { ProductSpecGroup, ProductSpecRow } from "@/lib/api/products";

export interface FoldedSpecRow {
  label: string;
  values: string[];
}

/** Web's `FAMILY_LABELS` — the family chip stays English in both locales. */
const FAMILY_LABELS: Record<string, string> = {
  car: "Cars",
  motorcycle: "Motorcycles",
  phone: "Phones",
  tablet: "Tablets",
  smartwatch: "Smart Watches",
};

export function familyLabel(family: string): string {
  return FAMILY_LABELS[family] ?? family;
}

/**
 * Fold only consecutive rows sharing a label (web's `foldRows`). A repeated
 * label separated by another label stays a separate entry.
 */
export function foldSpecRows(rows: ProductSpecRow[]): FoldedSpecRow[] {
  const folded: FoldedSpecRow[] = [];
  for (const row of rows) {
    const last = folded[folded.length - 1];
    if (last && last.label === row.label) last.values.push(row.value);
    else folded.push({ label: row.label, values: [row.value] });
  }
  return folded;
}

/** First `Fuel`/`Fuel Type` row value, matching web's powertrain chip. */
export function fuelTypeOf(groups: ProductSpecGroup[]): string | null {
  for (const group of groups) {
    for (const row of group.rows) {
      if (/^fuel(?:\s+type)?$/i.test(row.label.trim())) return row.value;
    }
  }
  return null;
}
