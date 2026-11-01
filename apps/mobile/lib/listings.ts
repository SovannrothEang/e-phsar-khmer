import type { ListingDetail } from "@/lib/api/listings";
import { SITE_URL } from "@/lib/site";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Mirrors web's `toSlug` so share URLs land on the same route. */
export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * The stored `price` is the seller's original; a discount applies on top.
 * Same arithmetic as web's `applyDiscount`.
 */
export function applyDiscount(
  price: number,
  discountValue: string | null,
  discountType: "percent" | "amount" | null,
): number {
  if (discountValue === null || discountType === null) return price;
  const value = Number(discountValue);
  if (!Number.isFinite(value) || value <= 0) return price;
  if (discountType === "percent") {
    if (value >= 100) return 0;
    return Math.round(price * (1 - value / 100) * 100) / 100;
  }
  return Math.max(0, Math.round((price - value) * 100) / 100);
}

export function basePrice(listing: ListingDetail): number | null {
  if (listing.price === null) return null;
  const value = Number(listing.price);
  return Number.isFinite(value) ? value : null;
}

export function finalPrice(listing: ListingDetail): number | null {
  const base = basePrice(listing);
  if (base === null) return null;
  return applyDiscount(base, listing.discountValue, listing.discountType);
}

/** "$30,000" (no cents when they are zero). */
export function formatMoney(value: number): string {
  const [whole, fraction] = value.toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction === "00" ? `$${grouped}` : `$${grouped}.${fraction}`;
}

export function formatListingDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${MONTHS[date.getMonth()]} ${String(date.getDate()).padStart(2, "0")}, ${date.getFullYear()}`;
}

/**
 * Card-sized location: the picker stores `province, district, commune`, while
 * cards read `district, province` (same rule as web's `shortLocation`).
 */
export function shortLocation(
  location: string | null | undefined,
): string | undefined {
  const parts = (location ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return undefined;
  if (parts.length === 1) return parts[0];
  return `${parts[1]}, ${parts[0]}`;
}

export function listingShareUrl(listing: ListingDetail): string {
  return `${SITE_URL}/${toSlug(listing.title)}-adid-${listing.id}`;
}

/** "c***@gmail.com" — the domain stays readable, like web's detail. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1) || "*"}***@${domain}`;
}

export function mapsUrl(listing: ListingDetail): string | null {
  if (!listing.latitude || !listing.longitude) return null;
  return `https://www.google.com/maps?q=${listing.latitude},${listing.longitude}`;
}

export interface SpecRow {
  label: string;
  value: string;
}

const ATTR_PRIORITY = [
  "year",
  "taxType",
  "bodyType",
  "vehicleType",
  "engineType",
  "transmission",
  "color",
  "jobType",
  "experience",
  "bedroom",
  "bathroom",
  "facing",
  "size",
  "type",
  "accessory",
  "screenSize",
  "storage",
  "ram",
  "cpu",
  "vga",
  "network",
];

const LABELS: Record<string, string> = {
  taxType: "Tax Type",
  ram: "RAM",
  cpu: "CPU",
  vga: "VGA",
  screenSize: "Screen Size",
  bodyType: "Body Type",
  vehicleType: "Vehicle Type",
  engineType: "Engine Type",
  jobType: "Job Type",
};

function humanizeKey(key: string): string {
  if (LABELS[key]) return LABELS[key];
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

function formatValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    const parts = value.map((entry) => String(entry).trim()).filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : null;
  }
  if (typeof value === "object") return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const text = String(value).trim();
  return text === "" ? null : text;
}

/**
 * Detail specs in web's reading order: category, brand/model, condition, then
 * the known attribute keys, then anything else the form stored.
 */
export function buildSpecRows(
  listing: ListingDetail,
  categoryName?: string,
  subcategoryName?: string,
): SpecRow[] {
  const attributes = listing.attributes ?? {};
  const rows: SpecRow[] = [];

  if (categoryName) rows.push({ label: "Main Category", value: categoryName });
  if (subcategoryName) rows.push({ label: "Category", value: subcategoryName });

  const brand = formatValue(attributes.brand);
  const model = formatValue(attributes.model);
  if (brand) rows.push({ label: "Brand", value: brand });
  if (model) rows.push({ label: "Model", value: model });

  if (listing.condition) {
    rows.push({
      label: "Condition",
      value: listing.condition === "new" ? "New" : "Used",
    });
  }

  const seen = new Set<string>(["brand", "model"]);
  for (const key of ATTR_PRIORITY) {
    seen.add(key);
    const value = formatValue(attributes[key]);
    if (value) rows.push({ label: humanizeKey(key), value });
  }

  for (const key of Object.keys(attributes).sort()) {
    if (seen.has(key)) continue;
    const value = formatValue(attributes[key]);
    if (value) rows.push({ label: humanizeKey(key), value });
  }

  return rows;
}
