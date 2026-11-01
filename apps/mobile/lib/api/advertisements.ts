import { apiFetch } from "@/lib/api/client";

export type AdvertisementPlacement =
  | "home"
  | "all_ads"
  | "category"
  | "subcategory"
  | "listing_detail";

export interface AdvertisementBanner {
  id: string;
  placement: AdvertisementPlacement;
  imageUrl: string;
  linkUrl: string | null;
  altText: string | null;
  sortOrder: number;
}

/** Public banner slot — active rows only, already ordered by the backend. */
export async function fetchAdvertisements(
  placement: AdvertisementPlacement,
): Promise<AdvertisementBanner[]> {
  const { data } = await apiFetch<AdvertisementBanner[]>(
    `/advertisements?placement=${encodeURIComponent(placement)}`,
    { auth: false },
  );
  return data ?? [];
}
