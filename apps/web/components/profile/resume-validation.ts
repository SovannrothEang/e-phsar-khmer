/**
 * Shared format checks for the resume builder's forms. Required-field rules
 * stay in each dialog; these are the "valid shape" rules the captain asked
 * for — pragmatic, client-side, and applied only when a field has content.
 */

import { isLocalPhone } from "@/lib/phone";

/** One @, and a dot in the domain (name@domain.tld). */
export const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

/**
 * Spaces and dashes are ignored; Cambodian local (0 + 7–9 digits — the same
 * shape register/login accept) or +855.
 */
export const isValidPhone = (value: string) => {
  const compact = value.replace(/[\s-]/g, "");
  return isLocalPhone(compact) || /^\+?855\d{7,9}$/.test(compact);
};

/** Years of experience: digits only, within a believable span (blank allowed). */
export const isValidYearsOfExperience = (value: string) => {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return false;
  const years = Number(trimmed);
  return years >= 0 && years <= 60;
};

/** The pickers' shared cap — the same 5 MB avatars and listing photos allow. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * The Step-1 photo must be an image and at most 5 MB. Checked before anything
 * is signed, so a rejected pick never creates a storage object at all.
 */
export const isValidPhotoFile = (file: File) =>
  file.type.startsWith("image/") && file.size <= MAX_UPLOAD_BYTES;

/** The card's own copy: "Support file types: doc, DOCX, PDF, txt. (Max size: 5MB)". */
export const CV_EXTENSIONS = ["doc", "docx", "pdf", "txt"] as const;

const extensionOf = (name: string) =>
  (name.split(".").pop() ?? "").toLowerCase();

/**
 * A CV is one of the four extensions and at most 5 MB. **Advisory only:** the
 * bytes go straight to storage on a signed upload, so nothing server-side can
 * inspect them — the bucket's `allowed_mime_types` sees the `Content-Type` the
 * browser claims, never the real file.
 */
export const isValidCvFile = (file: File) =>
  (CV_EXTENSIONS as readonly string[]).includes(extensionOf(file.name)) &&
  file.size <= MAX_UPLOAD_BYTES;

/**
 * Extension → `Content-Type` for the browser's PUT. Read from the name, not
 * `file.type`, which is empty for `.docx` on many systems — and the bucket
 * policy would reject an empty type. Mirrors the backend's
 * `CV_MIME_BY_EXTENSION`.
 */
const CV_MIME_BY_EXTENSION: Record<string, string> = {
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  txt: "text/plain",
};

export const cvMime = (file: File) =>
  CV_MIME_BY_EXTENSION[extensionOf(file.name)] ?? "application/octet-stream";
