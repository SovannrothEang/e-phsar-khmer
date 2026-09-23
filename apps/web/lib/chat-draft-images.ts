/**
 * localStorage manager for chat draft images.
 *
 * Flow: pick image → base64 in localStorage → on send → upload to Supabase → cleanup.
 *
 * Keys follow pattern `chat-draft:{tempId}:{index}` for easy prefix scan/cleanup.
 */

const PREFIX = "chat-draft:";
const MAX_STORED_BYTES = 5 * 1024 * 1024; // 5MB source file limit

// ── Helpers ──────────────────────────────────────────────────────────────────

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/** Estimate base64 storage cost: raw size × 1.33 + ~100 bytes for data-url header. */
function estimateStoredSize(file: File): number {
  return Math.ceil(file.size * 1.33) + 100;
}

/** Bytes remaining before hitting a safe 4.5 MB ceiling (localStorage is 5 MB). */
function remainingQuota(): number {
  let used = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX)) {
      used += (localStorage.getItem(key) ?? "").length * 2; // UTF-16
    }
  }
  const SAFE_LIMIT = 4.5 * 1024 * 1024;
  return Math.max(0, SAFE_LIMIT - used);
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface DraftImage {
  key: string;
  dataUrl: string;
}

/**
 * Store a file in localStorage as base64.
 * Returns the key + dataUrl for immediate preview.
 * Throws if quota would be exceeded.
 */
export async function storeDraftImage(
  tempId: string,
  index: number,
  file: File,
): Promise<DraftImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("File is not an image");
  }
  if (file.size > MAX_STORED_BYTES) {
    throw new Error("Image exceeds 5 MB limit");
  }
  const estimated = estimateStoredSize(file);
  if (estimated > remainingQuota()) {
    throw new Error("localStorage quota exceeded — try a smaller image");
  }

  const dataUrl = await fileToDataUrl(file);
  const key = `${PREFIX}${tempId}:${index}`;
  localStorage.setItem(key, dataUrl);
  return { key, dataUrl };
}

/** Read all draft images across all conversations. */
export function getAllDraftImages(): DraftImage[] {
  const result: DraftImage[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX)) {
      const dataUrl = localStorage.getItem(key);
      if (dataUrl) result.push({ key, dataUrl });
    }
  }
  return result;
}

/** Read draft images for a specific tempId (one message's attachments). */
export function getDraftImages(tempId: string): DraftImage[] {
  const prefix = `${PREFIX}${tempId}:`;
  const result: DraftImage[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) {
      const dataUrl = localStorage.getItem(key);
      if (dataUrl) result.push({ key, dataUrl });
    }
  }
  return result.sort((a, b) => a.key.localeCompare(b.key));
}

/** Remove a single draft entry. */
export function removeDraftImage(key: string): void {
  localStorage.removeItem(key);
}

/** Remove all draft images for a given tempId. */
export function clearDraftImages(tempId: string): void {
  const prefix = `${PREFIX}${tempId}:`;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  keys.forEach((k) => localStorage.removeItem(k));
}

/** Remove ALL draft images (used on beforeunload). */
export function clearAllDrafts(): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX)) keys.push(key);
  }
  keys.forEach((k) => localStorage.removeItem(k));
}

/**
 * Extract a File from a dataUrl stored in localStorage.
 * Used when uploading to Supabase at send-time.
 */
export function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
  const bytes = atob(data);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    arr[i] = bytes.charCodeAt(i);
  }
  return new File([arr], filename, { type: mime });
}
