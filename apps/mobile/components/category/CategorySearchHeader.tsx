import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

interface CategorySearchHeaderProps {
  /** The screen's own name, shown inside the search field. */
  placeholder: string;
  /** Opens the search screen scoped to this screen; omitted = inert field. */
  onSearchPress?: () => void;
  onFiltersPress?: () => void;
}

const CategorySearchHeader = ({
  placeholder,
  onSearchPress,
  onFiltersPress,
}: CategorySearchHeaderProps) => {
  return (
    <View className="bg-[#0EA5E9] px-4 pb-3 pt-3">
      <View className="flex-row items-center gap-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={28} color="white" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onSearchPress}
          disabled={!onSearchPress}
          activeOpacity={0.8}
          className="flex-1 flex-row items-center rounded-sm bg-white/20 px-4 py-2.5"
          accessibilityRole="button"
          accessibilityLabel={`Search ${placeholder}`}
        >
          <Ionicons name="search" size={22} color="white" />
          <Text className="ml-2.5 flex-1 text-lg text-white" numberOfLines={1}>
            {placeholder}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onFiltersPress}
          className="h-10 w-10 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Filters"
        >
          <Ionicons name="options-outline" size={28} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default CategorySearchHeader;
