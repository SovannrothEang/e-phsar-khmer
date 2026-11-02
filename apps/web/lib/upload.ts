/**
 * Upload contract shared by every direct-to-Supabase image picker.
 *
 * The bucket keeps its own allow-list, but the browser's `File.type` is not
 * reliable across platforms (`.dng` often arrives as
 * `application/octet-stream`; some systems report `.jpg` as `image/jpg`).
 * Accept by extension and send Storage the canonical MIME instead.
 */
const UPLOAD_MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  dng: "image/x-adobe-dng",
};

const UPLOAD_MIMES = new Set(Object.values(UPLOAD_MIME_BY_EXT));

/** Extensions the pickers advertise; keep in sync with the bucket allow-list. */
export const UPLOAD_ACCEPT = Object.keys(UPLOAD_MIME_BY_EXT)
  .map((ext) => `.${ext}`)
  .join(",");

/** Bucket object cap (50 MB) — must match the `product-images` settings. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/**
 * Canonical Storage Content-Type for a picked file, or `null` when it is not
 * one of the advertised formats. Prefer the extension; fall back to the
 * browser-reported type for extensionless files.
 */
export function resolveUploadMime(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (Object.hasOwn(UPLOAD_MIME_BY_EXT, ext)) return UPLOAD_MIME_BY_EXT[ext];
  return UPLOAD_MIMES.has(file.type) ? file.type : null;
}
