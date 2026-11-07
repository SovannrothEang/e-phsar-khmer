import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

interface ChoiceProps {
  label: string;
  options: readonly string[];
  value: string | null;
  onChange: (value: string) => void;
}

/** The reference's wide segmented choice buttons (Gender / Marital Status). */
export default function Choice({
  label,
  options,
  value,
  onChange,
}: ChoiceProps) {
  return (
    <View>
      <Text className="mb-2 text-base font-bold text-gray-900 dark:text-white">
        {label}
      </Text>
      <View className="flex-row gap-3">
        {options.map((option) => {
          const selected = value === option;
          return (
            <TouchableOpacity
              key={option}
              onPress={() => onChange(option)}
              activeOpacity={0.8}
              className={`h-12 flex-1 items-center justify-center rounded-lg border ${
                selected
                  ? "border-primary bg-sky-50 dark:bg-[#00131C]"
                  : "border-transparent bg-[#F2F2F7] dark:bg-[#3A3A3C]"
              }`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text
                className={`text-base ${
                  selected
                    ? "font-semibold text-primary dark:text-white"
                    : "text-gray-900 dark:text-white"
                }`}
              >
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
