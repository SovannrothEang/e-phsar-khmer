import BrandGrid from "@/components/category/BrandGrid";
import ModelGrid from "@/components/category/ModelGrid";
import CategorySearchHeader from "@/components/category/CategorySearchHeader";
import { FeedScrollView } from "@/components/category/FeedScrollView";
import FilterChips from "@/components/category/FilterChips";
import ListingFeed from "@/components/category/ListingFeed";
import PromoCard from "@/components/home/PromoCard";
import Divider from "@/components/common/Divider";
import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { fetchBrands, fetchModels, fetchSubcategory } from "@/lib/api/catalog";
import { openFiltersHref } from "@/lib/filter-route";
import {
  feedQueryFromParams,
  pickFilterParams,
  sanitizeAttrs,
} from "@/lib/feed-params";
import SelectionSheet from "@/components/common/SelectionSheet";
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
  // View is URL-driven so the filter screen can apply it in place.
  const viewMode: ViewMode = params.view === "grid" ? "grid" : "list";
  const [modelSheetOpen, setModelSheetOpen] = useState(false);
  const [brandSheetOpen, setBrandSheetOpen] = useState(false);

  /** Set when arriving from a brand screen: brand -> bodytype. */
  const brandParam = Array.isArray(params.brand)
    ? params.brand[0]
    : params.brand;
  const brandScopeParam = Array.isArray(params.brandScope)
    ? params.brandScope[0]
    : params.brandScope;
  const isBrandScope = brandScopeParam === "1";
  // A `brand` param is only drill-down scope when the brand screen marked it;
  // a brand chosen in More Filters stays an editable filter.
  const scopeBrandParam = isBrandScope ? brandParam : undefined;

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
  const brandRow = scopeBrandParam
    ? brands.find(
        (entry) =>
          entry.name === scopeBrandParam || entry.slug === scopeBrandParam,
      )
    : undefined;
  const brandName = brandRow?.name ?? scopeBrandParam ?? "";
  /** The feed matches the stored display name, never a slug fallback. */
  const feedBrand = brandRow?.name;

  const modelsQuery = useQuery({
    queryKey: ["models", brandRow?.id, subCategoryId],
    queryFn: () => fetchModels(brandRow!.id, subCategoryId as string),
    enabled: !!brandRow?.id && !!subCategoryId,
  });
  const models = modelsQuery.data ?? [];

  const typeName =
    attrValue ||
    (typeId
      ? typeId
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ")
      : "");

  const feedQuery = useMemo(() => {
    const fromParams = feedQueryFromParams(params);
    const attrs = sanitizeAttrs({
      ...(attrKey && attrValue ? { [attrKey]: attrValue } : {}),
      ...(fromParams.attrs ?? {}),
    });
    return {
      subcategorySlug: subCategoryId,
      ...fromParams,
      // fromParams can hold `brand: undefined`; apply the route brand after
      // the spread so it is not erased.
      brand: feedBrand ?? fromParams.brand,
      ...(Object.keys(attrs).length > 0 ? { attrs } : {}),
    };
  }, [subCategoryId, feedBrand, attrKey, attrValue, params]);

  const selectedModel = feedQueryFromParams(params).attrs?.model ?? "";

  /** Model taps filter in place; the body type already comes from the route. */
  const toggleModel = (name: string) => {
    const current = { ...(feedQueryFromParams(params).attrs ?? {}) };
    if (current.model === name) delete current.model;
    else current.model = name;
    router.setParams({
      attrs: Object.keys(current).length > 0 ? JSON.stringify(current) : "",
    });
  };

  const toggleViewMode = () => {
    router.setParams({ view: viewMode === "list" ? "grid" : "" });
  };

  /** A brand tile or the See All sheet picks a brand for this type. */
  const openBrand = (brandSlug: string) => {
    setBrandSheetOpen(false);
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
    });
  };

  const openFilters = () =>
    router.push(
      openFiltersHref(
        "type",
        {
          categoryId,
          subCategoryId,
          typeId,
          attrKey,
          attrValue,
          brand: feedBrand ?? (isBrandScope ? brandParam : undefined),
          brandScope: isBrandScope ? "1" : undefined,
        },
        pickFilterParams(params),
      ),
    );

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
          brandIsScope={isBrandScope}
        />

        <FeedScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {brandName ? (
            models.length > 0 ? (
              <View>
                <ModelGrid
                  models={models.map((model) => ({
                    id: model.slug,
                    name: model.name,
                  }))}
                  selectedName={selectedModel}
                  onModelPress={(model) => toggleModel(model.name)}
                  onShowMore={() => setModelSheetOpen(true)}
                />
                <Divider />
              </View>
            ) : null
          ) : brands.length > 0 ? (
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
          ) : null}

          <Divider variant="thick" />

          <View className="mt-2">
            <ListingFeed
              query={feedQuery}
              viewMode={viewMode}
              leading={<PromoCard viewMode={viewMode} />}
              emptyLabel="No ads match this type yet."
            />
          </View>
        </FeedScrollView>
      </View>
      <SelectionSheet
        visible={modelSheetOpen}
        title="Model"
        options={models.map((model) => ({ id: model.slug, name: model.name }))}
        value={models.find((model) => model.name === selectedModel)?.slug ?? ""}
        loading={modelsQuery.isLoading}
        emptyLabel="No models"
        onSelect={(option) => {
          toggleModel(option.name);
          setModelSheetOpen(false);
        }}
        onClear={
          selectedModel
            ? () => {
                toggleModel(selectedModel);
                setModelSheetOpen(false);
              }
            : undefined
        }
        onClose={() => setModelSheetOpen(false)}
      />
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
