/**
 * Rules the web form applies on top of `field_schema`. The seed's `required`
 * flag disagrees with the shipped design, so required-ness is a hardcoded list
 * here exactly as it is in `ListingPostForm`.
 */
export const REQUIRED_FIELD_KEYS = new Set([
  "title",
  "brand",
  "year",
  "taxType",
  "condition",
  "color",
  "price",
  "description",
  "location",
  "address",
  "contactName",
  "contactPhones",
  "accessory",
  "network",
  "jobType",
  "experience",
]);

/** Storage is required on computers, not on phones. */
export const STORAGE_REQUIRED_SUBCATEGORIES = new Set([
  "laptops",
  "desktops",
  "all-in-one",
]);

/** Attribute-set type that backs each managed picker key. */
export const SET_FOR_KEY: Record<string, string> = {
  type: "types",
  accessory: "accessories",
  network: "networks",
  jobType: "jobtypes",
  experience: "experiences",
  color: "colors",
  bodyType: "bodytypes",
  vehicleType: "vehicletypes",
  engineType: "enginetypes",
  bedroom: "bedrooms",
  bathroom: "bathrooms",
  facing: "facings",
};

/** Spec-page family per posting subcategory (the five `productSpec` forms). */
export const FAMILY_BY_SUBCATEGORY: Record<string, string> = {
  "cars-for-sale": "car",
  "motorcycles-for-sale": "motorcycle",
  phones: "phone",
  tablets: "tablet",
  "smart-watches": "smartwatch",
};

/**
 * Schema keys with their own top-level column or a dedicated block; they never
 * ride in `attributes`.
 */
export const NON_ATTRIBUTE_KEYS = new Set([
  "photos",
  "title",
  "price",
  "discount",
  "discountType",
  "description",
  "location",
  "address",
  "deliveryFree",
  "contactName",
  "contactPhones",
  "contactEmail",
  "productSpec",
  "condition",
]);

const LABELS: Record<string, string> = {
  brand: "Brand",
  model: "Model",
  year: "Year",
  color: "Color",
  taxType: "Tax Type",
  condition: "Condition",
  bodyType: "Body Type",
  vehicleType: "Vehicle Type",
  engineType: "Engine Type",
  transmission: "Transmission",
  type: "Type",
  accessory: "Accessory",
  network: "Network",
  jobType: "Job Type",
  experience: "Experience",
  screenSize: "Screen Size",
  storage: "Storage",
  ram: "RAM",
  cpu: "CPU",
  vga: "VGA",
  bedroom: "Bedroom",
  bathroom: "Bathroom",
  facing: "Facing",
  size: "Size",
  productSpec: "Product Specification",
};

export function fieldLabel(key: string, provided?: string): string {
  return provided || LABELS[key] || key;
}

export function isFieldRequired(
  key: string,
  subcategorySlug: string,
  schemaKeys: Set<string>,
): boolean {
  if (!schemaKeys.has(key)) return false;
  if (key === "storage") {
    return STORAGE_REQUIRED_SUBCATEGORIES.has(subcategorySlug);
  }
  return REQUIRED_FIELD_KEYS.has(key);
}

/** One key per create attempt; a manual retry must reuse it. */
export function makeIdempotencyKey(): string {
  const hex = (length: number) =>
    Array.from(
      { length },
      () => "0123456789abcdef"[Math.floor(Math.random() * 16)],
    ).join("");
  return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
}
