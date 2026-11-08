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

/**
 * Source cap for a *new* upload. The bucket allows 50 MB (older objects), but
 * a phone photo over 10 MB is 4000+ px of detail that no surface shows: the
 * detail hero tops out around 760 CSS px and the lightbox opens the stored
 * object at its natural size. Reject above this rather than store detail
 * nothing can display.
 */
export const MAX_SOURCE_BYTES = 10 * 1024 * 1024;

/** Longest side a new upload is stored at (never upscaled). */
export const MAX_STORED_LONG_SIDE = 2560;

/** WebP quality for the re-encode; the plan's benchmark used q≈85. */
export const RECODE_QUALITY = 0.85;

/**
 * The stored pixel size for a source of `width` × `height`: the long side is
 * capped at `MAX_STORED_LONG_SIDE` and the aspect ratio is preserved. A source
 * already inside the cap is returned unchanged, and nothing is ever upscaled —
 * a 400 px avatar must not become a 2560 px object.
 */
export function targetDimensions(
  width: number,
  height: number,
): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };
  const longest = Math.max(width, height);
  if (longest <= MAX_STORED_LONG_SIDE) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  const scale = MAX_STORED_LONG_SIDE / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Whether a picked file has to be re-encoded.
 *
 * - over the long-side cap: yes (resize)
 * - already WebP and inside the cap: no (a second lossy pass only loses
 *   quality, and the file is already the format the optimizer prefers)
 * - anything else: yes, to WebP, when the browser can encode it
 */
export function shouldReencode(input: {
  width: number;
  height: number;
  mime: string;
  canEncodeWebp: boolean;
}): boolean {
  const { width, height, mime, canEncodeWebp } = input;
  const oversized = Math.max(width, height) > MAX_STORED_LONG_SIDE;
  if (!canEncodeWebp) return false;
  if (mime === "image/webp") return oversized;
  return true;
}
