export type AttributeType = {
  type: string;
  title: string;
  hasImage: boolean;
  /** Type is generated/read-only — hides Add/Edit/Delete in the admin UI. */
  readOnly?: boolean;
};

/**
 * The one exception to the icon design, keyed by MAIN CATEGORY: the sets a
 * category draws as plain text even though the set itself is image-bearing.
 *
 * Today that is exactly Furniture & Decor's Type slice — its rows carry no
 * `image` key at all in the mock, while every other slice of `types` does
 * (property's Flat/House/Villa and Factory/Warehouse/… are drawn with icons
 * too, so Home & Land stays on the icon grid). Keyed by category rather than
 * by subcategory so a new Type link anywhere under furniture cannot silently
 * re-grow icons.
 *
 * It is shared because **two surfaces must agree about it**: the browse page
 * picks text tiles from it, and the post form's `SearchPicker` otherwise
 * decides its design by sniffing the rows (`options.some(o => !!o.image)`) —
 * where the shared `types` "other" row's bundled `/sub-img/…` path, which
 * `DbImage` refuses to render, is enough to flip EVERY row of an otherwise
 * text-designed picker to an empty 24px icon slot. Declaring the design here
 * keeps it a property of the set (captain, 2026-09-10: "the design follows the
 * set, never the load result"), not of whichever row happens to hold a value.
 */
export const TEXT_TILE_SETS_BY_CATEGORY: Record<string, Set<string>> = {
  "furniture-and-decor": new Set(["types"]),
};

/**
 * Single source of truth for the admin attribute pages and the storefront's
 * attribute design (see TEXT_TILE_SETS_BY_CATEGORY above).
 *
 * Only the types an admin actually manages are listed here, per the spec
 * image map: bodytypes/accessories/jobtypes/types carry images (admin must
 * upload them), networks is Cambodia-market-specific (Cellcard/Metfone/Smart
 * change over time), and years is generated automatically. The plain
 * spec-fixed enumerations (colors, rams, cpus, storages, screensizes, vgas,
 * enginetypes, bedrooms, bathrooms, facings, experiences) are still seeded
 * backend-side but need no admin management.
 *
 * Order matters: the dashboard/attributes index hub renders these links in order.
 *
 * CAVEAT (2026-09-15): `vehicletypes` is deliberately NOT listed — the captain
 * decided the second set isn't wanted, and it is being retired in favour of
 * `bodytypes`. Until that lands, Vehicles For Rent's post form still READS
 * `vehicletypes` for its Vehicle Type field, so that list remains live but
 * unmanageable, and ticking/unticking a Body Type row does not affect it.
 */
export const ATTRIBUTE_TYPES: AttributeType[] = [
  { type: "bodytypes", title: "Body Types", hasImage: true },
  // One set serving two families (phone parts + fashion jewellery), kept apart
  // by per-subcategory ticks — the same shape `types` uses across seven
  // families. Admin ticks therefore decide what each family's picker offers,
  // so this page is where a phone part could be mis-ticked into the jewellery
  // list; see attributes.seed.ts for the accepted trade.
  { type: "accessories", title: "Accessories", hasImage: true },
  { type: "jobtypes", title: "Job Types", hasImage: true },
  { type: "types", title: "Types", hasImage: true },
  { type: "networks", title: "Networks", hasImage: true },
  { type: "years", title: "Years", hasImage: false, readOnly: true },
] as const;
