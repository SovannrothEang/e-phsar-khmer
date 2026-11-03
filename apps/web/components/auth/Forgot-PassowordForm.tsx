"use client";

import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/sonner";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "../ui/button";
import { useRouter } from "@/i18n/routing";
import { requestPasswordReset, resetPassword } from "@/actions/otp";
import type { OtpErrorCode } from "@/lib/otp-errors";
import { formatPhoneLocal } from "@/lib/phone";

/** Same rule as the backend DTOs (`ForgotPasswordDto` / `ResetPasswordDto`). */
const PHONE_PATTERN = /^\+?[1-9]\d{6,14}$/;
const DEFAULT_RESEND_SECONDS = 60;

type Failure = {
  code: OtpErrorCode;
  error?: string;
  retryAfterSeconds?: number;
};

/**
 * Two-step forgot-password against `POST /auth/password/forgot` and
 * `POST /auth/password/reset` (the own-OTP path; the endpoints answer 503
 * `OTP_PROVIDER_UNSUPPORTED` under `OTP_PROVIDER=supabase`). The layout of the
 * original mock is kept — only its behaviour is real now: it promised email
 * and username resets the backend cannot do.
 */
export function ForgotPasswordForm() {
  const t = useTranslations("ForgotPassword");
  const router = useRouter();

  const [step, setStep] = useState<"request" | "reset">("request");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // One shared countdown: the API owns the wait, this only ticks it down.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const messageFor = useCallback(
    (failure: Failure): string => {
      switch (failure.code) {
        case "cooldown":
          return t("cooldown", {
            seconds: failure.retryAfterSeconds ?? DEFAULT_RESEND_SECONDS,
          });
        case "daily_cap":
          return t("dailyCap");
        case "send_failed":
          return t("sendFailed");
        case "provider_unsupported":
          return t("providerUnsupported");
        case "invalid_code":
        case "too_many_attempts":
          return t("invalidCode");
        default:
          return failure.error ?? t("unknownError");
      }
    },
    [t],
  );

  const requestCode = useCallback(async () => {
    const trimmed = phone.trim();
    if (!PHONE_PATTERN.test(trimmed)) {
      setError(t("invalidPhone"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await requestPasswordReset(trimmed);
      if (res.success) {
        setCooldown(res.retryAfterSeconds);
        setCode("");
        setNewPassword("");
        setStep("reset");
      } else {
        if (res.code === "cooldown") {
          setCooldown(res.retryAfterSeconds ?? DEFAULT_RESEND_SECONDS);
        }
        setError(messageFor(res));
      }
    } catch {
      setError(t("unknownError"));
    } finally {
      setBusy(false);
    }
  }, [messageFor, phone, t]);

  const submitReset = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (newPassword.length < 8) {
        setError(t("passwordRule"));
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const res = await resetPassword(phone.trim(), code.trim(), newPassword);
        if (res.success) {
          toast.success(t("success"));
          router.push("/login");
        } else {
          setError(messageFor(res));
        }
      } catch {
        setError(t("unknownError"));
      } finally {
        setBusy(false);
      }
    },
    [code, messageFor, newPassword, phone, router, t],
  );

  return (
    <div className="h-[calc(100vh-144px)] mx-auto w-full bg-muted pt-4">
      <form
        onSubmit={
          step === "request"
            ? (event: React.FormEvent) => {
                event.preventDefault();
                void requestCode();
              }
            : submitReset
        }
        className="w-full max-w-xl mx-auto bg-card rounded-sm border border-border p-6"
      >
        <h1 className="type-page-title text-center mb-4 text-foreground">
          {t("title")}
        </h1>
        <p className="type-body-sm text-gray-500 text-center mb-6">
          {step === "request" ? (
            t("description")
          ) : (
            <>
              {t("sentTo", { phone: formatPhoneLocal(phone) })}
              <br />
              {t("codeDescription")}
            </>
          )}
        </p>

        {error && (
          <div
            role="alert"
            className="mb-4 bg-red-600 text-white type-body-sm p-3 rounded-sm flex flex-col gap-1"
          >
            <span className="font-bold">⚠️ {t("errorTitle")}</span>
            <span>{error}</span>
          </div>
        )}

        {step === "request" ? (
          <Field>
            <FieldLabel htmlFor="forgot-phone">
              {t("phoneLabel")} <span className="text-destructive">*</span>
            </FieldLabel>
            <Input
              id="forgot-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder={t("phonePlaceholder")}
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                setError(null);
              }}
              className="w-full h-10 bg-blue-50/50 border rounded border-gray-300 focus:border-blue-500 focus:ring-blue-500 focus:outline-none focus:ring-1 transition-colors type-body-sm"
            />
            <FieldDescription className="pt-1 type-body-sm">
              {t("phoneHint")}
            </FieldDescription>
          </Field>
        ) : (
          <div className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="forgot-code">
                {t("codeLabel")} <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                id="forgot-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.replace(/\D/g, ""));
                  setError(null);
                }}
                className="w-full h-10 bg-blue-50/50 border rounded border-gray-300 focus:border-blue-500 focus:ring-blue-500 focus:outline-none focus:ring-1 transition-colors type-body-sm"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="forgot-password">
                {t("newPasswordLabel")}{" "}
                <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                id="forgot-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => {
                  setNewPassword(event.target.value);
                  setError(null);
                }}
                className="w-full h-10 bg-blue-50/50 border rounded border-gray-300 focus:border-blue-500 focus:ring-blue-500 focus:outline-none focus:ring-1 transition-colors type-body-sm"
              />
              <FieldDescription className="pt-1 type-body-sm">
                {t("newPasswordHint")}
              </FieldDescription>
            </Field>
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="xs"
                type="button"
                disabled={busy || cooldown > 0}
                onClick={() => void requestCode()}
              >
                {cooldown > 0
                  ? t("resendIn", { seconds: cooldown })
                  : t("resend")}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setStep("request");
                  setError(null);
                }}
                className="underline underline-offset-4 transition-colors hover:text-primary type-body-sm text-muted-foreground"
              >
                {t("useDifferentNumber")}
              </button>
            </div>
          </div>
        )}
        <Button
          type="submit"
          disabled={busy}
          className="mt-6 bg-orange-500 rounded-sm text-white h-10 w-full hover:bg-orange-600 cursor-pointer font-medium"
        >
          {busy
            ? step === "request"
              ? t("sending")
              : t("resetting")
            : step === "request"
              ? t("sendCode")
              : t("reset")}
        </Button>
      </form>
    </div>
  );
}
