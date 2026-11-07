import {
  dateToMonthYear,
  type MonthYear,
  type ResumeAttachment,
  type ResumeDocument,
  type ResumeExperience,
  type ResumeJobPreference,
  type ResumeLocation,
  type ResumePersonal,
  type ResumeReference,
} from "@/lib/api/resume";

export const EMPTY_LOCATION: ResumeLocation = {
  province: null,
  district: null,
  commune: null,
};

export interface PersonalDraft {
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
  /** Storage path for cleanup when a picked photo is never saved. */
  photoPath: string | null;
}

export interface ExperienceDraft {
  id: string;
  company: string;
  position: string;
  place: ResumeLocation;
  start: MonthYear | null;
  end: MonthYear | null;
  current: boolean;
  description: string;
}

export interface ReferenceDraft {
  id: string;
  name: string;
  company: string;
  position: string;
  phones: string[];
  email: string;
}

/** The overview's Job Preferences card — its own form, not a wizard step. */
export interface JobPreferenceDraft {
  openJob: boolean;
  position: string;
  category: string[];
  location: string[];
  jobType: string[];
}

export interface ResumeDraft {
  personal: PersonalDraft;
  summary: string;
  hobbies: string;
  experience: ExperienceDraft | null;
  educations: ResumeDocument["educations"];
  skills: ResumeDocument["skills"];
  languages: ResumeDocument["languages"];
  reference: ReferenceDraft | null;
  jobPreference: JobPreferenceDraft | null;
  attachment: ResumeAttachment | null;
}

export function emptyDraft(firstName = "", lastName = ""): ResumeDraft {
  return {
    personal: emptyPersonal(firstName, lastName),
    summary: "",
    hobbies: "",
    experience: null,
    educations: [],
    skills: [],
    languages: [],
    reference: null,
    jobPreference: null,
    attachment: null,
  };
}

export function emptyPersonal(firstName = "", lastName = ""): PersonalDraft {
  return {
    firstName,
    lastName,
    gender: null,
    dob: null,
    nationality: "",
    email: "",
    educationLevel: null,
    maritalStatus: null,
    place: EMPTY_LOCATION,
    address: "",
    position: "",
    yearsOfExperience: "",
    phones: [""],
    photoUrl: null,
    photoPath: null,
  };
}

export function personalFromWire(personal: ResumePersonal): PersonalDraft {
  return {
    firstName: personal.firstName,
    lastName: personal.lastName,
    gender: personal.gender,
    dob: personal.dob,
    nationality: personal.nationality ?? "",
    email: personal.email ?? "",
    educationLevel: personal.educationLevel,
    maritalStatus: personal.maritalStatus,
    place: personal.place,
    address: personal.address ?? "",
    position: personal.position ?? "",
    yearsOfExperience:
      personal.yearsOfExperience === null
        ? ""
        : String(personal.yearsOfExperience),
    phones: personal.phones.length > 0 ? personal.phones : [""],
    photoUrl: personal.photoUrl,
    photoPath: null,
  };
}

export function experienceFromWire(
  experience: ResumeExperience,
): ExperienceDraft {
  return {
    id: experience.id,
    company: experience.company,
    position: experience.position,
    place: experience.place,
    start: dateToMonthYear(experience.startDate),
    end: dateToMonthYear(experience.endDate),
    current: experience.current,
    description: experience.description,
  };
}

export function referenceFromWire(reference: ResumeReference): ReferenceDraft {
  return {
    id: reference.id,
    name: reference.name,
    company: reference.company,
    position: reference.position,
    phones: reference.phones.length > 0 ? reference.phones : [""],
    email: reference.email ?? "",
  };
}

export function jobPreferenceFromWire(
  preference: ResumeJobPreference,
): JobPreferenceDraft {
  return {
    openJob: preference.openJob,
    position: preference.position ?? "",
    category: preference.category,
    location: preference.location,
    jobType: preference.jobType,
  };
}

/** The mobile wizard edits the first stored entry of each single section. */
export function documentToDraft(
  document: ResumeDocument,
  fallbackFirstName: string,
  fallbackLastName: string,
): ResumeDraft {
  return {
    personal: document.personal
      ? personalFromWire(document.personal)
      : emptyPersonal(fallbackFirstName, fallbackLastName),
    summary: document.summary,
    hobbies: document.hobbies,
    experience: document.experiences[0]
      ? experienceFromWire(document.experiences[0])
      : null,
    educations: document.educations,
    skills: document.skills,
    languages: document.languages,
    reference: document.references[0]
      ? referenceFromWire(document.references[0])
      : null,
    jobPreference: document.jobPreference
      ? jobPreferenceFromWire(document.jobPreference)
      : null,
    attachment: document.attachment,
  };
}
