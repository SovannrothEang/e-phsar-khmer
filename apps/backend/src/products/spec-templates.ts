import { BadRequestException } from '@nestjs/common';
import type { ProductSpecFamily } from '../db/schema/products.schema';

/** One labelled input on a family template. */
export interface ProductSpecTemplateField {
  key: string;
  label: string;
}

/** A named, ordered section ("Display", "Engine & Transmission", …). */
export interface ProductSpecTemplateSection {
  key: string;
  title: string;
  fields: ProductSpecTemplateField[];
}

/** A family's page structure, owned by the backend. */
export interface ProductSpecTemplate {
  family: ProductSpecFamily;
  label: string;
  /** The listing subcategory whose models (and ads) belong to this family. */
  subcategorySlug: string;
  /**
   * `template` families fill a fixed list of sections; `freeform` families
   * (Cars, Motorcycles) let staff add any group/row, so `sections` is empty.
   */
  mode: 'template' | 'freeform';
  sections: ProductSpecTemplateSection[];
}

export const FAMILY_SUBCATEGORY_SLUG: Record<ProductSpecFamily, string> = {
  car: 'cars-for-sale',
  motorcycle: 'motorcycles-for-sale',
  phone: 'phones',
  tablet: 'tablets',
  smartwatch: 'smart-watches',
};

