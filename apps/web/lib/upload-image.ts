import {
  MAX_SOURCE_BYTES,
  RECODE_QUALITY,
  resolveUploadMime,
  shouldReencode,
  targetDimensions,
} from "./upload";

/** What the picker uploads after the browser has prepared it. */
export interface PreparedUpload {
  file: File;
  mime: string;
  /** True when the bytes were re-encoded (not merely resized). */
  reencoded: boolean;
}

export class UploadRejected extends Error {
  constructor(public readonly reason: "unsupported-type" | "too-large") {
    super(reason);
    this.name = "UploadRejected";
  }
}

/** How long an uploaded object may be cached; the name carries a UUID. */
export const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

/**
 * Turns a picked file into what we actually want to store: type-checked,
 * size-gated, long side capped at `MAX_STORED_LONG_SIDE`, and re-encoded to
 * WebP when the browser can (q85; a small WebP is left alone, and nothing is
 * ever upscaled).
 *
 * Two rules matter more than the code:
 *
 * - **Never store more than a surface can show.** A 4000 px phone photo is
 *   4× the detail the hero or the lightbox can use, and it costs the uploader,
 *   the bucket and every viewer.
 * - **Never fail an upload because the optimizer failed.** `createImageBitmap`
 *   and `toBlob` are best-effort: on any error the original file is uploaded
 *   unchanged, so a browser without WebP encoding (or an exotic source the
 *   canvas refuses) still works — that is what the bucket's allow-list and the
 *   backend's magic-byte check are for.
 */
export async function prepareImageForUpload(
  file: File,
): Promise<PreparedUpload> {
  const mime = resolveUploadMime(file);
  if (!mime) throw new UploadRejected("unsupported-type");
  if (file.size > MAX_SOURCE_BYTES) throw new UploadRejected("too-large");

  const bitmap = await decode(file);
  if (!bitmap) return { file, mime, reencoded: false };

  try {
    const target = targetDimensions(bitmap.width, bitmap.height);
    if (target.width === 0) return { file, mime, reencoded: false };

    const reencoded = shouldReencode({
      width: bitmap.width,
      height: bitmap.height,
      mime,
      canEncodeWebp: true,
    });
    if (!reencoded) return { file, mime, reencoded: false };

    const blob = await encode(bitmap, target.width, target.height, mime);
    if (!blob) return { file, mime, reencoded: false };

    return {
      file: new File([blob], withWebpExtension(file.name), {
        type: blob.type,
        lastModified: file.lastModified,
      }),
      mime: blob.type,
      reencoded: true,
    };
  } catch {
    return { file, mime, reencoded: false };
  } finally {
    if ("close" in bitmap) bitmap.close();
  }
}

async function decode(
  file: File,
): Promise<ImageBitmap | HTMLImageElement | null> {
  try {
    if (typeof createImageBitmap === "function")
      return await createImageBitmap(file);
  } catch {
    // Fall through to the <img> path (Safari before 17 rejects some blobs).
  }
  try {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.src = url;
    await image.decode();
    URL.revokeObjectURL(url);
    return image;
  } catch {
    return null;
  }
}

async function encode(
  source: ImageBitmap | HTMLImageElement,
  width: number,
  height: number,
  sourceMime: string,
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(source, 0, 0, width, height);

  // GIF loses its animation on a canvas, so it is resized only when it must
  // be — and then as PNG (the animation is what the user picked).
  const type = sourceMime === "image/gif" ? "image/png" : "image/webp";
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob((blob) => resolve(blob), type, RECODE_QUALITY),
  );
}

function withWebpExtension(name: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  return `${base || "image"}.webp`;
}
