"use server";

/**
 * Server actions for the resume (CV) builder — every call it makes to
 * `/resume`, in one place. `userServerFetch`, never `serverFetch`: the admin
 * twin would authenticate a visitor's CV as the logged-in ADMIN.
 *
 * The two type systems meet here and nowhere else. The UI's entries are
 * objects with `Date`s and enums-from-lists; the API's are flat date-only
 * strings and geography ids. Out and back is mapped once, below, so no
 * component has to know the wire shape (`ResumePreview.tsx`'s types are
 * imported as types only — erased at build time, so no client bundle is
 * pulled in).
 */

import { ApiError, userServerFetch } from "@/lib/api/user-client";
import type {
  EducationEntry,
  ExperienceEntry,
  JobPreferenceEntry,
  LanguageEntry,
  ReferenceEntry,
  ResumeDocumentData,
  ResumePersonalData,
  SkillEntry,
} from "@/components/profile/ResumePreview";
import type { ResumeLocation } from "@/components/profile/ResumeLocationDialog";

export type ResumeEntrySection =
  | "experiences"
  | "educations"
  | "skills"
  | "languages"
  | "references";

export interface ResumeActionResult {
  success: boolean;
  error?: string;
}

interface Place {
  id: string;
  name: string;
  slug: string;
}

interface ResumeLocationWire {
  province: Place | null;
  district: Place | null;
  commune: Place | null;
}

interface ResumePersonalWire {
  firstName: string;
  lastName: string;
  gender: string | null;
  dob: string | null;
  nationality: string | null;
  email: string | null;
  educationLevel: string | null;
  maritalStatus: string | null;
  place: ResumeLocationWire;
  address: string | null;
  position: string | null;
  yearsOfExperience: number | null;
  phones: string[];
  photoUrl: string | null;
}

interface ResumeExperienceWire {
  id: string;
  company: string;
  position: string;
  place: ResumeLocationWire;
  startDate: string;
  endDate: string | null;
  current: boolean;
  description: string;
}

interface ResumeEducationWire {
  id: string;
  school: string;
  degree: string;
  major: string;
  place: ResumeLocationWire;
  startDate: string;
  endDate: string | null;
  current: boolean;
  description: string;
}

interface ResumeSkillWire {
  id: string;
  title: string;
  level: string;
}

interface ResumeLanguageWire {
  id: string;
  title: string;
  level: string;
}

interface ResumeReferenceWire {
  id: string;
  name: string;
  company: string;
  position: string;
  phones: string[];
  email: string | null;
}

interface ResumeJobPreferenceWire {
  openJob: boolean;
  position: string | null;
  category: string[];
  location: string[];
  jobType: string[];
}

interface ResumeAttachmentWire {
  id: string;
  fileName: string;
  size: number;
  uploadedAt: string;
}

interface ResumeDocumentWire {
  exists: boolean;
  personal: ResumePersonalWire | null;
  summary: string;
  hobbies: string;
  experiences: ResumeExperienceWire[];
  educations: ResumeEducationWire[];
  skills: ResumeSkillWire[];
  languages: ResumeLanguageWire[];
  references: ResumeReferenceWire[];
  jobPreference: ResumeJobPreferenceWire | null;
  attachment: ResumeAttachmentWire | null;
}

export type ResumeEntry =
  | ExperienceEntry
  | EducationEntry
  | SkillEntry
  | LanguageEntry
  | ReferenceEntry;

/** `""` would fail `@IsEmail`/`@IsUUID`; the API wants `null` for "not set". */
const orNull = (value: string | null | undefined): string | null => {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
};

