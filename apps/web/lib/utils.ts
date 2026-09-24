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
