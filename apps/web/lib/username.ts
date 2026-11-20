/**
 * The Settings → Change Username rule, mirroring the backend's
 * `normalizeManualUsername`/`isValidManualUsername` (backend is authoritative):
 * any script's letters/marks/numbers plus `.` `_` `-`, lowercased, trimmed,
 * with repeated and leading/trailing hyphens collapsed away.
 */
export function normalizeManualUsername(value: string): string {
  return value
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .normalize("NFC")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isValidUsername(value: string): boolean {
  const length = Array.from(value).length;
  return length >= 3 && length <= 50 && /^[\p{L}\p{M}\p{N}._-]+$/u.test(value);
}
