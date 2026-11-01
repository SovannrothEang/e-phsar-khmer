import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

interface AuthHeaderProps {
  /** Renders the PhsarKhmer wordmark block instead of a page title. */
  branding?: boolean;
  /** Page title, used when `branding` is false. */
  title?: string;
  /** Defaults to true; the chevron calls `router.back()`. */
  showBack?: boolean;
  /** Overrides the default back behaviour. */
  onBack?: () => void;
}

/**
 * The blue header shared by the auth screens. It stays blue in both themes —
 * matching the signed-in account header — so the auth flow reads as one piece.
 */
export const AuthHeader: React.FC<AuthHeaderProps> = ({
  branding = false,
  title,
  showBack = true,
  onBack,
}) => {
  const router = useRouter();
  const handleBack = onBack ?? (() => router.back());

  const backButton = showBack ? (
    <TouchableOpacity
      onPress={handleBack}
      className="p-1"
      accessibilityRole="button"
      accessibilityLabel="Back"
    >
      <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
    </TouchableOpacity>
  ) : null;

  if (branding) {
    return (
      <View className="bg-primary px-4 pt-3 pb-8">
        <View className="flex-row items-center justify-between">
          {backButton ?? <View />}
          <View className="flex-row items-center gap-4">
            <TouchableOpacity
              onPress={() => router.push("/(auth)/contact-us")}
              className="p-1"
              accessibilityRole="button"
              accessibilityLabel="Contact support"
            >
              <Ionicons name="headset-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/(auth)/settings")}
              className="p-1"
              accessibilityRole="button"
              accessibilityLabel="Settings"
            >
              <Ionicons name="settings-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View className="items-center mt-3">
          <Text className="text-white text-4xl font-extrabold tracking-tight">
            PhsarKhmer
          </Text>
          <Text className="text-white text-base font-medium mt-1">
            Buy Faster, Sell Faster
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="bg-primary px-4 py-3 flex-row items-center justify-between">
      <View className="flex-row items-center gap-4">
        {backButton}
        <Text className="text-white text-xl font-bold">{title}</Text>
      </View>
      <TouchableOpacity
        onPress={() => router.push("/(auth)/settings")}
        className="p-1"
        accessibilityRole="button"
        accessibilityLabel="Settings"
      >
        <Ionicons name="settings-outline" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
};
