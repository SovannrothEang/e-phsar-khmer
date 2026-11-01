import { Colors } from "@/constants/Colors";
import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";

interface SocialAuthSectionProps {
  /**
   * `telegramOnly` matches the reference Register screen, which shows only
   * Telegram; `all` adds the Facebook and Google circles.
   */
  variant?: "all" | "telegramOnly";
}

/**
 * Social sign-in is deferred: native OAuth needs a backend redirect
 * allow-list change (see tasks/plan-mobile-backend.md). Every provider
 * explains that it is unavailable instead of minting a fake session.
 */
export const SocialAuthSection: React.FC<SocialAuthSectionProps> = ({
  variant = "all",
}) => {
  const { isDark } = useTheme();

  const notAvailable = (provider: string) =>
    Alert.alert(provider, "Social sign-in is not available yet.");

  return (
    <View className="my-5">
      {/* Divider */}
      <View className="flex-row items-center mb-5">
        <View
          className={`flex-1 h-[1px] ${
            isDark ? "bg-gray-800" : "bg-neutral-border"
          }`}
        />
        <Text
          className={`px-4 text-sm font-medium ${
            isDark ? "text-gray-400" : "text-neutral-text-sub"
          }`}
        >
          Quickly Connect
        </Text>
        <View
          className={`flex-1 h-[1px] ${
            isDark ? "bg-gray-800" : "bg-neutral-border"
          }`}
        />
      </View>

      {/* Telegram */}
      <TouchableOpacity
        onPress={() => notAvailable("Telegram Sign-In")}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Sign in or register with Telegram"
        className="bg-[#24A1DE] h-12 rounded-lg flex-row items-center justify-center mb-3.5 shadow-2xs px-4"
      >
        <View className="flex-row items-center">
          <View className="w-6 h-6 rounded-full bg-white items-center justify-center mr-2.5">
            <Ionicons
              name="paper-plane"
              size={13}
              color={Colors.social.telegram}
              style={{ marginLeft: -1, marginTop: 1 }}
            />
          </View>
          <View className="w-[1px] h-4 bg-white/40 mr-3" />
          <Text className="text-white font-semibold text-[15px]">
            Sign in or register with Telegram
          </Text>
        </View>
      </TouchableOpacity>

      {variant === "all" && (
        <View className="flex-row justify-center items-center gap-5 mb-2">
          {/* Facebook */}
          <TouchableOpacity
            onPress={() => notAvailable("Facebook Sign-In")}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Sign in with Facebook"
            className="items-center justify-center shadow-xs"
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: Colors.social.facebook,
            }}
          >
            <Ionicons name="logo-facebook" size={26} color="white" />
          </TouchableOpacity>

          {/* Google */}
          <TouchableOpacity
            onPress={() => notAvailable("Google Sign-In")}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Sign in with Google"
            className="items-center justify-center shadow-xs"
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: Colors.social.google,
            }}
          >
            <Ionicons name="logo-google" size={24} color="white" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};