/** Phones and tablets share this skeleton (gsmarena uses the same one). */
const deviceSections: ProductSpecTemplateSection[] = [
  {
    key: 'network',
    title: 'Network',
    fields: [
      { key: 'technology', label: 'Technology' },
      { key: 'bands2g', label: '2G bands' },
      { key: 'bands3g', label: '3G bands' },
      { key: 'bands4g', label: '4G bands' },
      { key: 'bands5g', label: '5G bands' },
      { key: 'speed', label: 'Speed' },
    ],
  },
  {
    key: 'launch',
    title: 'Launch',
    fields: [
      { key: 'announced', label: 'Announced' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    key: 'body',
    title: 'Body',
    fields: [
      { key: 'dimensions', label: 'Dimensions' },
      { key: 'weight', label: 'Weight' },
      { key: 'build', label: 'Build' },
      { key: 'sim', label: 'SIM' },
    ],
  },
  {
    key: 'display',
    title: 'Display',
    fields: [
      { key: 'type', label: 'Type' },
      { key: 'size', label: 'Size' },
      { key: 'resolution', label: 'Resolution' },
      { key: 'protection', label: 'Protection' },
    ],
  },
  {
    key: 'platform',
    title: 'Platform',
    fields: [
      { key: 'os', label: 'OS' },
      { key: 'chipset', label: 'Chipset' },
      { key: 'cpu', label: 'CPU' },
      { key: 'gpu', label: 'GPU' },
    ],
  },
  {
    key: 'memory',
    title: 'Memory',
    fields: [
      { key: 'cardSlot', label: 'Card slot' },
      { key: 'internal', label: 'Internal' },
    ],
  },
  {
    key: 'main-camera',
    title: 'Main Camera',
    fields: [
      { key: 'mainCameraModules', label: 'Modules' },
      { key: 'mainCameraFeatures', label: 'Features' },
      { key: 'mainCameraVideo', label: 'Video' },
    ],
  },
  {
    key: 'selfie-camera',
    title: 'Selfie Camera',
    fields: [
      { key: 'selfieCameraModules', label: 'Modules' },
      { key: 'selfieCameraFeatures', label: 'Features' },
      { key: 'selfieCameraVideo', label: 'Video' },
    ],
  },
  {
    key: 'sound',
    title: 'Sound',
    fields: [
      { key: 'loudspeaker', label: 'Loudspeaker' },
      { key: 'jack35mm', label: '3.5mm jack' },
    ],
  },
  {
    key: 'comms',
    title: 'Comms',
    fields: [
      { key: 'wlan', label: 'WLAN' },
      { key: 'bluetooth', label: 'Bluetooth' },
      { key: 'positioning', label: 'Positioning' },
      { key: 'nfc', label: 'NFC' },
      { key: 'radio', label: 'Radio' },
      { key: 'usb', label: 'USB' },
    ],
  },
  {
    key: 'features',
    title: 'Features',
    fields: [{ key: 'sensors', label: 'Sensors' }],
  },
  {
    key: 'battery',
    title: 'Battery',
    fields: [
      { key: 'batteryType', label: 'Type' },
      { key: 'charging', label: 'Charging' },
    ],
  },
  {
    key: 'misc',
    title: 'Misc',
    fields: [
      { key: 'colors', label: 'Colors' },
      { key: 'models', label: 'Models' },
      { key: 'price', label: 'Price' },
    ],
  },
];

const smartwatchSections: ProductSpecTemplateSection[] = [
  deviceSections[0], // Network
  deviceSections[1], // Launch
  deviceSections[2], // Body
  deviceSections[3], // Display
  deviceSections[4], // Platform
  deviceSections[5], // Memory
  {
    key: 'sound',
    title: 'Sound',
    fields: [{ key: 'loudspeaker', label: 'Loudspeaker' }],
  },
  {
    key: 'comms',
    title: 'Comms',
    fields: [
      { key: 'wlan', label: 'WLAN' },
      { key: 'bluetooth', label: 'Bluetooth' },
      { key: 'positioning', label: 'Positioning' },
      { key: 'nfc', label: 'NFC' },
      { key: 'usb', label: 'USB' },
    ],
  },
  deviceSections[10], // Features
  deviceSections[11], // Battery
  deviceSections[12], // Misc
];

export const PRODUCT_SPEC_TEMPLATES: Record<
  ProductSpecFamily,
  ProductSpecTemplate
> = {
  car: {
    family: 'car',
    label: 'Cars',
    subcategorySlug: FAMILY_SUBCATEGORY_SLUG.car,
    mode: 'freeform',
    sections: [],
  },
  motorcycle: {
    family: 'motorcycle',
    label: 'Motorcycles',
    subcategorySlug: FAMILY_SUBCATEGORY_SLUG.motorcycle,
    mode: 'freeform',
    sections: [],
  },
  phone: {
    family: 'phone',
    label: 'Phones',
    subcategorySlug: FAMILY_SUBCATEGORY_SLUG.phone,
    mode: 'template',
    sections: deviceSections,
  },
  tablet: {
    family: 'tablet',
    label: 'Tablets',
    subcategorySlug: FAMILY_SUBCATEGORY_SLUG.tablet,
    mode: 'template',
    sections: deviceSections,
  },
  smartwatch: {
    family: 'smartwatch',
    label: 'Smart Watches',
    subcategorySlug: FAMILY_SUBCATEGORY_SLUG.smartwatch,
    mode: 'template',
    sections: smartwatchSections,
  },
};

const SUBCATEGORY_FAMILY = Object.fromEntries(
  Object.entries(FAMILY_SUBCATEGORY_SLUG).map(([family, slug]) => [
    slug,
    family,
  ]),
) as Record<string, ProductSpecFamily>;

/** The family whose listing form a subcategory belongs to (null = none). */
export function getFamilyForSubcategorySlug(
  slug: string,
): ProductSpecFamily | null {
  return SUBCATEGORY_FAMILY[slug] ?? null;
}

/** Throws for an unknown family — the route/DTO already reject bad values. */
export function getProductSpecTemplate(
  family: ProductSpecFamily,
): ProductSpecTemplate {
  const template = PRODUCT_SPEC_TEMPLATES[family];
  if (!template) {
    throw new BadRequestException(`Unknown product spec family: ${family}`);
  }
  return template;
}

/**
 * True when a stored group is a filled subset of one template section: the
 * title matches, every row label belongs to that section, and no label repeats.
 * Anything else is a legacy/freeform group the update path grandfathers as-is.
 */
export function isTemplateGroup(
  family: ProductSpecFamily,
  group: { title: string; rows: { label: string }[] },
): boolean {
  if (group.rows.length === 0) return false;
  const section = getProductSpecTemplate(family).sections.find(
    (candidate) => candidate.title === group.title,
  );
  if (!section) return false;
  const labels = group.rows.map((row) => row.label);
  if (new Set(labels).size !== labels.length) return false;
  const allowed = new Set(section.fields.map((field) => field.label));
  return labels.every((label) => allowed.has(label));
}

/** Order-sensitive identity used to grandfather stored legacy groups. */
export function groupSignature(group: {
  title: string;
  rows: { label: string }[];
}): string {
  return `${group.title}\u0000${group.rows
    .map((row) => row.label)
    .join('\u0000')}`;
}
