/**
 * Phnom Penh — the map view before anything is picked. Kept out of the
 * Leaflet module so client components can read it without pulling `leaflet`
 * (which touches `window` at import time) into server rendering.
 */
export const DEFAULT_CENTER = { lat: 11.5564, lng: 104.9282 };
