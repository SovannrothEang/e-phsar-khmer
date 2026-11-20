"use server";

/**
 * Account settings for the signed-in USER. Every call goes through
 * `userServerFetch` (the `user_access_token` cookie) — never `serverFetch`,
 * which authenticates as the admin dashboard's account.
 */

import { getTranslations } from "next-intl/server";
import { ApiError, userServerFetch } from "@/lib/api/user-client";
import { normalizePhone } from "@/lib/phone";
import type { BackendUser } from "@/lib/api/adapters";

export interface SettingsActionResult {
  success: boolean;
  error?: string;
}

/**
 * The backend answers a domain failure with the HTTP status name in `code`
 * ("CONFLICT") and the domain string in `message` ("USERNAME_TAKEN"), so
 * anything worth phrasing for a human is matched on the message, not the code.
 */
async function describeApiError(err: ApiError): Promise<string> {
  const t = await getTranslations("Settings.errors");
  switch (err.message) {
    case "USERNAME_TAKEN":
      return t("usernameTaken");
    case "USERNAME_INVALID":
      return t("usernameInvalid");
    case "EMAIL_TAKEN":
      return t("emailTaken");
    case "PHONE_TAKEN":
      return t("phoneTaken");
    case "PHONE_UNCHANGED":
      return t("phoneUnchanged");
    case "INVALID_PASSWORD":
      return t("invalidPassword");
    case "PASSWORD_NOT_SET":
      return t("passwordNotSet");
    case "INVALID_OTP":
      return t("invalidOtp");
    case "INVALID_LOCATION_HIERARCHY":
      return t("invalidLocationHierarchy");
    case "Validation failed":
      return t("validationFailed");
    default:
      return err.message;
  }
}

async function toFailure(err: unknown): Promise<SettingsActionResult> {
  if (!(err instanceof ApiError)) {
    const t = await getTranslations("Settings.errors");
    return { success: false, error: t("network") };
  }
  return { success: false, error: await describeApiError(err) };
}

async function invalidPhoneError(): Promise<SettingsActionResult> {
  const t = await getTranslations("Settings.errors");
  return { success: false, error: t("invalidPhone") };
}

export interface ProfileInput {
  firstName?: string;
  lastName?: string;
  gender?: "male" | "female" | null;
  /** ISO date (`YYYY-MM-DD`); the backend derives `yearOfBirth` from it. */
  dateOfBirth?: string | null;
  yearOfBirth?: number | null;
  company?: string | null;
  email?: string | null;
  provinceId?: string | null;
  districtId?: string | null;
  communeId?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /** Copy the contact trio to every non-deleted listing the user owns. */
  updateAdsContact?: boolean;
}

/**
 * Writes the profile field by field rather than spreading the caller's object,
 * mirroring the API's allowlist on this side — nothing else can ride along.
 * An omitted key is left untouched; an explicit null clears the column.
 */
