import type { PhoneOtpRow } from '../db/schema';

export type OtpPurpose = PhoneOtpRow['purpose'];

export const OTP_CODE_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_TTL_MINUTES = OTP_TTL_MS / 60_000;
export const OTP_MAX_ATTEMPTS = 5;

export type OtpVerifyResult =
  | { status: 'ok'; purpose: OtpPurpose }
  | { status: 'invalid' }
  | { status: 'expired' }
  | { status: 'too_many_attempts' };

export interface IssuedOtp {
  /** Row id; null when the dev bypass is active and nothing was stored. */
  id: string | null;
  /** The plain code. For the SMS sender only: never log or persist it. */
  code: string;
  expiresAt: Date;
}
