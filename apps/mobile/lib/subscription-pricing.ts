import type { SubscriptionCatalogItem } from "@/lib/api/subscriptions";

/** The payable amount after the term's discount. */
export function finalPrice(
  item: Pick<SubscriptionCatalogItem, "price" | "discount" | "discountType">,
): number {
  const price = Number(item.price);
  if (!Number.isFinite(price)) return 0;
  const discount = Number(item.discount);
  if (!Number.isFinite(discount) || discount <= 0) return price;
  const net =
    item.discountType === "percent"
      ? price * (1 - discount / 100)
      : price - discount;
  return Math.max(0, net);
}

/** `$80` for whole dollars, `$79.50` otherwise. */
export function money(value: number): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function discountBadge(
  item: Pick<SubscriptionCatalogItem, "discount" | "discountType">,
): string | null {
  const discount = Number(item.discount);
  if (!Number.isFinite(discount) || discount <= 0) return null;
  return item.discountType === "percent"
    ? `-${discount}%`
    : `-${money(discount)}`;
}

/** "18, Oct 2026" — today plus the term's duration. */
export function validUntil(
  durationValue: number,
  durationUnit: SubscriptionCatalogItem["durationUnit"],
): string {
  const date = new Date();
  if (durationUnit === "year") {
    date.setFullYear(date.getFullYear() + durationValue);
  } else if (durationUnit === "day") {
    date.setDate(date.getDate() + durationValue);
  } else {
    date.setMonth(date.getMonth() + durationValue);
  }
  const day = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "short" });
  return `${day}, ${month} ${date.getFullYear()}`;
}
