import CategorySearchHeader from "@/components/category/CategorySearchHeader";
import { FeedScrollView } from "@/components/category/FeedScrollView";
import FilterChips from "@/components/category/FilterChips";
import ListingFeed from "@/components/category/ListingFeed";
import PromoCard from "@/components/home/PromoCard";
import ModelGrid from "@/components/category/ModelGrid";
import TypeSelector from "@/components/category/TypeSelector";
import Divider from "@/components/common/Divider";
import SafeAreaView from "@/components/common/SafeAreaView";
import SelectionSheet from "@/components/common/SelectionSheet";
import { Colors } from "@/constants/Colors";
import {
  fetchBrands,
  fetchLinkedAttributes,
  fetchModels,
  fetchSubcategory,
} from "@/lib/api/catalog";
import { resolveTypeTiles } from "@/lib/category-types";
import { openFiltersHref } from "@/lib/filter-route";
import {
  feedQueryFromParams,
  firstParam,
  pickFilterParams,
} from "@/lib/feed-params";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

type ViewMode = "list" | "grid";

/** `attrs` holds the attribute filters as JSON; the model chip lives there. */
function parseAttrs(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).map(
          ([key, value]) => [key, String(value)],
        ),
      );
    }
  } catch {
    /* a bad param simply filters nothing */
  }
  return {};
}

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
  // View is URL-driven so the filter screen can apply it in place.
  const viewMode: ViewMode = params.view === "grid" ? "grid" : "list";
  const [modelSheetOpen, setModelSheetOpen] = useState(false);

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

  const attributesQuery = useQuery({
    queryKey: ["linked-attributes", subcategory?.id],
    queryFn: () => fetchLinkedAttributes(subcategory!.id),
    enabled: !!subcategory?.id,
  });
  const typeTiles = useMemo(
    () =>
      resolveTypeTiles(attributesQuery.data ?? [], subcategory?.fieldSchema),
    [attributesQuery.data, subcategory?.fieldSchema],
  );

  const brandName =
    brand?.name ||
    (brandId
      ? brandId
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ")
      : "");

  const feedBrand = brand?.name;

  const attrsRaw = firstParam(params.attrs);
  const selectedModel = parseAttrs(attrsRaw).model ?? "";
  const selectedModelId =
    models.find((model) => model.name === selectedModel)?.slug ?? "";

  const feedQuery = useMemo(() => {
    const fromParams = feedQueryFromParams(params);
    return {
      subcategorySlug: subCategoryId,
      ...fromParams,
      // fromParams carries `brand: undefined` when the URL has no brand
      // filter; spreading it after the route brand would erase the scope.
      brand: feedBrand ?? fromParams.brand,
    };
  }, [subCategoryId, feedBrand, params]);

  const toggleViewMode = () => {
    router.setParams({ view: viewMode === "list" ? "grid" : "" });
  };

  const openFilters = () =>
    router.push(
      openFiltersHref(
        "brand",
        { categoryId, subCategoryId, brandId, brand: brand?.name },
        pickFilterParams(params),
      ),
    );

  /** Model taps filter the feed in place: same model clears, a new one wins. */
  const toggleModel = (name: string) => {
    const next = { ...parseAttrs(attrsRaw) };
    if (next.model === name) {
      delete next.model;
    } else {
      next.model = name;
    }
    router.setParams({
      attrs: Object.keys(next).length > 0 ? JSON.stringify(next) : "",
    });
  };

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
        // Keeps the brand the user already chose (brand -> bodytype flow).
        ...(feedBrand ? { brand: feedBrand, brandScope: "1" } : {}),
      },
    });
  };

  if (subQuery.isLoading || brandsQuery.isLoading) {
    return (
      <SafeAreaView className="bg-neutral-surface">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={Colors.primary.DEFAULT} />
        </View>
      </SafeAreaView>
    );
  }

  const screenTitle = `${subcategory?.name || subCategoryId} • ${brandName}`;

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
          brandIsScope
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
              selectedName={selectedModel}
              onModelPress={(model) => toggleModel(model.name)}
              onShowMore={() => setModelSheetOpen(true)}
            />
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

          <View className="mt-2">
            <ListingFeed
              query={feedQuery}
              viewMode={viewMode}
              leading={<PromoCard viewMode={viewMode} />}
              emptyLabel="No ads in this brand yet."
            />
          </View>
        </FeedScrollView>
      </View>

      <SelectionSheet
        visible={modelSheetOpen}
        title="Model"
        options={models.map((model) => ({ id: model.slug, name: model.name }))}
        value={selectedModelId}
        onSelect={(option) => {
          toggleModel(option.name);
          setModelSheetOpen(false);
        }}
        onClear={() => {
          const next = { ...parseAttrs(attrsRaw) };
          delete next.model;
          router.setParams({
            attrs: Object.keys(next).length > 0 ? JSON.stringify(next) : "",
          });
          setModelSheetOpen(false);
        }}
        onClose={() => setModelSheetOpen(false)}
      />
    </SafeAreaView>
  );
}
