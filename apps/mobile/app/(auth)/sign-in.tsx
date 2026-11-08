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
  Modal,
  Pressable,
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
  // A suspended account cannot sign in, so this dialog is its only surface for
  // the reason and the appeal channels.
  const [suspended, setSuspended] = useState<{
    reason: string | null;
    support: { email?: string; telegram?: string; phone?: string };
  } | null>(null);

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

      {/* Only shown after a 403 ACCOUNT_SUSPENDED: the backend refuses every
          sign-in for a suspended account, so this dialog is where the reason
          and the appeal channels live. */}
      <Modal
        visible={suspended !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSuspended(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/50 px-6">
          <View className="w-full rounded-md bg-white dark:bg-gray-900 p-5 gap-3">
            <Text className="text-lg font-bold text-gray-900 dark:text-white">
              This account is suspended
            </Text>
            <Text className="text-sm text-gray-600 dark:text-gray-300">
              {suspended?.reason ??
                "An administrator has suspended this account. You cannot sign in until it is reviewed."}
            </Text>
            {(() => {
              const support = suspended?.support ?? {};
              const rows = [
                support.email ? ["Email", support.email] : null,
                support.telegram ? ["Telegram", support.telegram] : null,
                support.phone ? ["Phone", support.phone] : null,
              ].filter((row): row is [string, string] => row !== null);
              if (rows.length === 0) {
                return (
                  <Text className="text-sm text-gray-600 dark:text-gray-300">
                    Contact support through the app&apos;s help channels to
                    request a review.
                  </Text>
                );
              }
              return (
                <View className="gap-1">
                  <Text className="text-sm font-semibold text-gray-900 dark:text-white">
                    Contact us to resolve it:
                  </Text>
                  {rows.map(([label, value]) => (
                    <Text
                      key={label}
                      className="text-sm text-gray-600 dark:text-gray-300"
                    >
                      {label}: {value}
                    </Text>
                  ))}
                </View>
              );
            })()}
            <Pressable
              accessibilityRole="button"
              onPress={() => setSuspended(null)}
              className="mt-2 h-[44px] items-center justify-center rounded-[4px] bg-secondary-orange"
            >
              <Text className="text-white font-bold text-base">Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default SignInScreen;
