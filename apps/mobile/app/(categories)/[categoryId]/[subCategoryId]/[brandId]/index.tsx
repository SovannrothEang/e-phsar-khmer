import { FeedScrollView } from "@/components/category/FeedScrollView";
import FilterChips from "@/components/category/FilterChips";
import ListingFeed from "@/components/category/ListingFeed";
import ModelGrid from "@/components/category/ModelGrid";
import Divider from "@/components/common/Divider";
import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { fetchBrands, fetchModels, fetchSubcategory } from "@/lib/api/catalog";
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

export default function BrandScreen() {
  const params = useLocalSearchParams();
  const categoryId = Array.isArray(params.categoryId)
    ? params.categoryId[0]
    : params.categoryId;
  const subCategoryId = Array.isArray(params.subCategoryId)
    ? params.subCategoryId[0]
    : params.subCategoryId;
  const brandId = Array.isArray(params.brandId)
    ? params.brandId[0]
    : params.brandId;
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
  const brand = brandsQuery.data?.find((entry) => entry.slug === brandId);

  const modelsQuery = useQuery({
    queryKey: ["models", brand?.id, subCategoryId],
    queryFn: () => fetchModels(brand!.id, subCategoryId as string),
    enabled: !!brand?.id && !!subCategoryId,
  });
  const models = modelsQuery.data ?? [];

  const brandName =
    brand?.name ||
    (brandId
      ? brandId
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ")
      : "");

  const feedQuery = useMemo(
    () => ({
      subcategorySlug: subCategoryId,
      ...(brand?.name ? { brand: brand.name } : {}),
      ...feedQueryFromParams(params),
    }),
    [subCategoryId, brand?.name, params],
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

  const openModel = (modelName: string, modelSlug: string) =>
    router.push({
      pathname:
        "/(categories)/[categoryId]/[subCategoryId]/type/[typeId]" as never,
      params: {
        categoryId,
        subCategoryId,
        typeId: modelSlug,
        attrKey: "model",
        attrValue: modelName,
      },
    });

  if (subQuery.isLoading || brandsQuery.isLoading) {
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
            {subcategory?.name || subCategoryId} • {brandName}
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
          {models.length > 0 && (
            <ModelGrid
              models={models.map((model) => ({
                id: model.slug,
                name: model.name,
              }))}
              onModelPress={(model) => openModel(model.name, model.id)}
            />
          )}

          <Divider variant="thick" />

          <View className="mt-2">
            <ListingFeed
              query={feedQuery}
              viewMode={viewMode}
              emptyLabel="No ads in this brand yet."
            />
          </View>
        </FeedScrollView>
      </View>
    </SafeAreaView>
  );
}
