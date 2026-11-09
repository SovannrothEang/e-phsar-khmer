/**
 * Approximate provincial-capital coordinates for the demo catalogue only.
 *
 * The geography seed (`cambodia-geography.json`) carries names, slugs and
 * official codes but no coordinates, so demo ads had none and could never
 * appear in the Nearby read. These are deliberately approximate: they place an
 * ad in its province, which is all the demo data needs. Real ads keep the pin
 * the seller dropped in the post form.
 */
export const PROVINCE_CENTERS: Readonly<
  Record<string, { lat: number; lng: number }>
> = {
  'banteay-meanchey': { lat: 13.65, lng: 103.0 },
  battambang: { lat: 13.09, lng: 103.2 },
  'kampong-cham': { lat: 11.99, lng: 105.46 },
  'kampong-chhnang': { lat: 12.25, lng: 104.67 },
  'kampong-speu': { lat: 11.45, lng: 104.52 },
  'kampong-thom': { lat: 12.71, lng: 104.89 },
  kampot: { lat: 10.61, lng: 104.18 },
  kandal: { lat: 11.5, lng: 105.0 },
  kep: { lat: 10.48, lng: 104.32 },
  'koh-kong': { lat: 11.4, lng: 103.4 },
  kratie: { lat: 12.49, lng: 106.02 },
  mondulkiri: { lat: 12.45, lng: 107.2 },
  'oddar-meanchey': { lat: 14.0, lng: 103.5 },
  pailin: { lat: 12.85, lng: 102.61 },
  'phnom-penh': { lat: 11.5564, lng: 104.9282 },
  'preah-sihanouk': { lat: 10.63, lng: 103.5 },
  'preah-vihear': { lat: 13.8, lng: 104.97 },
  'prey-veng': { lat: 11.49, lng: 105.33 },
  pursat: { lat: 12.54, lng: 103.92 },
  ratanakiri: { lat: 13.74, lng: 107.0 },
  'siem-reap': { lat: 13.36, lng: 103.86 },
  'stung-treng': { lat: 13.52, lng: 105.97 },
  'svay-rieng': { lat: 11.09, lng: 105.8 },
  takeo: { lat: 10.99, lng: 104.78 },
  'tbong-khmum': { lat: 11.9, lng: 105.65 },
};

/**
 * A few pre-existing demo rows use `sihanoukville`, while the geography seed
 * and the live DB call the province `preah-sihanouk`. Normalise here so those
 * ads still get a pin; their provinceId gap is a separate, pre-existing issue.
 */
const PROVINCE_ALIASES: Readonly<Record<string, string>> = {
  sihanoukville: 'preah-sihanouk',
};

/** ~0.9 km per step; keeps same-province ads from sharing one pin. */
const JITTER_STEP = 0.008;

/** FNV-1a over the listing title: same title always gets the same offset. */
function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Coordinates for a demo listing, or null when the row has no province (or an
 * unknown one). The title seed keeps two ads in the same province from
 * sharing a pin; it is deterministic, so a re-seed writes the same values.
 */
export function demoListingCoordinates(
  province: string | undefined,
  seed: string,
): { latitude: string; longitude: string } | null {
  if (!province) return null;
  const center = PROVINCE_CENTERS[PROVINCE_ALIASES[province] ?? province];
  if (!center) return null;
  const hash = hashSeed(seed);
  const latOffset = ((hash % 11) - 5) * JITTER_STEP;
  const lngOffset = ((Math.floor(hash / 11) % 11) - 5) * JITTER_STEP;
  // numeric(10,7); keep the same precision the post form stores.
  return {
    latitude: (center.lat + latOffset).toFixed(7),
    longitude: (center.lng + lngOffset).toFixed(7),
  };
}
