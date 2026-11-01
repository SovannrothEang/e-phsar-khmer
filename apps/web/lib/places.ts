/** Display name for a geography row: Khmer on km, falling back to English. */
export function placeDisplayName(
  place: { name: string; nameKm?: string | null },
  locale: string,
): string {
  return locale === "km" && place.nameKm ? place.nameKm : place.name;
}
