export const ATTACHMENT_KINDS = ['image', 'file'] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

export type AttachmentStatus = 'pending' | 'uploaded' | 'attached' | 'expired';

/** Per-kind cap on the encrypted object size. The bucket's own limit is 25 MB. */
export const ATTACHMENT_MAX_BYTES: Record<AttachmentKind, number> = {
  image: 10 * 1024 * 1024,
  file: 25 * 1024 * 1024,
};

/** Keeps the encrypted metadata (≈1 KB thumbnail each) under the 24,000-char body cap. */
export const ATTACHMENTS_PER_MESSAGE_MAX = 10;
export const ATTACHMENT_SIGN_MAX_IDS = 50;
/** Signed download URL lifetime. A leaked URL yields ciphertext only. */
export const ATTACHMENT_DOWNLOAD_TTL_SECONDS = 300;
/** Supabase signed upload URLs are valid for 2 hours. */
export const ATTACHMENT_UPLOAD_TTL_SECONDS = 7200;
/** Unattached uploads older than this are removed by cleanup. */
export const ATTACHMENT_ORPHAN_AGE_HOURS = 24;
