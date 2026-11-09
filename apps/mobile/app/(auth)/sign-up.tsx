import { AuthField } from "@/components/auth/AuthField";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { SocialAuthSection } from "@/components/auth/SocialAuthSection";
import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/contexts/AuthContext";
import { SELL_ROUTE, wantsSellAfterAuth } from "@/lib/auth-redirect";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const SignUpScreen = () => {
  const router = useRouter();
  const { signUp } = useAuth();
  const params = useLocalSearchParams<{ next?: string | string[] }>();
  // Carried from Welcome: "sell" resumes the posting flow after register.
  const next = Array.isArray(params.next) ? params.next[0] : params.next;

  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSignUp = async () => {
    if (!phoneNumber.trim()) {
      setPhoneError("Please enter your phone number.");
      return;
    }
    setPhoneError("");

    setIsLoading(true);
    const result = await signUp({ phone: phoneNumber });
    setIsLoading(false);

    if (result.kind === "otp") {
      // Name + password are collected next; the code is verified last.
      router.push(
        next
          ? ({
              pathname: "/(auth)/create-account",
              params: { next },
            } as never)
          : ("/(auth)/create-account" as never),
      );
      return;
    }
    if (result.kind === "authenticated") {
      router.replace(
        wantsSellAfterAuth(next) ? (SELL_ROUTE as never) : "/(tabs)/account",
      );
      return;
    }
    // Registration cannot suspend an account, but the outcome union carries
    // the case; never fall through to reading `.message` on it.
    setPhoneError(
      result.kind === "error"
        ? result.message
        : "This account is suspended. Contact support.",
    );
  };

  return (
    <SafeAreaView
      statusBarColor={Colors.primary.DEFAULT}
      statusBarStyle="light-content"
      className="bg-neutral-background dark:bg-gray-950 flex-1"
    >
      <AuthHeader title="Register" />

      <ScrollView
        className="flex-1 px-5 py-6"
        contentContainerStyle={{ paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-neutral-text-sub dark:text-gray-300 text-center text-[16px] leading-7 mb-6">
          Please enter your phone number and we&apos;ll send the code to
          register your new account.
        </Text>

        <View className="gap-4">
          <AuthField
            label="Phone Number"
            value={phoneNumber}
            onChangeText={(value) => {
              setPhoneNumber(value);
              if (value.trim()) setPhoneError("");
            }}
            error={phoneError}
            placeholder="0"
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
          />

          <TouchableOpacity
            onPress={handleSignUp}
            disabled={isLoading}
            activeOpacity={0.8}
            accessibilityRole="button"
            className={`bg-secondary-orange h-[44px] rounded-[4px] items-center justify-center mt-2 shadow-xs ${
              isLoading ? "opacity-60" : ""
            }`}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-base">Submit</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Same rhythm as Welcome/Login: one 40dp gap under Submit and the
            same again between the divider and Telegram. */}
        <View className="mt-[40px]">
          <SocialAuthSection variant="telegramOnly" gap={40} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SignUpScreen;
