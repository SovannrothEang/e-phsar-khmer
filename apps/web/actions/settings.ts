"use server";

/**
 * Account settings for the signed-in USER. Every call goes through
 * `userServerFetch` (the `user_access_token` cookie) — never `serverFetch`,
 * which authenticates as the admin dashboard's account.
 */

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
function describeApiError(err: ApiError): string {
  switch (err.message) {
    case "USERNAME_TAKEN":
      return "That username is already taken.";
    case "EMAIL_TAKEN":
      return "That email address is already used by another account.";
    case "PHONE_TAKEN":
      return "That phone number is already used by another account.";
    case "PHONE_UNCHANGED":
      return "That is already your active phone number.";
    case "INVALID_PASSWORD":
      return "That password does not match.";
    case "PASSWORD_NOT_SET":
      return "This account has no password yet — sign in with a phone code first.";
    case "INVALID_OTP":
      return "That code is not valid or has expired.";
    case "INVALID_LOCATION_HIERARCHY":
      return "Pick the location from the top down: province, then district, then commune.";
    case "Validation failed":
      return "Please check the values you entered.";
    default:
      return err.message;
  }
}

function toFailure(err: unknown): SettingsActionResult {
  if (!(err instanceof ApiError)) {
    return { success: false, error: "Network error" };
  }
  return { success: false, error: describeApiError(err) };
}

export interface ProfileInput {
  firstName?: string;
  lastName?: string;
  gender?: "male" | "female" | null;
  yearOfBirth?: number | null;
  company?: string | null;
  email?: string | null;
  provinceId?: string | null;
  districtId?: string | null;
  communeId?: string | null;
  address?: string | null;
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
    "yearOfBirth",
    "company",
    "email",
    "provinceId",
    "districtId",
    "communeId",
    "address",
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
  if (!e164) return { success: false, error: "Enter a valid phone number." };

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
  if (!e164) return { success: false, error: "Enter a valid phone number." };

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
