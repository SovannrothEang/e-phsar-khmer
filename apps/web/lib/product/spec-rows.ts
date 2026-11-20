import type { ProductSpecItem } from "@/types/product";

export interface FoldedSpecRow {
  label: string;
  values: string[];
}

/**
 * Fold consecutive rows sharing a label into one entry. A multi-value field
 * (a phone's 4G bands per regional model) is stored as several rows with the
 * same label; the page shows the label once and each value on its own line.
 */
export function foldSpecRows(rows: ProductSpecItem[]): FoldedSpecRow[] {
  const out: FoldedSpecRow[] = [];
  for (const row of rows) {
    const last = out[out.length - 1];
    if (last && last.label === row.label) last.values.push(row.value);
    else out.push({ label: row.label, values: [row.value] });
  }
  return out;
}
