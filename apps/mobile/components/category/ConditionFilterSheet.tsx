import BottomSheet from "@/components/common/BottomSheet";
import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

interface ConditionFilterSheetProps {
  visible: boolean;
  /** "" (any), "new" or "used". */
  initial: string;
  onApply: (condition: string) => void;
  onClose: () => void;
}

const OPTIONS: { id: string; label: string }[] = [
  { id: "", label: "Any" },
  { id: "used", label: "Used" },
  { id: "new", label: "New" },
];

/**
 * The Condition chip's sheet: an Any / Used / New segmented pick plus Apply,
 * matching the reference (captain, 2026-11-07).
 */
export default function ConditionFilterSheet({
  visible,
  initial,
  onApply,
  onClose,
}: ConditionFilterSheetProps) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState(initial);
  const [prev, setPrev] = useState({ visible, initial });

  // Re-seed whenever the sheet opens or the committed value changes.
  if (prev.visible !== visible || prev.initial !== initial) {
    setPrev({ visible, initial });
    if (visible) setSelected(initial);
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View className="bg-white">
        <View className="flex-row items-center px-4 pb-2 pt-3">
          <TouchableOpacity
            onPress={onClose}
            className="h-10 w-10 items-center justify-center rounded-full bg-gray-100"
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={20} color="#6B7280" />
          </TouchableOpacity>
          <Text className="flex-1 text-center text-xl font-bold text-gray-900">
            Condition
          </Text>
          <View className="h-10 w-10" />
        </View>

        <View
          className="bg-[#F2F2F7] px-4 pt-4"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <Text className="mb-2 text-base font-semibold text-gray-900">
            Condition
          </Text>
          <View className="flex-row gap-3">
            {OPTIONS.map((option) => {
              const isSelected = selected === option.id;
              return (
                <TouchableOpacity
                  key={option.id || "any"}
                  onPress={() => setSelected(option.id)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  className={`h-[44px] flex-1 items-center justify-center rounded-[4px] border ${
                    isSelected
                      ? "border-primary bg-[#DCEEF8]"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <Text className="text-base text-gray-900">
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            onPress={() => onApply(selected)}
            activeOpacity={0.85}
            className="mt-4 h-[44px] items-center justify-center rounded-[4px] bg-secondary"
            accessibilityRole="button"
            accessibilityLabel="Apply Filter"
          >
            <Text className="text-lg font-semibold text-white">
              Apply Filter
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheet>
  );
}
