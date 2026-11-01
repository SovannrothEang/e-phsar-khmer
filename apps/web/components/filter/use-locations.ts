"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import {
  getLocationCommunes,
  getLocationDistricts,
  getLocationProvinces,
} from "@/actions/listings";
import type { BackendPlace } from "@/lib/api/categories";
import { placeDisplayName } from "@/lib/places";

/** A row of the public `GET /locations/...` endpoints, localized for the UI. */
export interface Place {
  id: string;
  name: string;
  nameKm?: string | null;
  slug: string;
}

// Geography changes only on a re-seed — cache it for the session.
const STALE = 60 * 60 * 1000;

function localize(rows: BackendPlace[], locale: string): Place[] {
  return rows
    .map((row) => ({ ...row, name: placeDisplayName(row, locale) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

export function useProvinces(enabled = true) {
  const locale = useLocale();
  return useQuery<Place[]>({
    queryKey: ["locations", "provinces", locale],
    queryFn: async () => localize(await getLocationProvinces(), locale),
    staleTime: STALE,
    enabled,
  });
}

export function useDistricts(provinceSlug: string | null | undefined) {
  const locale = useLocale();
  return useQuery<Place[]>({
    queryKey: ["locations", "districts", provinceSlug, locale],
    queryFn: async () =>
      localize(await getLocationDistricts(provinceSlug!), locale),
    staleTime: STALE,
    enabled: !!provinceSlug,
  });
}

export function useCommunes(
  provinceSlug: string | null | undefined,
  districtSlug: string | null | undefined,
) {
  const locale = useLocale();
  return useQuery<Place[]>({
    queryKey: ["locations", "communes", provinceSlug, districtSlug, locale],
    queryFn: async () =>
      localize(await getLocationCommunes(provinceSlug!, districtSlug!), locale),
    staleTime: STALE,
    enabled: !!provinceSlug && !!districtSlug,
  });
}

/** Readable stand-in while a name is still loading: `phnom-penh` → `Phnom Penh`. */
export function slugLabel(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
