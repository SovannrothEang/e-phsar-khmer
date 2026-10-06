/**
 * Image preparation before encryption (plan D11): decode → resize → re-encode.
 * Re-encoding also strips EXIF (GPS, device model). Runs in a Web Worker when
 * possible (see prepare.ts); this module must stay DOM-free except for the
 * explicit main-thread fallback canvas.
 */

export const IMAGE_MAX_EDGE = 2048;
const THUMB_EDGE = 32;
const QUALITY = 0.8;
const THUMB_QUALITY = 0.5;

export interface PreparedImage {
  bytes: ArrayBuffer;
  mime: string;
  w: number;
  h: number;
  /** base64 of a ~32 px preview. */
  thumb: string;
  thumbMime: string;
}

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;

function makeCanvas(w: number, h: number): AnyCanvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function toBlob(canvas: AnyCanvas, type: string, quality: number) {
  if ("convertToBlob" in canvas)
    return canvas.convertToBlob({ type, quality });
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("encode failed"))),
      type,
      quality,
    ),
  );
}

/** WebP where the browser can encode it (Safari can't), JPEG otherwise. */
async function encode(canvas: AnyCanvas, quality: number): Promise<Blob> {
  const webp = await toBlob(canvas, "image/webp", quality);
  if (webp.type === "image/webp") return webp;
  return toBlob(canvas, "image/jpeg", quality);
}

function draw(bitmap: ImageBitmap, w: number, h: number): AnyCanvas {
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext("2d") as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null;
  if (!ctx) throw new Error("2d context unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas;
}

function fit(w: number, h: number, edge: number): [number, number] {
  const scale = Math.min(1, edge / Math.max(w, h));
  return [Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale))];
}

function bytesToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export async function processImage(file: Blob): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  try {
    const [w, h] = fit(bitmap.width, bitmap.height, IMAGE_MAX_EDGE);
    const full = await encode(draw(bitmap, w, h), QUALITY);
    const [tw, th] = fit(bitmap.width, bitmap.height, THUMB_EDGE);
    const thumb = await encode(draw(bitmap, tw, th), THUMB_QUALITY);
    return {
      bytes: await full.arrayBuffer(),
      mime: full.type,
      w,
      h,
      thumb: bytesToBase64(await thumb.arrayBuffer()),
      thumbMime: thumb.type,
    };
  } finally {
    bitmap.close();
  }
}
