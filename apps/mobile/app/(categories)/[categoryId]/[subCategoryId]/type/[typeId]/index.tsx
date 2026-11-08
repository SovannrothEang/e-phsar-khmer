import BrandGrid from "@/components/category/BrandGrid";
import CategorySearchHeader from "@/components/category/CategorySearchHeader";
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
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

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

  const screenTitle = `${subcategory?.name || subCategoryId} • ${typeName}`;

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
