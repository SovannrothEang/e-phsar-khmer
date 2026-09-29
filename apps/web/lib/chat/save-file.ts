/**
 * Saves chat media to the user's device as-is — no re-encoding (a second
 * lossy pass buys nothing: WebP opens on every current OS). Phones get the
 * share sheet, the only way iOS Safari offers "Save Image" → Photos; a plain
 * download there opens a new tab instead.
 */

const EXT: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/avif": "avif",
  "application/pdf": "pdf",
};

/** `npic-2026-09-29_15-12-04.webp`, extension from the real content type. */
export function mediaFileName(mime: string, at: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}_` +
    `${pad(at.getHours())}-${pad(at.getMinutes())}-${pad(at.getSeconds())}`;
  return `npic-${stamp}.${EXT[mime] ?? "bin"}`;
}

function isPhone(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(pointer: coarse)").matches === true
  );
}

/** Resolves false only on a real failure; a cancelled share sheet is not one. */
export async function saveBlob(blob: Blob, fileName: string): Promise<boolean> {
  if (isPhone() && typeof navigator.canShare === "function") {
    const file = new File([blob], fileName, { type: blob.type });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return true;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError")
          return true;
        // Share refused (e.g. not a user gesture any more): fall through.
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser time to start reading the blob before revoking it.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return true;
}

/**
 * Save whatever an image URL points at: a `blob:` URL of already-decrypted
 * bytes, or a legacy public image (cross-origin, so `<a download>` alone
 * would be ignored — fetch it into a blob first).
 */
export async function saveFromUrl(
  url: string,
  fileName?: string,
): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const blob = await res.blob();
    return saveBlob(blob, fileName ?? mediaFileName(blob.type));
  } catch {
    return false;
  }
}
