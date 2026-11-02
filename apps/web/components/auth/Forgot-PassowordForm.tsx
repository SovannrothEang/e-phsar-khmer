"use client";

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCwIcon } from "lucide-react";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { toast } from "@/components/ui/sonner";
import { useRouter } from "@/i18n/routing";
import {
  confirmPasswordReset,
  requestPasswordReset,
  verifyPasswordResetCode,
} from "@/actions/password-reset";
import { Button } from "../ui/button";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

type Step = 1 | 2 | 3;

/**
 * Three steps, in this order on purpose: identify the account, verify the SMS
 * code, and only then ask for the new password. The code is single-use, so
 * the verify step returns a short-lived reset token that the password step
 * trades in. The token and identifier live only in React state — never in the
 * URL.
 */
export function ForgotPasswordForm() {
  const router = useRouter();

  // Step 1 — the identifier the reset is requested for.
  const [identifier, setIdentifier] = useState("");
  const [isTooShort, setIsTooShort] = useState(false);
  const [isInvalidFormat, setIsInvalidFormat] = useState(false);
  const [requesting, setRequesting] = useState(false);

  // Step 2 — the SMS code. Success yields the reset token for step 3.
  const [step, setStep] = useState<Step>(1);
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  // Step 3 — the new password.
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Same resend cooldown behavior as the login OTP page.
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const restart = useCallback(() => {
    setStep(1);
    setCode("");
    setResetToken(null);
    setPassword("");
    setConfirmPassword("");
    setVerifyError(null);
    setSaveError(null);
  }, []);

  const handleIdentifierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = identifier.trim();

    setIsTooShort(false);
    setIsInvalidFormat(false);

    if (value.length < 2) {
      setIsTooShort(true);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[0-9\s-]{8,15}$/;
    const usernameRegex = /^[a-zA-Z0-9_.-]{3,20}$/;

    const isValidFormat =
      emailRegex.test(value) ||
      phoneRegex.test(value) ||
      usernameRegex.test(value);

    if (!isValidFormat) {
      setIsInvalidFormat(true);
      return;
    }

    setRequesting(true);
    const res = await requestPasswordReset(value);
    setRequesting(false);

    if (!res.success) {
      toast.error(res.error ?? "Failed to send code.");
      return;
    }

    setCode("");
    setVerifyError(null);
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setStep(2);
    toast.success(
      "If an account matches, a code was sent to its registered phone.",
    );
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlightRef.current) return;

    setVerifyError(null);

    if (code.length !== OTP_LENGTH) {
      setVerifyError("Please enter the complete 6-digit verification code.");
      return;
    }

    inFlightRef.current = true;
    setVerifying(true);
    const res = await verifyPasswordResetCode(identifier.trim(), code);
    setVerifying(false);
    inFlightRef.current = false;

    if (!res.success || !res.resetToken) {
      setVerifyError(res.error ?? "Failed to verify the code.");
      setCode("");
      return;
    }

    setResetToken(res.resetToken);
    setStep(3);
  };

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken || saving) return;

    setSaveError(null);

    if (password.length < 8) {
      setSaveError("Your password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setSaveError("Your password and confirm password do not match.");
      return;
    }

    setSaving(true);
    const res = await confirmPasswordReset(resetToken, password);
    setSaving(false);

    if (!res.success) {
      setSaveError(res.error ?? "Failed to reset password.");
      return;
    }

    toast.success("Password updated. Please sign in.");
    router.push("/login");
  };

  const handleResend = useCallback(async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    const res = await requestPasswordReset(identifier.trim());
    setResending(false);

    if (!res.success) {
      toast.error(res.error ?? "Failed to resend code.");
      return;
    }

    setCode("");
    setVerifyError(null);
    setCooldown(RESEND_COOLDOWN_SECONDS);
    toast.success("If an account matches, a new code was sent.");
  }, [cooldown, identifier, resending]);

  return (
    <div className="min-h-[calc(100vh-144px)] mx-auto w-full bg-muted pt-4">
      <div className="w-full max-w-xl mx-auto bg-card rounded-sm border border-border p-6">
        <h1 className="type-page-title text-center mb-4 text-foreground">
          Forgot Password / Account
        </h1>

        {step === 1 && (
          <>
            <p className="type-body-sm text-gray-500 text-center mb-6">
              Enter the phone number, username or email you registered on
              <br />
              PhsarKhmer and we&apos;ll send a code to set a new password.
            </p>

            {isInvalidFormat && (
              <div className="mb-4 bg-red-600 text-white type-body-sm p-3 rounded-sm flex flex-col gap-1">
                <span className="font-bold">⚠️ Forgot password failed!</span>
                <span>The Email, Phone number or Username is invalid.</span>
              </div>
            )}

            <form onSubmit={handleIdentifierSubmit}>
              <Field>
                <FieldLabel htmlFor="password-reset-identifier">
                  Phone Number, Username or Email{" "}
                  <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="password-reset-identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setIsTooShort(false);
                    setIsInvalidFormat(false);
                  }}
                  className={`w-full h-10 bg-blue-50/50 border rounded ${
                    isTooShort || isInvalidFormat
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                      : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  } focus:outline-none focus:ring-1 transition-colors type-body-sm`}
                />
                {isTooShort && (
                  <FieldDescription className="pt-1 text-red-500 type-body-sm">
                    Phone Number, Username or Email must be at least 2
                    characters long.
                  </FieldDescription>
                )}
                {isInvalidFormat && (
                  <FieldDescription className="pt-1 text-red-500 type-meta">
                    Please enter a valid Phone Number, Username or Email
                    address.
                  </FieldDescription>
                )}
              </Field>
              <Button
                type="submit"
                disabled={requesting}
                className="mt-6 bg-orange-500 rounded-sm text-white h-10 w-full hover:bg-orange-600 cursor-pointer font-medium"
              >
                {requesting ? "Sending..." : "Submit"}
              </Button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <p className="type-body-sm text-gray-500 text-center mb-6">
              If an account matches, a 6-digit code was sent by SMS to the phone
              registered on it. Enter the code to verify it.
            </p>

            {verifyError && (
              <div className="mb-4 bg-red-600 text-white type-body-sm p-3 rounded-sm">
                {verifyError}
              </div>
            )}

            <form onSubmit={handleVerifySubmit}>
              <Field>
                <div className="flex items-center justify-between mb-2">
                  <FieldLabel htmlFor="password-reset-code">
                    Verification code
                  </FieldLabel>
                  <Button
                    variant="outline"
                    size="xs"
                    type="button"
                    onClick={() => void handleResend()}
                    disabled={cooldown > 0 || resending}
                  >
                    <RefreshCwIcon className="mr-1 h-3 w-3" />
                    {cooldown > 0
                      ? `Resend code (${cooldown}s)`
                      : "Resend code"}
                  </Button>
                </div>
                <div className="flex justify-center py-2">
                  <InputOTP
                    maxLength={OTP_LENGTH}
                    id="password-reset-code"
                    value={code}
                    onChange={(newValue) => setCode(newValue)}
                    autoFocus
                    required
                    disabled={verifying}
                  >
                    <InputOTPGroup className="*:data-[slot=input-otp-slot]:h-12 *:data-[slot=input-otp-slot]:w-12 *:data-[slot=input-otp-slot]:text-xl">
                      {Array.from({ length: OTP_LENGTH }, (_, index) => (
                        <InputOTPSlot key={index} index={index} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </Field>

              <Button
                type="submit"
                disabled={verifying}
                className="mt-4 bg-orange-500 rounded-sm text-white h-10 w-full hover:bg-orange-600 cursor-pointer font-medium"
              >
                {verifying ? "Verifying..." : "Verify Code"}
              </Button>
            </form>

            <button
              type="button"
              onClick={restart}
              className="block mx-auto mt-5 type-body-sm text-muted-foreground underline underline-offset-4 hover:text-primary"
            >
              Use a different phone number, username or email
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <p className="type-body-sm text-gray-500 text-center mb-6">
              Your phone is verified. Set a new password for your account.
            </p>

            {saveError && (
              <div className="mb-4 bg-red-600 text-white type-body-sm p-3 rounded-sm">
                {saveError}
              </div>
            )}

            <form onSubmit={handleConfirmSubmit} className="space-y-5">
              <Field>
                <FieldLabel htmlFor="password-reset-new">
                  New Password <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="password-reset-new"
                  type="password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 bg-blue-50/50 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:border-blue-500 focus:ring-blue-500 transition-colors type-body-sm"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="password-reset-confirm">
                  Confirm New Password{" "}
                  <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="password-reset-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full h-10 bg-blue-50/50 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:border-blue-500 focus:ring-blue-500 transition-colors type-body-sm"
                />
              </Field>

              <Button
                type="submit"
                disabled={saving}
                className="bg-orange-500 rounded-sm text-white h-10 w-full hover:bg-orange-600 cursor-pointer font-medium"
              >
                {saving ? "Saving..." : "Set New Password"}
              </Button>
            </form>

            <button
              type="button"
              onClick={restart}
              className="block mx-auto mt-5 type-body-sm text-muted-foreground underline underline-offset-4 hover:text-primary"
            >
              Start over
            </button>
          </>
        )}
      </div>
    </div>
  );
}
