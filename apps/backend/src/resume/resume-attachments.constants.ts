/** The CV card's own copy: "doc, DOCX, PDF, txt. (Max size: 5MB)". */
export const RESUME_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;

export type ResumeAttachmentStatus = 'pending' | 'attached' | 'expired';

/** Extensions the picker accepts (the bucket's MIME policy is the outer wall). */
export const RESUME_ATTACHMENT_ALLOWED_EXTENSIONS = [
  'doc',
  'docx',
  'pdf',
  'txt',
] as const;

/**
 * Extension → `Content-Type` for the browser's PUT. Derived from the extension
 * rather than `file.type`: it is empty for `.docx` on many systems, and the
 * bucket policy would reject an empty type. Kept next to the extension list so
 * the two cannot drift (the web client reads the same table).
 */
export const CV_MIME_BY_EXTENSION: Record<string, string> = {
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
  txt: 'text/plain',
};

/** Signed download URL lifetime. A leaked URL reaches one CV for 5 minutes. */
export const RESUME_ATTACHMENT_DOWNLOAD_TTL_SECONDS = 300;

/** Supabase signed upload URLs are valid for 2 hours. */
export const RESUME_ATTACHMENT_UPLOAD_TTL_SECONDS = 7200;

/** Unattached uploads older than this are removed by the cleanup job. */
export const RESUME_ATTACHMENT_ORPHAN_AGE_HOURS = 24;

/** How many uploads a caller may leave unfinished before create refuses. */
export const RESUME_ATTACHMENT_PENDING_MAX = 5;
