import CategorySearchHeader from "@/components/category/CategorySearchHeader";
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
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

type ViewMode = "list" | "grid";

function prettySlug(slug?: string): string {
  if (!slug) return "";
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function BrandTypeScreen() {
  const params = useLocalSearchParams();
  const pick = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const categoryId = pick("categoryId");
  const subCategoryId = pick("subCategoryId");
  const brandId = pick("brandId");
  const typeId = pick("typeId");
  const attrKey = pick("attrKey");
  const attrValue = pick("attrValue");
  const [viewMode, setViewMode] = useState<ViewMode>(
    params.view === "grid" ? "grid" : "list",
  );

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

  const brandName = brand?.name || prettySlug(brandId);
  const typeName = attrValue || prettySlug(typeId);

  const feedBrand = brand?.name;
  const feedQuery = useMemo(
    () => ({
      subcategorySlug: subCategoryId,
      ...(feedBrand ? { brand: feedBrand } : {}),
      ...(attrKey && attrValue ? { attrs: { [attrKey]: attrValue } } : {}),
      ...feedQueryFromParams(params),
    }),
    [subCategoryId, feedBrand, attrKey, attrValue, params],
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

  const screenTitle = `${subcategory?.name || subCategoryId} • ${brandName} • ${typeName}`;

  return (
    <SafeAreaView statusBarColor="#0EA5E9" statusBarStyle="light-content">
      <CategorySearchHeader
        placeholder={screenTitle}
        onSearchPress={() =>
          router.push({
            pathname: "/search",
            params: {
              categorySlug: categoryId,
              subcategorySlug: subCategoryId,
              ...(brand?.name ? { brand: brand.name } : {}),
              ...(attrKey && attrValue ? { attrKey, attrValue } : {}),
              scopeName: screenTitle,
            },
          } as never)
        }
        onFiltersPress={openFilters}
      />

      <View className="flex-1 bg-white">
        <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
          <Text className="text-xl font-bold text-gray-900">{screenTitle}</Text>

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
          subCategoryId={subCategoryId as string}
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
            />
          )}

          <Divider variant="thick" />

          <View className="mt-2">
            <ListingFeed
              query={feedQuery}
              viewMode={viewMode}
              emptyLabel="No ads match this selection yet."
            />
          </View>
        </FeedScrollView>
      </View>
    </SafeAreaView>
  );
}
