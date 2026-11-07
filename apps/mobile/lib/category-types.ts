import type { AttributeSummary } from "@/lib/api/catalog";

/** The admin-managed attribute sets that act as a "type" tile list. */
export const TYPE_SETS: { set: string; key: string }[] = [
  { set: "types", key: "type" },
  { set: "bodytypes", key: "bodyType" },
  { set: "vehicletypes", key: "vehicleType" },
  { set: "jobtypes", key: "jobType" },
  { set: "accessories", key: "accessory" },
  { set: "networks", key: "network" },
];

export interface TypeTiles {
  /** Attribute key the tile filter writes (`bodyType`, `type`, …). */
  key: string;
  rows: { id: string; name: string; image: string | null }[];
}

/**
 * Picks the tile set a subcategory uses for its "type" row: the first set that
 * the field schema exposes and that actually has rows attached.
 */
export function resolveTypeTiles(
  attributes: AttributeSummary[],
  fieldSchema: { key: string }[] | null | undefined,
): TypeTiles | null {
  const schemaKeys = new Set((fieldSchema ?? []).map((field) => field.key));
  const candidate = TYPE_SETS.find(
    (entry) =>
      schemaKeys.has(entry.key) &&
      attributes.some((row) => row.type === entry.set),
  );
  if (!candidate) return null;
  return {
    key: candidate.key,
    rows: attributes
      .filter((row) => row.type === candidate.set)
      .map((row) => ({ id: row.slug, name: row.name, image: row.image })),
  };
}
