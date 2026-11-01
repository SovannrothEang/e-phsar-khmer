import { AuthField } from "@/components/auth/AuthField";
import { AuthHeader } from "@/components/auth/AuthHeader";
import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [isResending, setIsResending] = useState(false);
  const inputRef = useRef<TextInput>(null);

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

  useEffect(() => {
    const focus = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(focus);
  }, []);

  const handleSubmit = async () => {
    setError("");
    if (code.trim().length < 4) {
      setError("Enter the code from the SMS.");
      return;
    }
    if (isRegister) {
      if (!firstName.trim()) {
        setError("Enter your first name.");
        return;
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
    }
    setIsLoading(true);
    const result = isRegister
      ? await verifyOtp(code, { password, firstName, lastName })
      : await verifyOtp(code);
    setIsLoading(false);
    if (result.kind === "authenticated") {
      router.replace("/(tabs)/account");
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
      <AuthHeader title="Verification Code" />

      <ScrollView
        className="flex-1 px-5 py-6"
        contentContainerStyle={{ paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text
          className={`text-center text-sm leading-6 ${
            isDark ? "text-gray-300" : "text-neutral-text-sub"
          }`}
        >
          {isRegister ? "Confirm your new account" : "Confirm your login"} for
        </Text>
        <Text
          className={`mt-1 text-center text-base font-bold ${
            isDark ? "text-white" : "text-neutral-text-main"
          }`}
        >
          {pendingVerification.phone}
        </Text>

        <View className="mt-8">
          <AuthField
            label="6-digit code"
            value={code}
            onChangeText={(value) => {
              setCode(value.replace(/[^0-9]/g, ""));
              if (error) setError("");
            }}
            placeholder="000000"
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={8}
            inputRef={inputRef}
            inputClassName="text-center text-2xl font-bold tracking-[10px]"
          />
        </View>

        {isRegister ? (
          <View className="mt-6 gap-4">
            <Text
              className={`text-sm font-semibold ${
                isDark ? "text-gray-200" : "text-neutral-text-main"
              }`}
            >
              Create your account
            </Text>
            <AuthField
              label="First Name"
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First name"
              autoCapitalize="words"
              maxLength={100}
            />
            <AuthField
              label="Last Name"
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last name (optional)"
              autoCapitalize="words"
              maxLength={100}
            />
            <AuthField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              secure
              autoCapitalize="none"
              autoComplete="new-password"
            />
          </View>
        ) : null}

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
          className={`mt-6 items-center justify-center rounded-xl bg-secondary-orange py-4 shadow-xs ${
            isLoading ? "opacity-60" : ""
          }`}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-base font-bold text-white">
              {isRegister ? "Create account" : "Sign in"}
            </Text>
          )}
        </TouchableOpacity>

        <View className="mt-6 items-center">
          {secondsLeft > 0 ? (
            <Text
              className={`text-sm ${
                isDark ? "text-gray-400" : "text-neutral-text-sub"
              }`}
            >
              Resend code in {secondsLeft}s
            </Text>
          ) : (
            <TouchableOpacity
              onPress={handleResend}
              disabled={isResending}
              className="py-2"
            >
              {isResending ? (
                <ActivityIndicator color={Colors.primary.DEFAULT} />
              ) : (
                <Text className="text-sm font-semibold text-primary">
                  Resend code
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
