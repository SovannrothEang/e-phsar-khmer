import BrandGrid from "@/components/category/BrandGrid";
import CategorySearchHeader from "@/components/category/CategorySearchHeader";
import { FeedScrollView } from "@/components/category/FeedScrollView";
import FilterChips from "@/components/category/FilterChips";
import ListingFeed from "@/components/category/ListingFeed";
import PromoCard from "@/components/home/PromoCard";
import TypeSelector from "@/components/category/TypeSelector";
import Divider from "@/components/common/Divider";
import SafeAreaView from "@/components/common/SafeAreaView";
import SelectionSheet from "@/components/common/SelectionSheet";
import { Colors } from "@/constants/Colors";
import {
  fetchBrands,
  fetchLinkedAttributes,
  fetchSubcategory,
} from "@/lib/api/catalog";
import { resolveTypeTiles } from "@/lib/category-types";
import { openFiltersHref } from "@/lib/filter-route";
import { feedQueryFromParams, pickFilterParams } from "@/lib/feed-params";
import { TYPE_IN_FILTERS_ONLY_SUBCATEGORIES } from "@/lib/filter-options";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

type ViewMode = "list" | "grid";

export default function SubCategoryScreen() {
  const params = useLocalSearchParams();
  const categoryId = Array.isArray(params.categoryId)
    ? params.categoryId[0]
    : params.categoryId;
  const subCategoryId = Array.isArray(params.subCategoryId)
    ? params.subCategoryId[0]
    : params.subCategoryId;
  // View is URL-driven so the filter screen can apply it in place.
  const viewMode: ViewMode = params.view === "grid" ? "grid" : "list";
  const [brandSheetOpen, setBrandSheetOpen] = useState(false);

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

  const attributesQuery = useQuery({
    queryKey: ["linked-attributes", subcategory?.id],
    queryFn: () => fetchLinkedAttributes(subcategory!.id),
    enabled: !!subcategory?.id,
  });

  const fieldSchema = subcategory?.fieldSchema;
  const typeTiles = useMemo(
    () => resolveTypeTiles(attributesQuery.data ?? [], fieldSchema),
    [attributesQuery.data, fieldSchema],
  );

  const feedQuery = useMemo(
    () => ({
      subcategorySlug: subCategoryId,
      ...feedQueryFromParams(params),
    }),
    [subCategoryId, params],
  );

  const toggleViewMode = () => {
    router.setParams({ view: viewMode === "list" ? "grid" : "" });
  };

  const openFilters = () =>
    router.push(
      openFiltersHref(
        "subcategory",
        { categoryId, subCategoryId },
        pickFilterParams(params),
      ),
    );

  const openType = (typeId: string, name: string) => {
    if (!typeTiles) return;
    router.push({
      pathname:
        "/(categories)/[categoryId]/[subCategoryId]/type/[typeId]" as never,
      params: {
        categoryId,
        subCategoryId,
        typeId,
        attrKey: typeTiles.key,
        attrValue: name,
      },
    });
  };

  const openBrand = (brandSlug: string) => {
    setBrandSheetOpen(false);
    router.push(
      `/(categories)/${categoryId}/${subCategoryId}/${brandSlug}` as never,
    );
  };

  const subName = subcategory?.name || subCategoryId || "Category";

  if (subQuery.isLoading) {
    return (
      <SafeAreaView className="bg-neutral-surface">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={Colors.primary.DEFAULT} />
        </View>
      </SafeAreaView>
    );
  }

  if (!subcategory) {
    return (
      <SafeAreaView className="bg-neutral-surface">
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="alert-circle-outline" size={44} color="#9CA3AF" />
          <Text className="mt-3 text-neutral-text-sub">Category not found</Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className="mt-4 rounded-lg bg-primary px-6 py-2"
          >
            <Text className="font-bold text-white">Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView statusBarColor="#0EA5E9" statusBarStyle="light-content">
      <CategorySearchHeader
        placeholder={subName}
        onSearchPress={() =>
          router.push({
            pathname: "/search",
            params: {
              categorySlug: categoryId,
              subcategorySlug: subCategoryId,
              scopeName: subName,
            },
          } as never)
        }
        onFiltersPress={openFilters}
      />

      <View className="flex-1 bg-white">
        <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
          <Text className="text-xl font-bold capitalize text-gray-900">
            {subName}
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
                onBrandPress={openBrand}
                onShowMore={() => setBrandSheetOpen(true)}
              />
              <Divider />
            </View>
          )}

          {typeTiles &&
            typeTiles.rows.length > 0 &&
            // Furniture's Type has no tile artwork; it lives in the filters.
            !TYPE_IN_FILTERS_ONLY_SUBCATEGORIES.has(subCategoryId ?? "") && (
              <TypeSelector
                types={typeTiles.rows}
                onTypePress={(typeId) => {
                  const row = typeTiles.rows.find((tile) => tile.id === typeId);
                  if (row) openType(typeId, row.name);
                }}
              />
            )}

          <Divider variant="thick" />

          <View className="pt-2">
            <ListingFeed
              query={feedQuery}
              viewMode={viewMode}
              leading={<PromoCard viewMode={viewMode} />}
              emptyLabel="No ads in this category yet."
            />
          </View>
        </FeedScrollView>
      </View>

      <SelectionSheet
        visible={brandSheetOpen}
        title="Brand"
        options={brands.map((brand) => ({
          id: brand.slug,
          name: brand.name,
          image: brand.icon,
        }))}
        loading={brandsQuery.isLoading}
        emptyLabel="No brands"
        onSelect={(option) => openBrand(option.id)}
        onClose={() => setBrandSheetOpen(false)}
      />
    </SafeAreaView>
  );
}
