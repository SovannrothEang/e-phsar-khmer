import { AuthField } from "@/components/auth/AuthField";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { SocialAuthSection } from "@/components/auth/SocialAuthSection";
import { SuspendedDialog } from "@/components/auth/SuspendedDialog";
import type { SuspensionInfo } from "@/components/auth/SuspendedDialog";
import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/contexts/AuthContext";
import { SELL_ROUTE, wantsSellAfterAuth } from "@/lib/auth-redirect";
import { looksLikePhone } from "@/lib/phone";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const SignInScreen = () => {
  const router = useRouter();
  const { signIn } = useAuth();
  const params = useLocalSearchParams<{ next?: string | string[] }>();
  // Carried from Welcome: "sell" resumes the posting flow after sign-in.
  const next = Array.isArray(params.next) ? params.next[0] : params.next;

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [identifierError, setIdentifierError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // A suspended account cannot sign in, so this dialog is its only surface for
  // the reason and the appeal channels.
  const [suspended, setSuspended] = useState<SuspensionInfo | null>(null);

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
      router.replace(
        wantsSellAfterAuth(next) ? (SELL_ROUTE as never) : "/(tabs)/account",
      );
      return;
    }
    if (result.kind === "otp") {
      router.push({
        pathname: "/(auth)/otp",
        params: next ? { mode: "login", next } : { mode: "login" },
      } as never);
      return;
    }
    if (result.kind === "suspended") {
      setSuspended({ reason: result.reason, support: result.support });
      return;
    }
    setPasswordError(result.message);
  };

  const handleForgotPassword = () => {
    router.push("/(auth)/forgot-password");
  };

  return (
    <SafeAreaView
      statusBarColor={Colors.primary.DEFAULT}
      statusBarStyle="light-content"
      className="bg-neutral-background dark:bg-gray-950 flex-1"
    >
      <AuthHeader title="Login" />

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingVertical: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar — 24dp above (the content padding) and 24dp below, so it
            sits centred between the header and the first field. */}
        <View className="items-center mb-6">
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
            className="self-end"
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
            className={`bg-secondary-orange h-[44px] rounded-[4px] items-center justify-center mt-[24px] shadow-xs ${
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

        {/* One even rhythm above/below the divider, Telegram and the circles.
            Welcome's `space-evenly` lands near 48dp on a tall phone; here a
            fixed 40dp reads closer to it on shorter screens. */}
        <View className="mt-[40px]">
          <SocialAuthSection gap={40} />
        </View>
      </ScrollView>

      <SuspendedDialog info={suspended} onClose={() => setSuspended(null)} />
    </SafeAreaView>
  );
};

export default SignInScreen;
