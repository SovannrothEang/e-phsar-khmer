import { apiFetch } from "@/lib/api/client";

/** A geography row as the resume API returns it. */
export interface ResumePlace {
  id: string;
  name: string;
  slug: string;
}

export interface ResumeLocation {
  province: ResumePlace | null;
  district: ResumePlace | null;
  commune: ResumePlace | null;
}

export interface ResumePersonal {
  firstName: string;
  lastName: string;
  gender: string | null;
  dob: string | null;
  nationality: string | null;
  email: string | null;
  educationLevel: string | null;
  maritalStatus: string | null;
  place: ResumeLocation;
  address: string | null;
  position: string | null;
  yearsOfExperience: number | null;
  phones: string[];
  photoUrl: string | null;
}

export interface ResumeExperience {
  id: string;
  company: string;
  position: string;
  place: ResumeLocation;
  startDate: string;
  endDate: string | null;
  current: boolean;
  description: string;
}

export interface ResumeEducation {
  id: string;
  school: string;
  degree: string;
  major: string;
  place: ResumeLocation;
  startDate: string;
  endDate: string | null;
  current: boolean;
  description: string;
}

export interface ResumeSkill {
  id: string;
  title: string;
  level: string;
}

export interface ResumeLanguage {
  id: string;
  title: string;
  level: string;
}

export interface ResumeReference {
  id: string;
  name: string;
  company: string;
  position: string;
  phones: string[];
  email: string | null;
}

export interface ResumeJobPreference {
  openJob: boolean;
  position: string | null;
  category: string[];
  location: string[];
  jobType: string[];
}

/** The uploaded CV file (private bucket — opened through a signed URL). */
export interface ResumeAttachment {
  id: string;
  fileName: string;
  size: number;
  uploadedAt: string;
}

/** The create step's signed-upload ticket for a private CV object. */
export interface ResumeAttachmentUpload {
  id: string;
  uploadUrl: string;
  token: string;
  expiresIn: number;
}

export interface ResumeDocument {
  personal: ResumePersonal | null;
  summary: string;
  hobbies: string;
  experiences: ResumeExperience[];
  educations: ResumeEducation[];
  skills: ResumeSkill[];
  languages: ResumeLanguage[];
  references: ResumeReference[];
  jobPreference: ResumeJobPreference | null;
  attachment: ResumeAttachment | null;
}

interface ResumeDocumentWire extends ResumeDocument {
  exists: boolean;
}

export type ResumeEntrySection =
  | "experiences"
  | "educations"
  | "skills"
  | "languages"
  | "references";

export interface ResumePersonalInput {
  firstName: string;
  lastName: string;
  gender: string | null;
  dob: string | null;
  nationality: string;
  email: string;
  educationLevel: string | null;
  maritalStatus: string | null;
  place: ResumeLocation;
  address: string;
  position: string;
  yearsOfExperience: string;
  phones: string[];
  photoUrl: string | null;
}

export interface ResumeExperienceInput {
  company: string;
  position: string;
  place: ResumeLocation;
  startDate: string;
  endDate: string | null;
  current: boolean;
  description: string;
}

export interface ResumeEducationInput {
  school: string;
  degree: string;
  major: string;
  startDate: string;
  endDate: string | null;
  current: boolean;
  description: string;
}

export interface ResumeReferenceInput {
  name: string;
  company: string;
  position: string;
  phones: string[];
  email: string;
}

export interface ResumeJobPreferenceInput {
  openJob: boolean;
  position: string;
  category: string[];
  location: string[];
  jobType: string[];
}

export interface SignedResumeUpload {
  signedUrl: string;
  path: string;
  token: string;
  publicUrl: string;
}

/** `""` would fail `@IsEmail`/`@IsUUID`; the API wants `null` for "not set". */
const orNull = (value: string | null | undefined): string | null => {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
};

/** The API stores compact phones; spaces and dashes are display-only. */
export const compactPhone = (value: string): string =>
  value.replace(/[\s-]/g, "");

const placeIds = (place: ResumeLocation) => ({
  provinceId: place.province?.id ?? null,
  districtId: place.district?.id ?? null,
  communeId: place.commune?.id ?? null,
});

const phoneList = (phones: string[]): string[] =>
  phones.map(compactPhone).filter((phone) => phone !== "");

/** The whole document, or null when this user has never saved one. */
export async function fetchResume(): Promise<ResumeDocument | null> {
  const { data } = await apiFetch<ResumeDocumentWire>("/resume");
  return data.exists ? data : null;
}

