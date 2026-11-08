import { AuthHeader } from "@/components/auth/AuthHeader";
import { OtpCodeInput } from "@/components/auth/OtpCodeInput";
import { SuspendedDialog } from "@/components/auth/SuspendedDialog";
import type { SuspensionInfo } from "@/components/auth/SuspendedDialog";
import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const RESEND_SECONDS = 60;

export default function OtpScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { pendingVerification, verifyOtp, resendOtp } = useAuth();

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // The OTP verify is a sign-in, so a suspension can surface here too — this
  // screen is then the only page the blocked user can see.
  const [suspended, setSuspended] = useState<SuspensionInfo | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [isResending, setIsResending] = useState(false);

  // `pendingVerification` lives in memory only, so a reload loses it. The
  // route param is the fallback that keeps the "expired" screen honest.
  const routeMode = params.mode === "register" ? "register" : "login";
  const isRegister = pendingVerification?.mode === "register";

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async () => {
    setError("");
    if (code.trim().length < 4) {
      setError("Enter the code from the SMS.");
      return;
    }
    const profile =
      pendingVerification?.mode === "register"
        ? pendingVerification.profile
        : undefined;
    if (isRegister && !profile) {
      setError("Start again from the register screen.");
      return;
    }
    setIsLoading(true);
    const result = profile
      ? await verifyOtp(code, profile)
      : await verifyOtp(code);
    setIsLoading(false);
    if (result.kind === "authenticated") {
      router.replace("/(tabs)");
      return;
    }
    if (result.kind === "suspended") {
      setSuspended({ reason: result.reason, support: result.support });
      return;
    }
    if (result.kind === "error") setError(result.message);
  };

  const handleResend = async () => {
    if (secondsLeft > 0 || isResending) return;
    setIsResending(true);
    const result = await resendOtp();
    setIsResending(false);
    if (result.success) {
      setSecondsLeft(RESEND_SECONDS);
      setError("");
    } else {
      setError(result.error ?? "Could not resend the code.");
    }
  };

  if (!pendingVerification) {
    const wasRegister = routeMode === "register";
    return (
      <SafeAreaView
        statusBarColor={Colors.primary.DEFAULT}
        statusBarStyle="light-content"
        className={`${isDark ? "bg-gray-950" : "bg-neutral-background"} flex-1`}
      >
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons
            name="shield-checkmark-outline"
            size={56}
            color={Colors.primary.DEFAULT}
          />
          <Text
            className={`mt-4 text-lg font-bold ${
              isDark ? "text-white" : "text-neutral-text-main"
            }`}
          >
            Verification expired
          </Text>
          <Text
            className={`mt-2 text-center text-sm ${
              isDark ? "text-gray-400" : "text-neutral-text-sub"
            }`}
          >
            Start again with your phone number.
          </Text>
          <TouchableOpacity
            onPress={() =>
              router.replace(
                wasRegister ? "/(auth)/sign-up" : "/(auth)/sign-in",
              )
            }
            className="mt-6 rounded-xl bg-secondary-orange px-8 py-3.5"
          >
            <Text className="font-bold text-white">
              {wasRegister ? "Back to register" : "Back to login"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      statusBarColor={Colors.primary.DEFAULT}
      statusBarStyle="light-content"
      className={`${isDark ? "bg-gray-950" : "bg-neutral-background"} flex-1`}
    >
      <AuthHeader title="Confirm Phone" />

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingVertical: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text
          className={`text-center text-[26px] font-bold ${
            isDark ? "text-white" : "text-neutral-text-main"
          }`}
        >
          {pendingVerification.phone}
        </Text>

        <Text
          className={`mt-4 text-center text-sm leading-6 ${
            isDark ? "text-gray-300" : "text-neutral-text-sub"
          }`}
        >
          We have just sent a verification code via{" "}
          <Text className="text-primary font-semibold">SMS</Text> to this phone
          number{" "}
          <Text className="text-primary font-semibold">
            {pendingVerification.phone}
          </Text>
          . Please enter the code you received from{" "}
          <Text className="text-primary font-semibold">SMS</Text> here.
        </Text>

        <View className="mt-7">
          <OtpCodeInput
            value={code}
            onChange={(next) => {
              setCode(next);
              if (error) setError("");
            }}
            error={Boolean(error)}
          />
        </View>

        {error ? (
          <View className="mt-3 flex-row items-center gap-1.5">
            <Ionicons name="alert-circle" size={15} color="#EF4444" />
            <Text className="text-xs font-medium text-red-500">{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isLoading}
          activeOpacity={0.8}
          accessibilityRole="button"
          className={`mt-6 items-center justify-center rounded-[4px] bg-secondary-orange h-[44px] shadow-xs ${
            isLoading ? "opacity-60" : ""
          }`}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-base font-bold text-white">Verify</Text>
          )}
        </TouchableOpacity>

        <View className="mt-8 items-center">
          <Text
            className={`text-sm ${
              isDark ? "text-gray-300" : "text-neutral-text-main"
            }`}
          >
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
      </ScrollView>

      <SuspendedDialog info={suspended} onClose={() => setSuspended(null)} />
    </SafeAreaView>
  );
}
