import { AuthField } from "@/components/auth/AuthField";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { OtpCodeInput } from "@/components/auth/OtpCodeInput";
import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/api/client";
import {
  confirmPasswordReset,
  requestPasswordReset,
  verifyPasswordResetCode,
  type ResetAccount,
} from "@/lib/api/auth";
import { looksLikePhone, normalizePhone } from "@/lib/phone";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Step = "identifier" | "code" | "password";

/**
 * The reset form accepts a phone, a username, or an email. Only phone-shaped
 * values may be rewritten — normalizing a username would mangle it — and
 * spaces/dashes are stripped because the backend compares the bare number.
 */
function normalizeIdentifier(raw: string): string {
  const trimmed = raw.trim();
  if (!/^[+\d][\d\s-]{5,}$/.test(trimmed)) return trimmed;
  const compact = trimmed.replace(/[\s-]/g, "");
  return looksLikePhone(compact)
    ? (normalizePhone(compact) ?? compact)
    : compact;
}

function resetErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Network error. Check your connection and try again.";
  }
  if (error.message === "INVALID_OR_EXPIRED_OTP") {
    return "Invalid or expired code.";
  }
  if (error.message === "INVALID_RESET_TOKEN") {
    return "Your reset session expired. Please start again.";
  }
  if (error.status === 429) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  return error.message || "Something went wrong. Please try again.";
}

