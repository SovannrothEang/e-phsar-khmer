import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { countActiveFilters, firstParam } from "@/lib/feed-params";
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
  const params = useLocalSearchParams();
  // A brand reached from a tile (brandId) or the brand -> type flow is scope,
  // but still counts as a chosen filter, exactly like the chip row's badge.
  const brandIsScope =
    !!firstParam(params.brandId) || firstParam(params.brandScope) === "1";
  const activeFilterCount = countActiveFilters(params, { brandIsScope });

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
          className="flex-1 flex-row items-center rounded-[4px] bg-white/20 px-4 py-2.5"
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
          <View>
            <Ionicons name="options-outline" size={28} color="white" />
            {activeFilterCount > 0 ? (
              <View className="absolute -right-2.5 -top-2 h-5 min-w-5 items-center justify-center rounded-full bg-secondary-orange px-1">
                <Text className="text-[11px] font-bold text-white">
                  {activeFilterCount}
                </Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default CategorySearchHeader;
