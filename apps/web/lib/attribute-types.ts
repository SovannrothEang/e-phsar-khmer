export type AttributeType = {
  type: string;
  title: string;
  hasImage: boolean;
};

/**
 * Single source of truth for the 18 admin attribute pages.
 * Order matters: the dashboard/attributes index hub renders these links in order.
 */
export const ATTRIBUTE_TYPES: AttributeType[] = [
  { type: "bodytypes", title: "Body Types", hasImage: true },
  { type: "enginetypes", title: "Engine Types", hasImage: false },
  { type: "vehicletypes", title: "Vehicle Types", hasImage: true },
  { type: "accessories", title: "Accessories", hasImage: true },
  { type: "types", title: "Types", hasImage: true },
  { type: "jobtypes", title: "Job Types", hasImage: true },
  { type: "networks", title: "Networks", hasImage: true },
  { type: "bedrooms", title: "Bedrooms", hasImage: false },
  { type: "bathrooms", title: "Bathrooms", hasImage: false },
  { type: "facings", title: "Facings", hasImage: false },
  { type: "experiences", title: "Experiences", hasImage: false },
  { type: "storages", title: "Storages", hasImage: false },
  { type: "screensizes", title: "Screen Sizes", hasImage: false },
  { type: "rams", title: "RAMs", hasImage: false },
  { type: "cpus", title: "CPUs", hasImage: false },
  { type: "vgas", title: "VGAs", hasImage: false },
  { type: "colors", title: "Colors", hasImage: false },
  { type: "years", title: "Years", hasImage: false },
] as const;
