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
 * Derive the pre-discount price the mockup renders as the strikethrough
 * amount: for a percent discount, original = price / (1 - v/100); for an
 * amount discount, original = price + v. Undefined when no discount applies.
 */
export function deriveOldPrice(
  price: number,
  discountValue: string | null,
  discountType: "percent" | "amount" | null,
): number | undefined {
  if (discountValue === null || discountType === null) return undefined;
  const v = Number(discountValue);
  if (!Number.isFinite(v) || v <= 0) return undefined;
  if (discountType === "percent") {
    if (v >= 100) return undefined;
    return Math.round((price / (1 - v / 100)) * 100) / 100;
  }
  return Math.round((price + v) * 100) / 100;
}
