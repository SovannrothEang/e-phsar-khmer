import { AuthField } from "@/components/auth/AuthField";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { SocialAuthSection } from "@/components/auth/SocialAuthSection";
import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
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
      router.push({
        pathname: "/(auth)/otp",
        params: { mode: "register" },
      } as never);
      return;
    }
    if (result.kind === "authenticated") {
      router.replace("/(tabs)/account");
      return;
    }
    setPhoneError(result.message);
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
        <Text className="text-neutral-text-sub dark:text-gray-300 text-center text-sm leading-6 mb-6">
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
            className={`bg-secondary-orange py-4 rounded-xl items-center justify-center mt-2 shadow-xs ${
              isLoading ? "opacity-60" : ""
            }`}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-base">Submit</Text>
            )}
          </TouchableOpacity>

          <View className="flex-row justify-center items-center gap-1 mt-1">
            <Text className="text-sm text-neutral-text-sub dark:text-gray-400">
              Already have an account?
            </Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/sign-in")}>
              <Text className="text-primary font-bold text-sm">Log in</Text>
            </TouchableOpacity>
          </View>
        </View>

        <SocialAuthSection variant="telegramOnly" />
      </ScrollView>
    </SafeAreaView>
  );
};

export default SignUpScreen;
