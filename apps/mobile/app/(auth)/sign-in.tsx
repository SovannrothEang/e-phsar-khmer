import { AuthField } from "@/components/auth/AuthField";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { SocialAuthSection } from "@/components/auth/SocialAuthSection";
import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/contexts/AuthContext";
import { looksLikePhone } from "@/lib/phone";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const SignInScreen = () => {
  const router = useRouter();
  const { signIn } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [identifierError, setIdentifierError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    const value = identifier.trim();
    let hasError = false;

    if (!value) {
      setIdentifierError("Please enter your Phone Number or Username.");
      hasError = true;
    } else {
      setIdentifierError("");
    }

    if (!password.trim()) {
      setPasswordError("Please enter your password.");
      hasError = true;
    } else if (password.length < (looksLikePhone(value) ? 8 : 6)) {
      setPasswordError(
        `The Password must be at least ${
          looksLikePhone(value) ? 8 : 6
        } characters in length.`,
      );
      hasError = true;
    } else {
      setPasswordError("");
    }

    if (hasError) return;

    setIsLoading(true);
    const result = await signIn(identifier, password);
    setIsLoading(false);

    if (result.kind === "authenticated") {
      router.replace("/(tabs)/account");
      return;
    }
    if (result.kind === "otp") {
      router.push({
        pathname: "/(auth)/otp",
        params: { mode: "login" },
      } as never);
      return;
    }
    setPasswordError(result.message);
  };

  const handleForgotPassword = () => {
    Alert.alert(
      "Forgot Password",
      "Password reset isn't available yet. Please contact support for help.",
    );
  };

  return (
    <SafeAreaView
      statusBarColor={Colors.primary.DEFAULT}
      statusBarStyle="light-content"
      className="bg-neutral-background dark:bg-gray-950 flex-1"
    >
      <AuthHeader title="Login" />

      <ScrollView
        className="flex-1 px-5 py-6"
        contentContainerStyle={{ paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar */}
        <View className="items-center mb-7">
          <View
            className="items-center justify-center rounded-full"
            style={{
              width: 112,
              height: 112,
              borderRadius: 56,
              backgroundColor: Colors.neutral.border,
            }}
          >
            <Ionicons name="person" size={64} color="#9CA3AF" />
          </View>
        </View>

        <View className="gap-4">
          <AuthField
            label="Phone Number or Username"
            value={identifier}
            onChangeText={(value) => {
              setIdentifier(value);
              if (value.trim()) setIdentifierError("");
            }}
            error={identifierError}
            placeholder="Phone Number or Username"
            autoCapitalize="none"
            autoComplete="username"
          />

          <AuthField
            label="Password"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              if (value.length >= 6) setPasswordError("");
            }}
            error={passwordError}
            placeholder="Enter your password"
            secure
            autoCapitalize="none"
            autoComplete="current-password"
          />

          <TouchableOpacity
            onPress={handleForgotPassword}
            className="self-end -mt-1"
            accessibilityRole="button"
          >
            <Text className="text-primary font-semibold text-sm">
              Forgot Password?
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSignIn}
            disabled={isLoading}
            activeOpacity={0.8}
            accessibilityRole="button"
            className={`bg-secondary-orange py-4 rounded-xl items-center justify-center mt-1 shadow-xs ${
              isLoading ? "opacity-60" : ""
            }`}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-base">Submit</Text>
            )}
          </TouchableOpacity>

          <View className="flex-row justify-center items-center gap-1">
            <Text className="text-sm text-neutral-text-sub dark:text-gray-400">
              Don&apos;t have an account?
            </Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/sign-up")}>
              <Text className="text-primary font-bold text-sm">Register</Text>
            </TouchableOpacity>
          </View>
        </View>

        <SocialAuthSection />
      </ScrollView>
    </SafeAreaView>
  );
};

export default SignInScreen;
