import { Colors } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ResumeHeader from "./ResumeHeader";
import { RESUME_STEPS } from "./options";

interface ResumeStartProps {
  onStart: () => void;
  onBack: () => void;
}

/** Entry screen: only the Create card (the upload card is deliberately gone). */
export default function ResumeStart({ onStart, onBack }: ResumeStartProps) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-white dark:bg-black">
      <ResumeHeader title="Resume (CV)" onBack={onBack} align="center" />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <View className="px-5 pt-6">
          <Text className="text-3xl font-bold text-gray-900 dark:text-white">
            How do you want to start?
          </Text>
          <Text className="mt-2 text-base leading-6 text-gray-500 dark:text-gray-400">
            Build a professional CV step by step.
          </Text>

          <View className="mt-6 rounded-2xl border border-gray-100 bg-white p-5 dark:border-transparent dark:bg-[#262628]">
            <View className="flex-row items-start gap-4">
              <View className="h-12 w-12 items-center justify-center rounded-xl bg-sky-50 dark:bg-[#0B2A3A]">
                <Ionicons
                  name="pencil"
                  size={24}
                  color={Colors.primary.DEFAULT}
                />
              </View>
              <View className="flex-1">
                <Text className="text-xl font-bold text-gray-900 dark:text-white">
                  Create a New Resume
                </Text>
                <Text className="mt-1 text-sm leading-5 text-gray-500 dark:text-gray-400">
                  Fill in your details across 8 quick steps.
                </Text>
              </View>
            </View>

            <View className="mt-5 flex-row flex-wrap gap-2">
              {RESUME_STEPS.map((label, index) => (
                <View
                  key={label}
                  className="flex-row items-center gap-2 rounded-full bg-[#F2F2F7] px-3 py-2 dark:bg-[#3A3A3C]"
                >
                  <View className="h-6 w-6 items-center justify-center rounded-full bg-sky-50 dark:bg-[#0B2A3A]">
                    <Text className="text-xs font-bold text-primary">
                      {index + 1}
                    </Text>
                  </View>
                  <Text className="text-sm text-gray-900 dark:text-white">
                    {label}
                  </Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              onPress={onStart}
              activeOpacity={0.85}
              className="mt-6 h-12 flex-row items-center justify-center gap-2 rounded-xl"
              style={{ backgroundColor: Colors.primary.DEFAULT }}
              accessibilityRole="button"
              accessibilityLabel="Start building"
            >
              <Text className="text-base font-bold text-white">
                Start building
              </Text>
              <Ionicons name="arrow-forward" size={18} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
