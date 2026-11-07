import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

interface ResumeHeaderProps {
  title: string;
  /** 1–8 on the wizard steps; omitted on the start screen and entry forms. */
  step?: number;
  onBack: () => void;
  /** Step 1 closes the wizard with an X; every other screen goes back. */
  close?: boolean;
  /**
   * The reference left-aligns every step title right after the back/X control;
   * the start screen and Add/Edit forms keep theirs centred.
   */
  align?: "left" | "center";
  /** Optional trailing control (the finished view's edit-document button). */
  right?: React.ReactNode;
}

/** Dark (reference) header with the outlined step pill. */
export default function ResumeHeader({
  title,
  step,
  onBack,
  close = false,
  align = "left",
  right,
}: ResumeHeaderProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const iconColor = isDark ? "#FFFFFF" : "#111827";

  return (
    <View className="relative border-b border-gray-100 bg-white px-4 dark:border-[#0A0A0A] dark:bg-[#171717]">
      <View className="h-14 flex-row items-center">
        <TouchableOpacity
          onPress={onBack}
          className="h-10 w-10 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel={close ? "Close" : "Back"}
        >
          <Ionicons
            name={close ? "close" : "chevron-back"}
            size={26}
            color={iconColor}
          />
        </TouchableOpacity>

        {align === "center" ? (
          <>
            <View className="h-10 flex-1" />
            {step ? (
              <View className="rounded-full border border-gray-300 px-4 py-1.5 dark:border-white/80">
                <Text className="text-sm font-semibold text-gray-900 dark:text-white">
                  Step {step} of 8
                </Text>
              </View>
            ) : null}
            {right ? (
              <View className="ml-1 w-10 items-center justify-center">
                {right}
              </View>
            ) : null}
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                paddingHorizontal: 16,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                className="text-xl font-bold text-gray-900 dark:text-white"
                numberOfLines={1}
              >
                {title}
              </Text>
            </View>
          </>
        ) : (
          <>
            <Text
              className="ml-2 flex-1 text-xl font-bold text-gray-900 dark:text-white"
              numberOfLines={1}
            >
              {title}
            </Text>
            {step ? (
              <View className="rounded-full border border-gray-300 px-4 py-1.5 dark:border-white/80">
                <Text className="text-sm font-semibold text-gray-900 dark:text-white">
                  Step {step} of 8
                </Text>
              </View>
            ) : null}
            {right ? (
              <View className="ml-1 w-10 items-center justify-center">
                {right}
              </View>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}
