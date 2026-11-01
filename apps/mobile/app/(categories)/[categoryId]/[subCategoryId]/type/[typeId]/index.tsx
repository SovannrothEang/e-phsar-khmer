import BrandGrid from "@/components/category/BrandGrid";
import { FeedScrollView } from "@/components/category/FeedScrollView";
import FilterChips from "@/components/category/FilterChips";
import ListingFeed from "@/components/category/ListingFeed";
import Divider from "@/components/common/Divider";
import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { fetchBrands, fetchSubcategory } from "@/lib/api/catalog";
import { feedQueryFromParams, pickFilterParams } from "@/lib/feed-params";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type ViewMode = "list" | "grid";

export default function TypeScreen() {
  const params = useLocalSearchParams();
  const categoryId = Array.isArray(params.categoryId)
    ? params.categoryId[0]
    : params.categoryId;
  const subCategoryId = Array.isArray(params.subCategoryId)
    ? params.subCategoryId[0]
    : params.subCategoryId;
  const typeId = Array.isArray(params.typeId)
    ? params.typeId[0]
    : params.typeId;
  const attrKey = Array.isArray(params.attrKey)
    ? params.attrKey[0]
    : params.attrKey;
  const attrValue = Array.isArray(params.attrValue)
    ? params.attrValue[0]
    : params.attrValue;
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const subQuery = useQuery({
    queryKey: ["subcategory", categoryId, subCategoryId],
    queryFn: () =>
      fetchSubcategory(categoryId as string, subCategoryId as string),
    enabled: !!categoryId && !!subCategoryId,
  });
  const subcategory = subQuery.data;

  const brandsQuery = useQuery({
    queryKey: ["brands", subCategoryId],
    queryFn: () => fetchBrands(subCategoryId as string),
    enabled: !!subCategoryId,
  });
  const brands = brandsQuery.data ?? [];

  const typeName =
    attrValue ||
    (typeId
      ? typeId
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ")
      : "");

  const feedQuery = useMemo(
    () => ({
      subcategorySlug: subCategoryId,
      ...(attrKey && attrValue ? { attrs: { [attrKey]: attrValue } } : {}),
      ...feedQueryFromParams(params),
    }),
    [subCategoryId, attrKey, attrValue, params],
  );

  const toggleViewMode = () => {
    setViewMode(viewMode === "list" ? "grid" : "list");
  };

  const openFilters = () =>
    router.push({
      pathname: "/filters",
      params: {
        categoryId,
        subCategoryId,
        ...pickFilterParams(params),
      },
    });

  if (subQuery.isLoading) {
    return (
      <SafeAreaView className="bg-neutral-surface">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={Colors.primary.DEFAULT} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView statusBarColor="#0EA5E9" statusBarStyle="light-content">
      <View className="bg-[#0EA5E9] px-4 pb-3 pt-3">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={28} color="white" />
          </TouchableOpacity>
          <View className="flex-1 flex-row items-center rounded bg-white/20 px-3 py-2">
            <Ionicons name="search" size={20} color="white" />
            <TextInput
              placeholder="Search..."
              placeholderTextColor="white"
              className="ml-2 flex-1 text-base text-white"
              editable={false}
            />
          </View>
          <TouchableOpacity onPress={openFilters}>
            <Ionicons name="options-outline" size={28} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <View className="flex-1 bg-white">
        <View className="flex-row items-center justify-between px-4 py-4">
          <Text className="text-xl font-bold text-gray-900">
            {subcategory?.name || subCategoryId} • {typeName}
          </Text>

          <View className="flex-row gap-4">
            <TouchableOpacity onPress={toggleViewMode}>
              <Ionicons
                name={viewMode === "list" ? "grid-outline" : "list-outline"}
                size={24}
                color="black"
              />
            </TouchableOpacity>
          </View>
        </View>

        <FilterChips
          categoryId={categoryId as string}
          onLocationPress={openFilters}
          onFiltersPress={openFilters}
        />

        <FeedScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {brands.length > 0 && (
            <View>
              <BrandGrid
                brands={brands.map((brand) => ({
                  id: brand.slug,
                  name: brand.name,
                  image: brand.icon,
                }))}
                onBrandPress={(brandSlug) =>
                  router.push({
                    pathname:
                      "/(categories)/[categoryId]/[subCategoryId]/type/[typeId]/[brandId]" as never,
                    params: {
                      categoryId,
                      subCategoryId,
                      typeId,
                      brandId: brandSlug,
                      attrKey,
                      attrValue,
                    },
                  })
                }
              />
              <Divider />
            </View>
          )}

          <Divider variant="thick" />

          <View className="mt-2">
            <ListingFeed
              query={feedQuery}
              viewMode={viewMode}
              emptyLabel="No ads match this type yet."
            />
          </View>
        </FeedScrollView>
      </View>
    </SafeAreaView>
  );
}
