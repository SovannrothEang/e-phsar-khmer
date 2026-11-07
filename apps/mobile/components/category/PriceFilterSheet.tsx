import BottomSheet from "@/components/common/BottomSheet";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface PriceFilterSheetProps {
  visible: boolean;
  title: string;
  label: string;
  initialMin: string;
  initialMax: string;
  onApply: (min: string, max: string) => void;
  onClose: () => void;
}

/**
 * The quick price range sheet opened by the feed's Price chip: Min/Max inputs
 * and one orange Apply Filter. The typed values stay local until Apply, so the
 * feed never refetches mid-keystroke.
 */
export default function PriceFilterSheet({
  visible,
  title,
  label,
  initialMin,
  initialMax,
  onApply,
  onClose,
}: PriceFilterSheetProps) {
  const insets = useSafeAreaInsets();
  const [min, setMin] = useState(initialMin);
  const [max, setMax] = useState(initialMax);
  const [prevInit, setPrevInit] = useState({
    visible,
    min: initialMin,
    max: initialMax,
  });

  // Re-seed the inputs whenever the sheet opens or the committed range
  // changes, so it never shows a stale range. Adjusting state during render is
  // the supported pattern; an effect caused cascading renders.
  if (
    prevInit.visible !== visible ||
    prevInit.min !== initialMin ||
    prevInit.max !== initialMax
  ) {
    setPrevInit({ visible, min: initialMin, max: initialMax });
    if (visible) {
      setMin(initialMin);
      setMax(initialMax);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
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
              {title}
            </Text>
            <View className="h-10 w-10" />
          </View>

          <View
            className="bg-[#F2F2F7] px-4 pt-4"
            style={{ paddingBottom: insets.bottom + 16 }}
          >
            {/* The header already names the filter when they match. */}
            {label === title ? null : (
              <Text className="text-base text-gray-900">{label}</Text>
            )}
            <View className="mt-2 flex-row gap-3">
              <TextInput
                value={min}
                onChangeText={setMin}
                placeholder="Min"
                placeholderTextColor="#6B7280"
                keyboardType="numeric"
                maxLength={12}
                className="h-14 flex-1 rounded-lg border border-gray-200 bg-white px-4 text-base text-gray-900"
                accessibilityLabel={`${label} minimum`}
              />
              <TextInput
                value={max}
                onChangeText={setMax}
                placeholder="Max"
                placeholderTextColor="#6B7280"
                keyboardType="numeric"
                maxLength={12}
                className="h-14 flex-1 rounded-lg border border-gray-200 bg-white px-4 text-base text-gray-900"
                accessibilityLabel={`${label} maximum`}
              />
            </View>

            <TouchableOpacity
              onPress={() => onApply(min, max)}
              activeOpacity={0.85}
              className="mt-4 h-12 items-center justify-center rounded-lg bg-secondary"
              accessibilityRole="button"
              accessibilityLabel="Apply Filter"
            >
              <Text className="text-lg font-semibold text-white">
                Apply Filter
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}
