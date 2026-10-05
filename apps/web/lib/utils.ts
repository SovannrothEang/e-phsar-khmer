import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // remove special chars
    .replace(/\s+/g, "-") // spaces to hyphens
    .replace(/-+/g, "-"); // collapse multiple hyphens
}

/**
 * The listing `price` is the ORIGINAL (what the seller entered); a discount
 * applies on top. Returns the final price shown as the bold red amount:
 * percent → price × (1 - v/100); amount → price - v; no discount → price.
 */
export function applyDiscount(
  price: number,
  discountValue: string | null,
  discountType: "percent" | "amount" | null,
): number {
  if (discountValue === null || discountType === null) return price;
  const v = Number(discountValue);
  if (!Number.isFinite(v) || v <= 0) return price;
  if (discountType === "percent") {
    if (v >= 100) return 0;
    return Math.round(price * (1 - v / 100) * 100) / 100;
  }
  return Math.max(0, Math.round((price - v) * 100) / 100);
}

/**
 * The card-sized location line.
 *
 * The post picker stores the location largest → smallest
 * (`province, district, commune` — `placeLabel` in LocationPicker), while the
 * cards and the detail's ID row read `district, province` in the design. So
 * drop everything below the district and swap the first two levels; a
 * single-level value ("Phnom Penh") passes through untouched, and an empty one
 * stays undefined so callers can fall back instead of printing a blank line.
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