/** Date-only, both directions — never a full ISO timestamp. */
const toDateOnly = (date: Date | null): string | null => {
  if (!date) return null;
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

/**
 * Local midnight on purpose: `new Date("1990-01-01")` is parsed as UTC and
 * can render a day early west of Greenwich.
 */
const fromDateOnly = (value: string | null): Date | null =>
  value ? new Date(`${value}T00:00:00`) : null;

/** The preview renders the compact form, so the stored form is the compact one. */
const compactPhone = (value: string): string => value.replace(/[\s-]/g, "");

const phoneList = (phones: string[]): string[] =>
  phones.map(compactPhone).filter((phone) => phone !== "");

const toPlaceWire = (place: ResumeLocation) => ({
  provinceId: place.province?.id ?? null,
  districtId: place.district?.id ?? null,
  communeId: place.commune?.id ?? null,
});

const toPlaceClient = (place: ResumeLocationWire): ResumeLocation => ({
  province: place.province,
  district: place.district,
  commune: place.commune,
});

function failure(error: unknown): string {
  return error instanceof ApiError ? error.message : "Network error";
}

export async function getResume(): Promise<
  { ok: true; document: ResumeDocumentData | null } | { ok: false }
> {
  try {
    const { data } = await userServerFetch<ResumeDocumentWire>("/resume");
    if (!data.exists) return { ok: true, document: null };
    return { ok: true, document: toClientDocument(data) };
  } catch {
    // A failed read must be visible: rendering an empty builder instead would
    // invite the user to start a wizard over a resume that already exists.
    return { ok: false };
  }
}

export async function saveResumePersonal(
  data: ResumePersonalData,
): Promise<boolean> {
  return (
    await run(() =>
      userServerFetch<ResumePersonalWire>("/resume/personal", {
        method: "PUT",
        body: JSON.stringify({
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          gender: orNull(data.gender),
          dob: toDateOnly(data.dob),
          nationality: orNull(data.nationality),
          email: orNull(data.email),
          educationLevel: orNull(data.education),
          maritalStatus: orNull(data.maritalStatus),
          ...toPlaceWire(data.place),
          address: orNull(data.address),
          position: orNull(data.position),
          yearsOfExperience:
            data.yearsOfExperience.trim() === ""
              ? null
              : Number(data.yearsOfExperience),
          phones: phoneList(data.phones),
          photoUrl: orNull(data.photo),
        }),
      }),
    )
  ).success;
}

export async function saveResumeDocument(patch: {
  summary?: string | null;
  hobbies?: string | null;
  jobPreferences?: JobPreferenceEntry | null;
}): Promise<boolean> {
  const body: Record<string, unknown> = {};
  if (patch.summary !== undefined) body.summary = patch.summary;
  if (patch.hobbies !== undefined) body.hobbies = patch.hobbies;
  if (patch.jobPreferences !== undefined)
    body.jobPreferences = patch.jobPreferences
      ? {
          openJob: patch.jobPreferences.openJob,
          position: orNull(patch.jobPreferences.position),
          category: patch.jobPreferences.category,
          location: patch.jobPreferences.location,
          jobType: patch.jobPreferences.jobType,
        }
      : null;

  return (
    await run(() =>
      userServerFetch("/resume", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    )
  ).success;
}

export async function saveResumeEntry(
  section: ResumeEntrySection,
  entry: ResumeEntry,
): Promise<boolean> {
  return (await run(() => putEntry(section, entry))).success;
}

export async function deleteResumeEntry(
  section: ResumeEntrySection,
  id: string,
): Promise<boolean> {
  return (
    await run(() =>
      userServerFetch(`/resume/${section}/${id}`, { method: "DELETE" }),
    )
  ).success;
}

// --- the CV file handshake -------------------------------------------------

// These carry payloads, so they report the failure the way the chat
// attachment actions do (`actions/chat-attachments.ts`).
export async function createResumeAttachment(input: {
  id: string;
  fileName: string;
  declaredSize: number;
}): Promise<
  | {
      ok: true;
      data: { id: string; uploadUrl: string; token: string; expiresIn: number };
    }
  // `code` rides along because one of them is actionable: a replayed create
  // for an already-uploaded id answers RESUME_ATTACHMENT_NOT_PENDING, which
  // means "the bytes are up — skip the PUT and complete".
  | { ok: false; error: string; code?: string }
> {
  try {
    const { data } = await userServerFetch<{
      id: string;
      uploadUrl: string;
      token: string;
      expiresIn: number;
    }>("/resume/attachments", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: failure(error),
      ...(error instanceof ApiError ? { code: error.code } : {}),
    };
  }
}

export async function completeResumeAttachment(
  id: string,
): Promise<
  | { ok: true; data: { id: string; status: "attached"; size: number } }
  | { ok: false; error: string }
> {
  try {
    const { data } = await userServerFetch<{
      id: string;
      status: "attached";
      size: number;
    }>(`/resume/attachments/${id}/complete`, { method: "POST" });
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: failure(error) };
  }
}

export async function signResumeAttachment(): Promise<
  { ok: true; url: string | null } | { ok: false; error: string }
> {
  try {
    const { data } = await userServerFetch<
      { url: string; expiresAt: string }[]
    >("/resume/attachments/sign", { method: "POST" });
    return { ok: true, url: data[0]?.url ?? null };
  } catch (error) {
    return { ok: false, error: failure(error) };
  }
}

// The card's remove control. Idempotent server-side (nothing to delete is
// still `{ deleted: true }`), so a double click is a no-op, not an error.
export async function deleteResumeAttachment(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    await userServerFetch("/resume/attachments", { method: "DELETE" });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: failure(error) };
  }
}