export async function saveResumePersonal(
  input: ResumePersonalInput,
): Promise<ResumePersonal> {
  const { data } = await apiFetch<ResumePersonal>("/resume/personal", {
    method: "PUT",
    body: {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      gender: orNull(input.gender),
      dob: orNull(input.dob),
      nationality: orNull(input.nationality),
      email: orNull(input.email),
      educationLevel: orNull(input.educationLevel),
      maritalStatus: orNull(input.maritalStatus),
      ...placeIds(input.place),
      address: orNull(input.address),
      position: orNull(input.position),
      yearsOfExperience:
        input.yearsOfExperience.trim() === ""
          ? null
          : Number(input.yearsOfExperience),
      phones: phoneList(input.phones),
      photoUrl: orNull(input.photoUrl),
    },
  });
  return data;
}

/** `PATCH /resume` — summary/hobbies are independent of the section tables. */
export async function saveResumeSummary(summary: string): Promise<void> {
  await apiFetch<unknown>("/resume", {
    method: "PATCH",
    body: { summary },
  });
}

export async function saveResumeHobbies(hobbies: string): Promise<void> {
  await apiFetch<unknown>("/resume", {
    method: "PATCH",
    body: { hobbies },
  });
}

export async function saveResumeExperience(
  id: string,
  input: ResumeExperienceInput,
): Promise<ResumeExperience> {
  const { data } = await apiFetch<ResumeExperience>(
    `/resume/experiences/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      body: {
        company: input.company.trim(),
        position: input.position.trim(),
        ...placeIds(input.place),
        startDate: input.startDate,
        endDate: input.current ? null : input.endDate,
        current: input.current,
        description: orNull(input.description),
      },
    },
  );
  return data;
}

export async function saveResumeEducation(
  id: string,
  input: ResumeEducationInput,
): Promise<ResumeEducation> {
  const { data } = await apiFetch<ResumeEducation>(
    `/resume/educations/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      body: {
        school: input.school.trim(),
        degree: input.degree,
        major: input.major.trim(),
        startDate: input.startDate,
        endDate: input.current ? null : input.endDate,
        current: input.current,
        description: orNull(input.description),
      },
    },
  );
  return data;
}

export async function saveResumeSkill(
  id: string,
  title: string,
  level: string,
): Promise<ResumeSkill> {
  const { data } = await apiFetch<ResumeSkill>(
    `/resume/skills/${encodeURIComponent(id)}`,
    { method: "PUT", body: { title: title.trim(), level } },
  );
  return data;
}

export async function saveResumeLanguage(
  id: string,
  title: string,
  level: string,
): Promise<ResumeLanguage> {
  const { data } = await apiFetch<ResumeLanguage>(
    `/resume/languages/${encodeURIComponent(id)}`,
    { method: "PUT", body: { title: title.trim(), level } },
  );
  return data;
}

