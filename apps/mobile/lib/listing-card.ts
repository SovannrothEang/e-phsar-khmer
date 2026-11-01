import type { ListingDetail } from "@/lib/api/listings";
import {
  basePrice,
  finalPrice,
  formatListingDate,
  shortLocation,
} from "@/lib/listings";
import type { Product } from "@/types/product";

function text(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const result = String(value).trim();
  return result === "" ? undefined : result;
}

/**
 * Adapts a feed row to the card view-model the browse screens already render.
 * The card keeps the listing id so its press opens the real detail.
 */
export function toCardProduct(listing: ListingDetail): Product {
  const attributes = listing.attributes ?? {};
  const photos = [...(listing.photos ?? [])]
    .sort((a, b) => a.sort - b.sort)
    .map((photo) => photo.url)
    .filter(Boolean);
  const base = basePrice(listing);
  const final = finalPrice(listing);

  return {
    id: listing.id,
    title: listing.title,
    image: photos[0] ?? null,
    images: photos.slice(1),
    date: formatListingDate(listing.publishedAt ?? listing.createdAt),
    distance: "",
    location: shortLocation(listing.location) ?? "",
    condition:
      listing.condition === "new"
        ? "New"
        : listing.condition === "used"
          ? "Used"
          : undefined,
    year: text(attributes.year),
    taxPaper: attributes.taxType === "Tax Paper",
    experienceLevel: text(attributes.experience),
    jobType: text(attributes.jobType),
    price: final,
    oldPrice:
      base !== null && final !== null && final < base ? base : undefined,
    imageCount: photos.length,
    isVerified: Boolean(listing.sellerVerifiedAccount),
    hasFreeDelivery: listing.deliveryFree,
    isFavorite: false,
    type: text(attributes.bodyType) ?? text(attributes.type),
    size: text(attributes.size),
    likes: listing.likeCount ?? 0,
    phones: listing.contactPhones,
    fullAddress: listing.address ?? undefined,
  };
}
