import FloatingInput from "@/components/common/FloatingInput";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "nativewind";
import React from "react";
import { Switch, Text, View } from "react-native";
import { MonthYearField } from "./DateSheet";
import type { ExperienceDraft } from "./draft";
import LocationField from "./LocationPicker";

export interface ExperienceErrors {
  company?: string;
  position?: string;
  start?: string;
  end?: string;
}

interface ExperienceStepProps {
  draft: ExperienceDraft;
  onChange: (patch: Partial<ExperienceDraft>) => void;
  errors: ExperienceErrors;
}

/** Step 3 — the single experience form. */
export default function ExperienceStep({
  draft,
  onChange,
  errors,
}: ExperienceStepProps) {
  const { colorScheme } = useColorScheme();
  const trackOff = colorScheme === "dark" ? "#3A3A3C" : "#E5E7EB";

  return (
    <View className="gap-5">
      <FloatingInput
        label="Company"
        value={draft.company}
        onChangeText={(company) => onChange({ company })}
        maxLength={100}
        required
        variant="filled"
        error={errors.company}
      />

      <FloatingInput
        label="Position"
        value={draft.position}
        onChangeText={(position) => onChange({ position })}
        maxLength={100}
        required
        variant="filled"
        error={errors.position}
      />

      <LocationField
        value={draft.place}
        onChange={(place) => onChange({ place })}
      />

      <View>
        <Text className="mb-2 text-base font-bold text-gray-900 dark:text-white">
          Year-Month
        </Text>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <MonthYearField
              label="Start"
              value={draft.start}
              onChange={(start) => onChange({ start })}
              required
              error={errors.start}
            />
          </View>
          <View className="flex-1">
            <MonthYearField
              label="End"
              value={draft.end}
              onChange={(end) => onChange({ end })}
              disabled={draft.current}
              disabledText="Present"
              error={errors.end}
            />
          </View>
        </View>
      </View>

      <View className="flex-row items-center justify-between">
        <Text className="text-base font-bold text-gray-900 dark:text-white">
          I currently work here
        </Text>
        <Switch
          value={draft.current}
          onValueChange={(current) =>
            onChange({ current, ...(current ? { end: null } : {}) })
          }
          trackColor={{ false: trackOff, true: Colors.primary.DEFAULT }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={trackOff}
        />
      </View>

      <FloatingInput
        label="Description"
        value={draft.description}
        onChangeText={(description) => onChange({ description })}
        multiline
        multilineHeight={220}
        maxLength={2000}
        variant="filled"
      />
    </View>
  );
}
