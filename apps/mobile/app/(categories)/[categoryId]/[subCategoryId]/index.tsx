import BrandGrid from "@/components/category/BrandGrid";
import { FeedScrollView } from "@/components/category/FeedScrollView";
import FilterChips from "@/components/category/FilterChips";
import ListingFeed from "@/components/category/ListingFeed";
import TypeSelector from "@/components/category/TypeSelector";
import Divider from "@/components/common/Divider";
import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import {
  fetchBrands,
  fetchLinkedAttributes,
  fetchSubcategory,
} from "@/lib/api/catalog";
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

/** The admin-managed attribute sets that act as a "type" tile list. */
const TYPE_SETS: { set: string; key: string }[] = [
  { set: "types", key: "type" },
  { set: "bodytypes", key: "bodyType" },
  { set: "vehicletypes", key: "vehicleType" },
  { set: "jobtypes", key: "jobType" },
  { set: "accessories", key: "accessory" },
  { set: "networks", key: "network" },
];

export default function SubCategoryScreen() {
  const params = useLocalSearchParams();
  const categoryId = Array.isArray(params.categoryId)
    ? params.categoryId[0]
    : params.categoryId;
  const subCategoryId = Array.isArray(params.subCategoryId)
    ? params.subCategoryId[0]
    : params.subCategoryId;
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

  const attributesQuery = useQuery({
    queryKey: ["linked-attributes", subcategory?.id],
    queryFn: () => fetchLinkedAttributes(subcategory!.id),
    enabled: !!subcategory?.id,
  });

  const typeTiles = useMemo(() => {
    const rows = attributesQuery.data ?? [];
    const schemaKeys = new Set(
      (subcategory?.fieldSchema ?? []).map((field) => field.key),
    );
    for (const candidate of TYPE_SETS) {
      if (!schemaKeys.has(candidate.key)) continue;
      const group = rows.filter((row) => row.type === candidate.set);
      if (group.length === 0) continue;
      return {
        key: candidate.key,
        rows: group.map((row) => ({
          id: row.slug,
          name: row.name,
          image: row.image,
        })),
      };
    }
    return null;
  }, [attributesQuery.data, subcategory?.fieldSchema]);

  const feedQuery = useMemo(
    () => ({
      subcategorySlug: subCategoryId,
      ...feedQueryFromParams(params),
    }),
    [subCategoryId, params],
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
                  router.push(
                    `/(categories)/${categoryId}/${subCategoryId}/${brandSlug}` as never,
                  )
                }
              />
              <Divider />
            </View>
          )}

          {typeTiles && typeTiles.rows.length > 0 && (
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
              emptyLabel="No ads in this category yet."
            />
          </View>
        </FeedScrollView>
      </View>
    </SafeAreaView>
  );
}