const ForgotPasswordScreen = () => {
  const router = useRouter();
  const { signInWithPassword } = useAuth();

  const [step, setStep] = useState<Step>("identifier");
  /** What the user typed — shown back to them unchanged. */
  const [identifier, setIdentifier] = useState("");
  /** The same value normalized for the API (local phones become +855…). */
  const [requestIdentifier, setRequestIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [account, setAccount] = useState<ResetAccount | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (step !== "code" || secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [step, secondsLeft]);

  const handleRequest = async () => {
    const value = normalizeIdentifier(identifier);
    if (!value) {
      setError("Enter your phone number or email.");
      return;
    }
    setIsLoading(true);
    try {
      await requestPasswordReset(value);
      setIdentifier(identifier.trim());
      setRequestIdentifier(value);
      setError("");
      setSecondsLeft(60);
      setStep("code");
    } catch (requestError) {
      setError(resetErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (secondsLeft > 0 || isResending) return;
    setIsResending(true);
    try {
      await requestPasswordReset(requestIdentifier);
      setSecondsLeft(60);
      setError("");
    } catch (resendError) {
      setError(resetErrorMessage(resendError));
    } finally {
      setIsResending(false);
    }
  };

  const handleVerify = async () => {
    if (code.trim().length < 4) {
      setError("Enter the code from the SMS.");
      return;
    }
    setIsLoading(true);
    try {
      const verified = await verifyPasswordResetCode(
        requestIdentifier,
        code.trim(),
      );
      setResetToken(verified.resetToken);
      setAccount(verified.account);
      setError("");
      setStep("password");
    } catch (verifyError) {
      setError(resetErrorMessage(verifyError));
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (password.length < 8) {
      setError("Your password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    setIsLoading(true);
    try {
      await confirmPasswordReset(resetToken, password);
      setError("");
      // The phone was proved by the code this session, so the reset finishes
      // signed in instead of sending the user back through login.
      const outcome = await signInWithPassword(
        account?.username ?? identifier,
        password,
      );
      if (outcome.kind === "authenticated") {
        router.replace("/(tabs)");
        return;
      }
      // The reset itself succeeded; if the automatic sign-in did not (an
      // identifier this login does not accept), send them to log in manually.
      Alert.alert("Password updated", "Sign in with your new password.", [
        { text: "OK", onPress: () => router.replace("/(auth)/sign-in") },
      ]);
    } catch (confirmError) {
      setError(resetErrorMessage(confirmError));
    } finally {
      setIsLoading(false);
    }
  };

  const copy =
    "Enter your phone number or email that you registered on PhsarKhmer and we'll send the code to set the new password";

  // The reset SMS only goes to a phone the account owns, and an email/username
  // identifier never reveals it — the copy stays honest either way.
  const sentToPhone = /^[+\d][\d\s-]{5,}$/.test(identifier);
  const sentTo = sentToPhone
    ? `this phone number ${identifier}`
    : "the phone number on your account";

  // Step 3 names the account the code proved. Backends deployed before the
  // `account` field existed send none, so fall back to what the user typed.
  const accountRows: { label: string; value: string }[] = account
    ? ([
        { label: "Username", value: account.username },
        { label: "Phone", value: account.phone },
        { label: "Email", value: account.email },
      ].filter((row) => Boolean(row.value)) as {
        label: string;
        value: string;
      }[])
    : [
        {
          label: identifier.includes("@")
            ? "Email"
            : sentToPhone
              ? "Phone"
              : "Account",
          value: identifier,
        },
      ];

  const title =
    step === "identifier"
      ? "Find Account"
      : step === "code"
        ? "Confirm Phone"
        : "Set New Password";

  const submitLabel =
    step === "identifier" ? "Submit" : step === "code" ? "Verify" : "Submit";

  const onSubmit =
    step === "identifier"
      ? handleRequest
      : step === "code"
        ? handleVerify
        : handleConfirm;

  return (
    <SafeAreaView
      statusBarColor={Colors.primary.DEFAULT}
      statusBarStyle="light-content"
      className="bg-neutral-background dark:bg-gray-950 flex-1"
    >
      <AuthHeader title={title} />

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingVertical: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === "code" ? (
          <>
            <Text className="text-center text-[26px] font-bold text-neutral-text-main dark:text-white">
              {identifier}
            </Text>
            <Text className="mt-4 text-center text-base leading-6 text-neutral-text-sub dark:text-gray-300">
              We have just sent a verification code via{" "}
              <Text className="text-primary font-semibold">SMS</Text> to{" "}
              {sentTo}. Please enter the code you received from{" "}
              <Text className="text-primary font-semibold">SMS</Text> here.
            </Text>
          </>
        ) : step === "password" ? (
          <>
            <Text className="text-center text-base font-bold text-neutral-text-main dark:text-white">
              You&apos;ll use this password to access your account
            </Text>
            <View className="mt-6 gap-1">
              {accountRows.map((row) => (
                <Text
                  key={row.label}
                  className="text-sm text-neutral-text-main dark:text-gray-300"
                >
                  {row.label}: <Text className="font-bold">{row.value}</Text>
                </Text>
              ))}
            </View>
          </>
        ) : (
          <Text className="text-neutral-text-sub dark:text-gray-300 text-center text-base leading-6">
            {copy}
          </Text>
        )}

        <View className="mt-8 gap-4">
          {step === "identifier" ? (
            <AuthField
              label="Phone Number or Email"
              value={identifier}
              onChangeText={(value) => {
                setIdentifier(value);
                if (error) setError("");
              }}
              error={error}
              autoCapitalize="none"
              autoComplete="username"
            />
          ) : step === "code" ? (
            <>
              <OtpCodeInput
                value={code}
                onChange={(next) => {
                  setCode(next);
                  if (error) setError("");
                }}
                error={Boolean(error)}
              />
              {error ? (
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="alert-circle" size={15} color="#EF4444" />
                  <Text className="text-xs font-medium text-red-500">
                    {error}
                  </Text>
                </View>
              ) : null}
            </>
          ) : (
            <>
              <AuthField
                label="New Password"
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  if (error) setError("");
                }}
                error={error}
                secure
                autoCapitalize="none"
                autoComplete="new-password"
              />
              <AuthField
                label="Confirm Password"
                value={confirmation}
                onChangeText={(value) => {
                  setConfirmation(value);
                  if (error) setError("");
                }}
                secure
                autoCapitalize="none"
                autoComplete="new-password"
              />
            </>
          )}

          <TouchableOpacity
            onPress={onSubmit}
            disabled={isLoading}
            activeOpacity={0.8}
            accessibilityRole="button"
            className={`bg-secondary-orange h-[44px] rounded-[4px] items-center justify-center shadow-xs ${
              isLoading ? "opacity-60" : ""
            }`}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-base">
                {submitLabel}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {step === "code" ? (
          <View className="mt-8 items-center">
            <Text className="text-sm text-neutral-text-main dark:text-gray-300">
              Don&apos;t receive the code?
            </Text>
            {secondsLeft > 0 ? (
              <Text className="mt-3 text-sm text-neutral-text-muted">
                Resend ( {secondsLeft} )
              </Text>
            ) : (
              <TouchableOpacity
                onPress={handleResend}
                disabled={isResending}
                className="mt-3 py-1"
              >
                {isResending ? (
                  <ActivityIndicator color={Colors.primary.DEFAULT} />
                ) : (
                  <Text className="text-sm font-semibold text-primary">
                    Resend
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

export default ForgotPasswordScreen;
