import ListingFeed from "@/components/category/ListingFeed";
import { useLanguage } from "@/contexts/LanguageContext";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import PromoCard from "./PromoCard";

type ViewMode = "list" | "grid";

const LatestAds = () => {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const { t } = useLanguage();
  const feedQuery = useMemo(() => ({ limit: 8 }), []);

  return (
    <View className="pb-4 pt-5">
      {/* Section Header */}
      <View className="mb-4 flex-row items-center justify-between px-4">
        <View className="flex-row items-center gap-2">
          <View className="h-6 w-2.5 rounded-full bg-sky-500" />
          <Text className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            {t("latestAds")}
          </Text>
        </View>

        {/* Layout Toggle Segmented Control */}
        <View className="flex-row items-center rounded-full border border-gray-200/80 bg-gray-100 p-1 dark:border-gray-700 dark:bg-gray-800">
          <TouchableOpacity
            className={`flex-row items-center gap-1 rounded-full p-1.5 px-3 ${
              viewMode === "grid"
                ? "border border-gray-200/60 bg-white shadow-2xs dark:border-gray-700 dark:bg-gray-900"
                : "bg-transparent"
            }`}
            onPress={() => setViewMode("grid")}
            activeOpacity={0.7}
          >
            <Ionicons
              name="grid-sharp"
              size={16}
              color={viewMode === "grid" ? "#0EA5E9" : "#9CA3AF"}
            />
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-row items-center gap-1 rounded-full p-1.5 px-3 ${
              viewMode === "list"
                ? "border border-gray-200/60 bg-white shadow-2xs dark:border-gray-700 dark:bg-gray-900"
                : "bg-transparent"
            }`}
            onPress={() => setViewMode("list")}
            activeOpacity={0.7}
          >
            <Ionicons
              name="list-sharp"
              size={16}
              color={viewMode === "list" ? "#0EA5E9" : "#9CA3AF"}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ListingFeed
        query={feedQuery}
        viewMode={viewMode}
        leading={<PromoCard viewMode={viewMode} />}
        emptyLabel="No ads yet."
      />
    </View>
  );
};

export default LatestAds;
