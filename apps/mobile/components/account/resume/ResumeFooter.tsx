import { Colors } from "@/constants/Colors";
import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ResumeFooterProps {
  primaryLabel: string;
  onPrimary: () => void;
  /** Renders the reference's secondary Skip button. */
  onSkip?: () => void;
  saving?: boolean;
  disabled?: boolean;
}

/** Fixed bottom bar: dark surface, orange primary, dark Skip. */
export default function ResumeFooter({
  primaryLabel,
  onPrimary,
  onSkip,
  saving = false,
  disabled = false,
}: ResumeFooterProps) {
  const insets = useSafeAreaInsets();
  const blocked = saving || disabled;

  return (
    <View
      className="border-t border-gray-100 bg-white px-4 pt-3 dark:border-[#2C2C2E] dark:bg-[#171717]"
      style={{ paddingBottom: insets.bottom + 12 }}
    >
      <View className="flex-row gap-3">
        {onSkip ? (
          <TouchableOpacity
            onPress={onSkip}
            disabled={saving}
            activeOpacity={0.8}
            className="h-12 w-28 items-center justify-center rounded-lg bg-gray-200 dark:bg-[#444444]"
            accessibilityRole="button"
            accessibilityLabel="Skip"
          >
            <Text className="text-base font-bold text-gray-900 dark:text-white">
              Skip
            </Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          onPress={onPrimary}
          disabled={blocked}
          activeOpacity={0.85}
          className={`h-12 flex-1 items-center justify-center rounded-lg ${
            blocked ? "opacity-60" : ""
          }`}
          style={{ backgroundColor: Colors.secondary.DEFAULT }}
          accessibilityRole="button"
          accessibilityLabel={primaryLabel}
        >
          {saving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-base font-bold text-white">
              {primaryLabel}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
