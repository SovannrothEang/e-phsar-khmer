import FloatingInput from "@/components/common/FloatingInput";
import React from "react";
import { Text, View } from "react-native";

interface TextStepProps {
  label: string;
  helper: string;
  value: string;
  onChangeText: (value: string) => void;
  maxLength: number;
  height?: number;
}

/** Shared Summary / Hobbies free-text step. */
export default function TextStep({
  label,
  helper,
  value,
  onChangeText,
  maxLength,
  height = 300,
}: TextStepProps) {
  return (
    <View className="gap-4">
      <Text className="text-base leading-6 text-gray-500 dark:text-gray-400">
        {helper}
      </Text>
      <FloatingInput
        label={label}
        value={value}
        onChangeText={onChangeText}
        multiline
        multilineHeight={height}
        maxLength={maxLength}
        variant="filled"
      />
    </View>
  );
}
