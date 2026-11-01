import { apiFetch } from "@/lib/api/client";
import { getDeviceHeaders } from "@/lib/api/device";

/** The user row every auth response carries (passwordHash is stripped server-side). */
export interface BackendUser {
  id: string;
  username: string | null;
  primaryPhone: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  gender: string | null;
  company: string | null;
  profilePhotoUrl: string | null;
  coverPhotoUrl: string | null;
  address: string | null;
  preferredLanguage: string | null;
  role: "user" | "admin" | "super_admin";
  status: string;
  isBusiness: boolean;
  createdAt: string;
  phoneVerifiedAt: string | null;
  emailVerifiedAt?: string | null;
  verifiedAccount?: boolean;
  discoverableByGender?: boolean;
  discoverableByDateOfBirth?: boolean;
  discoverableByPhone?: boolean;
  discoverableByEmail?: boolean;
  discoverableByLocation?: boolean;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  expiresIn?: string;
  user: BackendUser;
  newDevice?: boolean;
}

interface OtpSent {
  otpSent: true;
}

async function deviceHeaders() {
  return getDeviceHeaders();
}

/** Username (or phone) + password. Used when the identifier is not phone-shaped. */
export async function loginWithPassword(
  identifier: string,
  password: string,
): Promise<AuthResult> {
  const { data } = await apiFetch<AuthResult>("/auth/login", {
    method: "POST",
    body: { identifier, password },
    auth: false,
    headers: await deviceHeaders(),
  });
  return data;
}

/** Phone login step 1: the backend validates the password, then sends the SMS. */
export async function requestLoginOtp(
  phone: string,
  password: string,
): Promise<OtpSent> {
  const { data } = await apiFetch<OtpSent>("/auth/otp/login", {
    method: "POST",
    body: { phone, password },
    auth: false,
  });
  return data;
}

/** Registration step 1: sends the SMS OTP for this phone. */
export async function registerWithPhone(phone: string): Promise<OtpSent> {
  const { data } = await apiFetch<OtpSent>("/auth/register", {
    method: "POST",
    body: { phone },
    auth: false,
  });
  return data;
}

/** Re-send an OTP without touching credentials. */
export async function requestOtp(phone: string): Promise<OtpSent> {
  const { data } = await apiFetch<OtpSent>("/auth/otp/request", {
    method: "POST",
    body: { phone },
    auth: false,
  });
  return data;
}

/**
 * Registration/login step 2. The password is sent again on purpose: the
 * backend verifies it against an existing account, or hashes it into the new
 * one. Names only take effect when the account is created.
 */
export async function verifyPhoneOtp(input: {
  phone: string;
  token: string;
  password: string;
  firstName?: string;
  lastName?: string;
}): Promise<AuthResult> {
  const { data } = await apiFetch<AuthResult>("/auth/otp/verify", {
    method: "POST",
    body: input,
    auth: false,
    headers: await deviceHeaders(),
  });
  return data;
}

export async function fetchMe(): Promise<BackendUser> {
  const { data } = await apiFetch<BackendUser>("/auth/me");
  return data;
}

/** Revokes this session server-side; callers clear local tokens even on failure. */
export async function logoutSession(): Promise<void> {
  await apiFetch<unknown>("/auth/logout", { method: "POST" });
}
