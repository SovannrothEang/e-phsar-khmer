import BottomSheet from "@/components/common/BottomSheet";
import { Colors } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface YearFilterSheetProps {
  visible: boolean;
  initialMin: string;
  initialMax: string;
  onApply: (min: string, max: string) => void;
  onClose: () => void;
}

type Picking = "min" | "max" | null;

/**
 * The Year chip's sheet: a min/max range like Price, but each field opens an
 * in-sheet searchable year list instead of a keyboard (captain, 2026-11-07).
 */
export default function YearFilterSheet({
  visible,
  initialMin,
  initialMax,
  onApply,
  onClose,
}: YearFilterSheetProps) {
  const insets = useSafeAreaInsets();
  const [min, setMin] = useState(initialMin);
  const [max, setMax] = useState(initialMax);
  const [picking, setPicking] = useState<Picking>(null);
  const [search, setSearch] = useState("");
  const [prevInit, setPrevInit] = useState({
    visible,
    min: initialMin,
    max: initialMax,
  });

  // Re-seed whenever the sheet opens or the committed range changes, so it
  // never shows a stale range. Adjusting state during render is the supported
  // pattern; an effect caused cascading renders.
  if (
    prevInit.visible !== visible ||
    prevInit.min !== initialMin ||
    prevInit.max !== initialMax
  ) {
    setPrevInit({ visible, min: initialMin, max: initialMax });
    if (visible) {
      setMin(initialMin);
      setMax(initialMax);
      setPicking(null);
      setSearch("");
    }
  }

  const years = useMemo(() => {
    const newest = new Date().getFullYear();
    return Array.from({ length: newest - 1990 + 1 }, (_, index) =>
      String(newest - index),
    );
  }, []);

  const filteredYears = useMemo(() => {
    const needle = search.trim();
    return needle ? years.filter((year) => year.includes(needle)) : years;
  }, [years, search]);

  const pick = (year: string) => {
    if (picking === "min") setMin(year);
    if (picking === "max") setMax(year);
    setPicking(null);
    setSearch("");
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <KeyboardAvoidingView behavior="padding">
        <View className="bg-white">
          <View className="flex-row items-center px-4 pb-2 pt-3">
            {picking ? (
              <TouchableOpacity
                onPress={() => setPicking(null)}
                className="h-10 w-10 items-center justify-center rounded-full bg-gray-100"
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <Ionicons name="chevron-back" size={20} color="#6B7280" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={onClose}
                className="h-10 w-10 items-center justify-center rounded-full bg-gray-100"
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            )}
            <Text className="flex-1 text-center text-xl font-bold text-gray-900">
              {picking === "min"
                ? "Min year"
                : picking === "max"
                  ? "Max year"
                  : "Year"}
            </Text>
            {/* Clear only once there is something to clear. */}
            {picking || (!min && !max) ? (
              <View className="h-10 w-10" />
            ) : (
              <TouchableOpacity
                onPress={() => {
                  setMin("");
                  setMax("");
                }}
                className="h-10 w-10 items-center justify-center"
                accessibilityRole="button"
                accessibilityLabel="Clear years"
              >
                <Text className="text-base font-medium text-primary">
                  Clear
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {picking ? (
            <View style={{ paddingBottom: insets.bottom + 8 }}>
              <View className="mx-4 mb-2 flex-row items-center rounded-lg bg-[#F2F2F7] px-3">
                <Ionicons name="search" size={18} color="#9CA3AF" />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  className="ml-2 flex-1 py-3 text-base text-gray-900"
                />
              </View>
              <ScrollView
                className="max-h-[360px]"
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {filteredYears.map((year) => {
                  const selected = year === (picking === "min" ? min : max);
                  return (
                    <TouchableOpacity
                      key={year}
                      onPress={() => pick(year)}
                      activeOpacity={0.7}
                      className="flex-row items-center justify-between border-b border-gray-100 px-4 py-4"
                    >
                      <Text
                        className={`text-base ${
                          selected
                            ? "font-semibold text-primary"
                            : "text-gray-900"
                        }`}
                      >
                        {year}
                      </Text>
                      {selected ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={22}
                          color={Colors.primary.DEFAULT}
                        />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
                {filteredYears.length === 0 ? (
                  <Text className="px-4 py-12 text-center text-sm text-gray-400">
                    No years
                  </Text>
                ) : null}
              </ScrollView>
            </View>
          ) : (
            <View
              className="bg-[#F2F2F7] px-4 pt-4"
              style={{ paddingBottom: insets.bottom + 16 }}
            >
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => {
                    setSearch("");
                    setPicking("min");
                  }}
                  activeOpacity={0.7}
                  className="h-14 flex-1 flex-row items-center justify-between rounded-lg border border-gray-200 bg-white px-4"
                  accessibilityRole="button"
                  accessibilityLabel="Minimum year"
                >
                  <View className="flex-1">
                    {min ? (
                      <>
                        <Text className="text-[11px] text-gray-500">Min</Text>
                        <Text className="text-base text-gray-900">{min}</Text>
                      </>
                    ) : (
                      <Text className="text-base text-gray-500">Min</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-down" size={18} color="#6B7280" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setSearch("");
                    setPicking("max");
                  }}
                  activeOpacity={0.7}
                  className="h-14 flex-1 flex-row items-center justify-between rounded-lg border border-gray-200 bg-white px-4"
                  accessibilityRole="button"
                  accessibilityLabel="Maximum year"
                >
                  <View className="flex-1">
                    {max ? (
                      <>
                        <Text className="text-[11px] text-gray-500">Max</Text>
                        <Text className="text-base text-gray-900">{max}</Text>
                      </>
                    ) : (
                      <Text className="text-base text-gray-500">Max</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-down" size={18} color="#6B7280" />
                </TouchableOpacity>
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
          )}
        </View>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}
