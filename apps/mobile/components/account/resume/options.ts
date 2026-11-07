import type { DropdownOption } from "@/components/common/DropdownField";

export const GENDERS = ["Male", "Female"] as const;
export const MARITAL_STATUSES = ["Single", "Married", "Divorced"] as const;
export const EDUCATION_LEVELS = [
  "High School",
  "Associate",
  "Professional",
  "Bachelor's Degree",
  "Master",
  "Doctor",
] as const;
export const SKILL_LEVELS = [
  "Basic",
  "Intermediate",
  "Advanced",
  "Expert",
] as const;
export const LANGUAGE_LEVELS = [
  "Beginner",
  "Intermediate",
  "Advanced",
  "Native",
] as const;

/** The eight chips on the start card, in order. */
export const RESUME_STEPS = [
  "Personal Details",
  "Summary",
  "Experience",
  "Educations",
  "Skill",
  "Language",
  "Hobbies & Interests",
  "References",
] as const;

export const STEP_TITLES = [
  "Personal Information",
  "Summary",
  "Experience",
  "Educations",
  "Skill",
  "Language",
  "Hobbies & Interests",
  "References",
] as const;

export const NEXT_LABELS = [
  "Next → Summary",
  "Next → Experience",
  "Next → Skill",
  "Next → Languages",
  "Next → Hobbies & Interests",
  "Next → References",
] as const;

export const SUMMARY_HELPER =
  "A short paragraph (2-4 sentences) on who you are and what you're great at. Recruiters read this first.";

export const HOBBIES_HELPER =
  "A sentence or two on what you do outside work. It gives employers a sense of who you are.";

export const MAX_PHONES = 3;

const toOptions = (values: readonly string[]): DropdownOption[] =>
  values.map((value) => ({ id: value, name: value }));

export const genderOptions = toOptions(GENDERS);
export const maritalOptions = toOptions(MARITAL_STATUSES);
/** Stored values stay the web's labels; "Bachelor" is the reference's display. */
export const educationOptions: DropdownOption[] = EDUCATION_LEVELS.map(
  (value) => ({
    id: value,
    name: value === "Bachelor's Degree" ? "Bachelor" : value,
  }),
);
export const skillLevelOptions = toOptions(SKILL_LEVELS);
export const languageLevelOptions = toOptions(LANGUAGE_LEVELS);

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Full month names for the wheel picker (the compact field uses `MMM`). */
export const MONTH_OPTIONS: DropdownOption[] = MONTH_NAMES.map(
  (name, index) => ({ id: String(index + 1), name }),
);

/** Ascending years, from 100 years ago through the current year. */
export function yearOptions(): DropdownOption[] {
  const current = new Date().getFullYear();
  const first = current - 100;
  return Array.from({ length: 101 }, (_, index) => {
    const year = String(first + index);
    return { id: year, name: year };
  });
}

/** 1..last day of the given month (ids stay two-digit for the ISO value). */
export function dayOptions(year: number, month: number): DropdownOption[] {
  const days = new Date(year, month, 0).getDate();
  return Array.from({ length: days }, (_, index) => {
    const day = index + 1;
    return { id: String(day).padStart(2, "0"), name: String(day) };
  });
}
