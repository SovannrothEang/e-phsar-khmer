"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getLocationCommunes,
  getLocationDistricts,
  getLocationProvinces,
} from "@/actions/listings";

/** A row of the public `GET /locations/...` endpoints. */
export interface Place {
  id: string;
  name: string;
  slug: string;
}

// Geography changes only on a re-seed — cache it for the session.
const STALE = 60 * 60 * 1000;

export function useProvinces(enabled = true) {
  return useQuery<Place[]>({
    queryKey: ["locations", "provinces"],
    queryFn: () => getLocationProvinces(),
    staleTime: STALE,
    enabled,
  });
}

export function useDistricts(provinceSlug: string | null | undefined) {
  return useQuery<Place[]>({
    queryKey: ["locations", "districts", provinceSlug],
    queryFn: () => getLocationDistricts(provinceSlug!),
    staleTime: STALE,
    enabled: !!provinceSlug,
  });
}

export function useCommunes(
  provinceSlug: string | null | undefined,
  districtSlug: string | null | undefined,
) {
  return useQuery<Place[]>({
    queryKey: ["locations", "communes", provinceSlug, districtSlug],
    queryFn: () => getLocationCommunes(provinceSlug!, districtSlug!),
    staleTime: STALE,
    enabled: !!provinceSlug && !!districtSlug,
  });
}

/** Readable stand-in while a name is still loading: `phnom-penh` → `Phnom Penh`. */
export function slugLabel(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