export async function saveResumeReference(
  id: string,
  input: ResumeReferenceInput,
): Promise<ResumeReference> {
  const { data } = await apiFetch<ResumeReference>(
    `/resume/references/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      body: {
        name: input.name.trim(),
        company: input.company.trim(),
        position: input.position.trim(),
        phones: phoneList(input.phones),
        email: orNull(input.email),
      },
    },
  );
  return data;
}

/** `PATCH /resume` — one preference row per resume (the web's dialog owns it). */
export async function saveResumeJobPreferences(
  input: ResumeJobPreferenceInput,
): Promise<void> {
  await apiFetch<unknown>("/resume", {
    method: "PATCH",
    body: {
      jobPreferences: {
        openJob: input.openJob,
        position: orNull(input.position),
        category: input.category,
        location: input.location,
        jobType: input.jobType,
      },
    },
  });
}

/** Reserve the private CV object and receive the signed upload URL. */
export async function createResumeAttachment(input: {
  id: string;
  fileName: string;
  declaredSize: number;
}): Promise<ResumeAttachmentUpload> {
  const { data } = await apiFetch<ResumeAttachmentUpload>(
    "/resume/attachments",
    { method: "POST", body: input },
  );
  return data;
}

/** Trust storage's size over the client's claim, then attach/replace the CV. */
export async function completeResumeAttachment(
  id: string,
): Promise<{ id: string; status: "attached"; size: number }> {
  const { data } = await apiFetch<{
    id: string;
    status: "attached";
    size: number;
  }>(`/resume/attachments/${encodeURIComponent(id)}/complete`, {
    method: "POST",
  });
  return data;
}

/** The CV lives in a private bucket; the API signs a short-lived URL. */
export async function signResumeAttachment(): Promise<string | null> {
  const { data } = await apiFetch<{ url: string; expiresAt: string }[]>(
    "/resume/attachments/sign",
    { method: "POST" },
  );
  return data[0]?.url ?? null;
}

/** Idempotent server-side: nothing to delete is still a success. */
export async function deleteResumeAttachment(): Promise<void> {
  await apiFetch<unknown>("/resume/attachments", { method: "DELETE" });
}

/**
 * The public feedback form. Sent as multipart (the endpoint's contract);
 * the bearer token links the submission to the signed-in account.
 */
export async function submitResumeFeedback(input: {
  name: string;
  phone: string;
  email?: string;
  description: string;
}): Promise<void> {
  const form = new FormData();
  form.append("name", input.name.trim());
  form.append("phone", compactPhone(input.phone));
  if (input.email?.trim()) form.append("email", input.email.trim());
  form.append("description", input.description.trim());
  await apiFetch<unknown>("/feedback", { method: "POST", body: form });
}

export async function deleteResumeEntry(
  section: ResumeEntrySection,
  id: string,
): Promise<void> {
  await apiFetch<unknown>(`/resume/${section}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

/** The resume photo lives under the user's own `resume/{userId}/` folder. */
export async function signResumeUpload(
  filename: string,
): Promise<SignedResumeUpload> {
  const { data } = await apiFetch<SignedResumeUpload>("/files/sign", {
    method: "POST",
    body: { scope: "resume", filename },
  });
  return data;
}

/** Best-effort cleanup for a photo uploaded but never saved. */
export async function deleteResumeUpload(path: string): Promise<void> {
  await apiFetch<unknown>("/files", {
    method: "DELETE",
    body: { paths: [path] },
  });
}

// --- shared checks and date helpers ---------------------------------------

export const isValidResumeEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

/** Spaces/dashes ignored; local 0 + 7–9 digits or 855 with 7–9 digits. */
export const isValidResumePhone = (value: string): boolean => {
  const compact = compactPhone(value);
  return /^0\d{7,9}$/.test(compact) || /^\+?855\d{7,9}$/.test(compact);
};

export const isValidYearsOfExperience = (value: string): boolean => {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return false;
  const years = Number(trimmed);
  return years >= 0 && years <= 60;
};

/** The CV card's "Max size: 5MB" and the backend's own cap. */
export const RESUME_CV_MAX_BYTES = 5 * 1024 * 1024;

export const RESUME_CV_EXTENSIONS = ["doc", "docx", "pdf", "txt"] as const;

/** Extension → Content-Type; read from the name, never from `File.type`. */
export const RESUME_CV_MIME_BY_EXTENSION: Record<string, string> = {
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  txt: "text/plain",
};

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** The picker's URI tail: iOS keeps the name; Android may return a content id. */
function cvUriTail(uri: string): string {
  const clean = safeDecode(uri.split("?")[0] ?? "");
  const last = clean.split(/[\\/]/).pop() ?? "";
  return last.includes(":") ? last.slice(last.lastIndexOf(":") + 1) : last;
}

/**
 * The CV extension accepted by the picker — from the URI's filename when it
 * has one, otherwise from the MIME type (Android content URIs often hide the
 * display name behind a numeric id).
 */
export function resumeCvExtension(
  uri: string,
  mimeType?: string | null,
): string | null {
  const tail = cvUriTail(uri);
  const extension = tail.includes(".")
    ? (tail.split(".").pop() ?? "").toLowerCase()
    : "";
  if ((RESUME_CV_EXTENSIONS as readonly string[]).includes(extension)) {
    return extension;
  }
  if (mimeType) {
    const match = Object.entries(RESUME_CV_MIME_BY_EXTENSION).find(
      ([, mime]) => mime === mimeType,
    );
    if (match) return match[0];
  }
  return null;
}

/** The display name sent to the API; falls back when the URI has no name. */
export function resumeCvFileName(uri: string, extension: string): string {
  const tail = cvUriTail(uri);
  if (!tail.toLowerCase().endsWith(`.${extension}`)) {
    return `cv-${Date.now()}.${extension}`;
  }
  if (tail.length <= 255) return tail;
  return `${tail.slice(0, 255 - extension.length - 1)}.${extension}`;
}

export interface MonthYear {
  year: number;
  /** 1–12. */
  month: number;
}

export const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** The resumes API stores date-only strings; the month picker lands on day 1. */
export const monthYearToDate = (value: MonthYear | null): string | null => {
  if (!value) return null;
  return `${value.year}-${String(value.month).padStart(2, "0")}-01`;
};

export const dateToMonthYear = (value: string | null): MonthYear | null => {
  if (!value) return null;
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return null;
  return { year, month };
};

/** `2022-Jan` — the compact format the reference lists use. */
export const formatMonthYear = (value: string | null): string => {
  const parsed = dateToMonthYear(value);
  if (!parsed) return "";
  return `${parsed.year}-${MONTH_ABBR[parsed.month - 1]}`;
};

export const formatMonthYearValue = (value: MonthYear | null): string => {
  if (!value) return "";
  return `${value.year}-${MONTH_ABBR[value.month - 1]}`;
};

/** "Phnom Penh, Boeng Keng Kang, Olympic" — largest to smallest. */
export const resumeLocationLabel = (place: ResumeLocation): string =>
  [place.province, place.district, place.commune]
    .map((level) => level?.name)
    .filter(Boolean)
    .join(", ");