// --- mapping ---------------------------------------------------------------

/** Both server actions funnel through here so a failure has one shape. */
async function run(call: () => Promise<unknown>): Promise<ResumeActionResult> {
  try {
    await call();
    return { success: true };
  } catch (error) {
    return { success: false, error: failure(error) };
  }
}

function putEntry(section: ResumeEntrySection, entry: ResumeEntry) {
  return userServerFetch(`/resume/${section}/${entry.id}`, {
    method: "PUT",
    body: JSON.stringify(toEntryWire(section, entry)),
  });
}

/** The request bodies, flat and date-only, per section. */
function toEntryWire(
  section: ResumeEntrySection,
  entry: ResumeEntry,
): Record<string, unknown> {
  switch (section) {
    case "experiences": {
      const experience = entry as ExperienceEntry;
      return {
        company: experience.company.trim(),
        position: experience.position.trim(),
        ...toPlaceWire(experience.place),
        startDate: toDateOnly(experience.startDate),
        endDate: toDateOnly(experience.endDate),
        current: experience.current,
        description: orNull(experience.description),
      };
    }
    case "educations": {
      // The Education form has no location picker (unlike Experience), so no
      // place ids are sent — the columns stay null and the API's optional
      // fields simply go unused.
      const education = entry as EducationEntry;
      return {
        school: education.school.trim(),
        degree: education.degree,
        major: education.major.trim(),
        startDate: toDateOnly(education.startDate),
        endDate: toDateOnly(education.endDate),
        current: education.current,
        description: orNull(education.description),
      };
    }
    case "skills": {
      const skill = entry as SkillEntry;
      return { title: skill.title.trim(), level: skill.level };
    }
    case "languages": {
      const language = entry as LanguageEntry;
      return { title: language.title.trim(), level: language.level };
    }
    default: {
      const reference = entry as ReferenceEntry;
      return {
        name: reference.name.trim(),
        company: reference.company.trim(),
        position: reference.position.trim(),
        phones: phoneList(reference.phones),
        email: orNull(reference.email),
      };
    }
  }
}

function toClientDocument(wire: ResumeDocumentWire): ResumeDocumentData {
  return {
    personal: wire.personal
      ? {
          firstName: wire.personal.firstName,
          lastName: wire.personal.lastName,
          gender: wire.personal.gender,
          dob: fromDateOnly(wire.personal.dob),
          nationality: wire.personal.nationality ?? "",
          email: wire.personal.email ?? "",
          // The client type is `string | undefined` — a cleared picker renders
          // its placeholder, not an empty string.
          education: wire.personal.educationLevel ?? undefined,
          maritalStatus: wire.personal.maritalStatus,
          place: toPlaceClient(wire.personal.place),
          address: wire.personal.address ?? "",
          position: wire.personal.position ?? "",
          yearsOfExperience:
            wire.personal.yearsOfExperience === null
              ? ""
              : `${wire.personal.yearsOfExperience}`,
          phones: wire.personal.phones.length > 0 ? wire.personal.phones : [""],
          photo: wire.personal.photoUrl,
        }
      : null,
    summary: wire.summary,
    hobbies: wire.hobbies,
    experiences: wire.experiences.map((experience) => ({
      id: experience.id,
      company: experience.company,
      position: experience.position,
      place: toPlaceClient(experience.place),
      startDate: fromDateOnly(experience.startDate) as Date,
      endDate: fromDateOnly(experience.endDate),
      current: experience.current,
      description: experience.description,
    })),
    educations: wire.educations.map((education) => ({
      id: education.id,
      school: education.school,
      degree: education.degree,
      major: education.major,
      startDate: fromDateOnly(education.startDate) as Date,
      endDate: fromDateOnly(education.endDate),
      current: education.current,
      description: education.description,
    })),
    skills: wire.skills,
    languages: wire.languages,
    references: wire.references.map((reference) => ({
      ...reference,
      email: reference.email ?? "",
    })),
    jobPreference: wire.jobPreference
      ? {
          // The wire object has no id (there is one preference per resume);
          // the form's draft/menu plumbing expects one.
          id: crypto.randomUUID(),
          openJob: wire.jobPreference.openJob,
          position: wire.jobPreference.position ?? "",
          category: wire.jobPreference.category,
          location: wire.jobPreference.location,
          jobType: wire.jobPreference.jobType,
        }
      : null,
    attachment: wire.attachment,
  };
}
