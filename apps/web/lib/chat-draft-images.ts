/**
 * In-memory registry for chat draft images.
 *
 * Flow: pick image → File kept here + object URL for preview → on send →
 * upload to Supabase → cleanup.
 *
 * Deliberately NOT localStorage: its ~5 MB per-origin quota (and base64's
 * 33% overhead) fits barely one phone photo, so the 5-image limit could never
 * actually be reached. Drafts were wiped on `beforeunload` anyway, so
 * persistence bought nothing.
 */

const drafts = new Map<string, { file: File; previewUrl: string }>();

export interface DraftImage {
  key: string;
  previewUrl: string;
}

/** Register a picked file; returns its key + an object URL for preview. */
export function storeDraftImage(file: File): DraftImage {
  const key = `chat-draft:${crypto.randomUUID()}`;
  const previewUrl = URL.createObjectURL(file);
  drafts.set(key, { file, previewUrl });
  return { key, previewUrl };
}

export function getDraftFile(key: string): File | null {
  return drafts.get(key)?.file ?? null;
}

export function getDraftPreviewUrl(key: string): string | null {
  return drafts.get(key)?.previewUrl ?? null;
}

/** Remove a single draft and release its object URL. */
export function removeDraftImage(key: string): void {
  const entry = drafts.get(key);
  if (!entry) return;
  URL.revokeObjectURL(entry.previewUrl);
  drafts.delete(key);
}

/** Remove ALL draft images. */
export function clearAllDrafts(): void {
  for (const key of Array.from(drafts.keys())) removeDraftImage(key);
}
