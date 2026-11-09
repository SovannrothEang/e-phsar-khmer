import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { listings } from '../db/schema/listings.schema';

export const NEARBY_RADIUS_KM_DEFAULT = 10;
export const NEARBY_RADIUS_KM_MIN = 1;
export const NEARBY_RADIUS_KM_MAX = 50;
export const NEARBY_LIMIT_DEFAULT = 8;
export const NEARBY_LIMIT_MAX = 24;

/**
 * Slightly under the 111.195 km implied by the 6371 km Haversine radius, so
 * the box is a superset of the circle for ordinary origins (a narrower box
 * would wrongly drop rows at the edge). A circle that contains a pole spans
 * every longitude, which one interval cannot represent; the box is not relied
 * on for correctness there because the exact distance condition still runs.
 */
const KM_PER_DEGREE = 111.0;

/** A cheap prefilter; the exact Haversine check still runs after it. */
export interface NearbyBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  /** The longitude range crosses ±180; callers must drop that prefilter. */
  lngWraps: boolean;
}

export function nearbyBoundingBox(
  lat: number,
  lng: number,
  radiusKm: number,
): NearbyBox {
  const latDelta = radiusKm / KM_PER_DEGREE;
  // Longitude degrees shrink towards the poles; clamp so a near-polar origin
  // produces a full-width box instead of Infinity.
  const cosLat = Math.max(0.000001, Math.cos((lat * Math.PI) / 180));
  const lngDelta = Math.min(180, radiusKm / (KM_PER_DEGREE * cosLat));
  const rawMinLng = lng - lngDelta;
  const rawMaxLng = lng + lngDelta;
  return {
    minLat: Math.max(-90, lat - latDelta),
    maxLat: Math.min(90, lat + latDelta),
    minLng: Math.max(-180, rawMinLng),
    maxLng: Math.min(180, rawMaxLng),
    lngWraps: rawMinLng < -180 || rawMaxLng > 180,
  };
}

/**
 * Great-circle distance in km between an origin point and a listing's
 * coordinates, as SQL.
 *
 * `latitude`/`longitude` are `numeric`, and Postgres has no trig overloads for
 * numeric, so both are cast to float8. The `asin` argument is clamped to 1
 * because floating-point error can push `sqrt(a)` just above 1 for distant
 * points. Rows with a NULL coordinate evaluate to NULL and are excluded by the
 * service's NOT NULL guard.
 */
export function nearbyDistanceKmSql(lat: number, lng: number): SQL<number> {
  return sql<number>`6371 * 2 * asin(least(1, sqrt(
    power(sin(radians(${listings.latitude}::float8 - ${lat}) / 2), 2)
    + cos(radians(${lat})) * cos(radians(${listings.latitude}::float8))
      * power(sin(radians(${listings.longitude}::float8 - ${lng}) / 2), 2)
  )))`;
}
