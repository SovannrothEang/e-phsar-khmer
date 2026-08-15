export type AttributeType = {
  type: string;
  title: string;
  hasImage: boolean;
  /** Type is generated/read-only — hides Add/Edit/Delete in the admin UI. */
  readOnly?: boolean;
};

/**
 * Single source of truth for the admin attribute pages.
 *
 * Only the types an admin actually manages are listed here, per the spec
 * image map: bodytypes/accessories/jobtypes/types carry images (admin must
 * upload them), networks is Cambodia-market-specific (Cellcard/Metfone/Smart
 * change over time), and years is generated automatically. The plain
 * spec-fixed enumerations (colors, rams, cpus, storages, screensizes, vgas,
 * enginetypes, vehicletypes, bedrooms, bathrooms, facings, experiences) are
 * still seeded backend-side but need no admin management.
 *
 * Order matters: the dashboard/attributes index hub renders these links in order.
 */
export const ATTRIBUTE_TYPES: AttributeType[] = [
  { type: "bodytypes", title: "Body Types", hasImage: true },
  { type: "accessories", title: "Accessories", hasImage: true },
  { type: "jobtypes", title: "Job Types", hasImage: true },
  { type: "types", title: "Types", hasImage: true },
  { type: "networks", title: "Networks", hasImage: true },
  { type: "years", title: "Years", hasImage: false, readOnly: true },
] as const;