export async function updateMyProfile(
  input: ProfileInput,
): Promise<SettingsActionResult> {
  const body: Record<string, unknown> = {};
  const keys = [
    "firstName",
    "lastName",
    "gender",
    "dateOfBirth",
    "yearOfBirth",
    "company",
    "email",
    "provinceId",
    "districtId",
    "communeId",
    "address",
    "latitude",
    "longitude",
    "updateAdsContact",
  ] as const;

  for (const key of keys) {
    if (input[key] !== undefined) body[key] = input[key];
  }

  try {
    await userServerFetch<BackendUser>("/users/me", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return { success: true };
  } catch (err) {
    return toFailure(err);
  }
}

const PRIVACY_KEYS = [
  "discoverableByGender",
  "discoverableByDateOfBirth",
  "discoverableByPhone",
  "discoverableByEmail",
  "discoverableByLocation",
] as const;

export type PrivacyKey = (typeof PRIVACY_KEYS)[number];

/**
 * Flips one Settings → Privacy toggle. The backend DTO accepts all five, but
 * sending only the changed key keeps concurrent toggles from overwriting
 * each other.
 */
export async function updateMyPrivacy(
  key: PrivacyKey,
  isPublic: boolean,
): Promise<SettingsActionResult> {
  // A server action is a network endpoint: the TS union is erased at runtime,
  // so reject anything outside the allow-list before it reaches the API.
  if (!PRIVACY_KEYS.includes(key)) {
    const t = await getTranslations("Settings.errors");
    return { success: false, error: t("unknownPrivacy") };
  }

  try {
    await userServerFetch<BackendUser>("/users/me", {
      method: "PATCH",
      body: JSON.stringify({ [key]: isPublic }),
    });
    return { success: true };
  } catch (err) {
    return toFailure(err);
  }
}

/** Row of `GET /users/me/phones` — the edit-profile contact block's list. */
export interface MyPhoneRow {
  id: string;
  phone: string;
  isPrimary: boolean;
}

/**
 * The user's saved phone numbers. Fail-soft: the profile form must still
 * render when the phone read fails (it falls back to `primaryPhone`).
 */
export async function listMyPhones(): Promise<MyPhoneRow[]> {
  try {
    const { data } = await userServerFetch<MyPhoneRow[]>("/users/me/phones");
    return data;
  } catch {
    return [];
  }
}

export interface AddMyPhoneResult extends SettingsActionResult {
  phone?: MyPhoneRow;
}

/** Adds a secondary contact number; the backend normalises nothing, so we do. */
export async function addMyPhone(rawPhone: string): Promise<AddMyPhoneResult> {
  const e164 = normalizePhone(rawPhone);
  if (!e164) return invalidPhoneError();

  try {
    const { data } = await userServerFetch<MyPhoneRow>("/users/me/phones", {
      method: "POST",
      body: JSON.stringify({ phone: e164 }),
    });
    return { success: true, phone: data };
  } catch (err) {
    return toFailure(err);
  }
}

/**
 * Edits one saved contact number. Deliberately does not touch the active
 * (login) phone — that number only moves through the OTP change-phone flow.
 */
export async function updateMyPhone(
  phoneId: string,
  rawPhone: string,
): Promise<SettingsActionResult> {
  const e164 = normalizePhone(rawPhone);
  if (!e164) return invalidPhoneError();

  try {
    await userServerFetch(`/users/me/phones/${phoneId}`, {
      method: "PATCH",
      body: JSON.stringify({ phone: e164 }),
    });
    return { success: true };
  } catch (err) {
    return toFailure(err);
  }
}

export async function removeMyPhone(
  phoneId: string,
): Promise<SettingsActionResult> {
  try {
    await userServerFetch(`/users/me/phones/${phoneId}`, {
      method: "DELETE",
    });
    return { success: true };
  } catch (err) {
    return toFailure(err);
  }
}

export async function changeUsername(
  username: string,
): Promise<SettingsActionResult> {
  try {
    await userServerFetch<BackendUser>("/users/me/username", {
      method: "PATCH",
      body: JSON.stringify({ username }),
    });
    return { success: true };
  } catch (err) {
    return toFailure(err);
  }
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<SettingsActionResult> {
  try {
    await userServerFetch("/users/me/password", {
      method: "PATCH",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    return { success: true };
  } catch (err) {
    return toFailure(err);
  }
}

/** Sends the verification code to the number that should become the active one. */
export async function requestPhoneChangeOtp(
  phone: string,
): Promise<SettingsActionResult> {
  const e164 = normalizePhone(phone);
  if (!e164) return invalidPhoneError();

  try {
    await userServerFetch("/users/me/phones/otp", {
      method: "POST",
      body: JSON.stringify({ phone: e164 }),
    });
    return { success: true };
  } catch (err) {
    return toFailure(err);
  }
}

export async function verifyPhoneChange(
  phone: string,
  token: string,
): Promise<SettingsActionResult> {
  const e164 = normalizePhone(phone);
  if (!e164) return invalidPhoneError();

  try {
    await userServerFetch<BackendUser>("/users/me/phones/otp/verify", {
      method: "POST",
      body: JSON.stringify({ phone: e164, token }),
    });
    return { success: true };
  } catch (err) {
    return toFailure(err);
  }
}

/**
 * Deactivates the account. Reversible by signing in again within 90 days;
 * after that the sweeper deletes it, and everything cascading from it.
 */
export async function deleteMyAccount(
  password: string,
): Promise<SettingsActionResult> {
  try {
    await userServerFetch("/users/me", {
      method: "DELETE",
      body: JSON.stringify({ password }),
    });
    return { success: true };
  } catch (err) {
    return toFailure(err);
  }
}
