import CategorySearchHeader from "@/components/category/CategorySearchHeader";
import { FeedScrollView } from "@/components/category/FeedScrollView";
import FilterChips from "@/components/category/FilterChips";
import ListingFeed from "@/components/category/ListingFeed";
import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { fetchCategory } from "@/lib/api/catalog";
import { feedQueryFromParams, pickFilterParams } from "@/lib/feed-params";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type ViewMode = "list" | "grid";

export default function CategoryScreen() {
  const params = useLocalSearchParams();
  const categoryId = Array.isArray(params.categoryId)
    ? params.categoryId[0]
    : params.categoryId;
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const categoryQuery = useQuery({
    queryKey: ["category", categoryId],
    queryFn: () => fetchCategory(categoryId as string),
    enabled: !!categoryId,
  });
  const category = categoryQuery.data;

  const feedQuery = useMemo(
    () => ({
      categorySlug: categoryId,
      ...feedQueryFromParams(params),
    }),
    [categoryId, params],
  );

  const toggleViewMode = () => {
    setViewMode(viewMode === "list" ? "grid" : "list");
  };

  const openFilters = () =>
    router.push({
      pathname: "/filters",
      params: { categoryId, ...pickFilterParams(params) },
    });

  const categoryName = category?.name || categoryId || "Category";

  const subCategoryPages = useMemo(() => {
    const subCategories = category?.subcategories ?? [];
    const pages = [];
    for (let i = 0; i < subCategories.length; i += 8) {
      pages.push(subCategories.slice(i, i + 8));
    }
    return pages;
  }, [category?.subcategories]);

  const [currentPage, setCurrentPage] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  const handleScroll = (event: {
    nativeEvent: { contentOffset: { x: number } };
  }) => {
    if (containerWidth <= 0) return;
    const pageIndex = Math.round(
      event.nativeEvent.contentOffset.x / containerWidth,
    );
    if (
      pageIndex !== currentPage &&
      pageIndex >= 0 &&
      pageIndex < subCategoryPages.length
    ) {
      setCurrentPage(pageIndex);
    }
  };

  if (categoryQuery.isLoading) {
    return (
      <SafeAreaView className="bg-neutral-surface">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={Colors.primary.DEFAULT} />
        </View>
      </SafeAreaView>
    );
  }

  if (!category) {
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
        placeholder={`Search in ${categoryName}...`}
        onFiltersPress={openFilters}
      />

      <View className="flex-1 bg-white">
        <View className="flex-row items-center justify-between border-b border-gray-100 px-4 py-3">
          <Text className="text-xl font-bold capitalize text-gray-900">
            {categoryName}
          </Text>

          <View className="flex-row items-center gap-4">
            <TouchableOpacity onPress={toggleViewMode} className="p-1">
              <Ionicons
                name={viewMode === "list" ? "grid-outline" : "list-outline"}
                size={24}
                color="#1F2937"
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
          {subCategoryPages.length > 0 && (
            <View
              className="mb-2 border-b border-gray-100 bg-white pb-4 pt-2"
              onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
            >
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                contentContainerStyle={{
                  width: containerWidth
                    ? containerWidth * subCategoryPages.length
                    : "100%",
                }}
              >
                {subCategoryPages.map((pageSubs, pageIdx) => (
                  <View
                    key={`page-${pageIdx}`}
                    style={{ width: containerWidth || "100%" }}
                    className="flex-row flex-wrap px-2"
                  >
                    {pageSubs.map((sub, index) => (
                      <TouchableOpacity
                        key={`${sub.id}-${index}`}
                        onPress={() =>
                          router.push(
                            `/(categories)/${categoryId}/${sub.slug}` as never,
                          )
                        }
                        className="w-[25%] items-center px-1 py-2.5"
                        activeOpacity={0.7}
                      >
                        <View className="mb-1.5 h-14 w-14 items-center justify-center rounded-full bg-slate-100/90 p-2 dark:bg-gray-800">
                          {sub.icon ? (
                            <Image
                              source={{ uri: sub.icon }}
                              className="h-10 w-10"
                              resizeMode="contain"
                            />
                          ) : (
                            <Ionicons
                              name="grid-outline"
                              size={26}
                              color="#2563EB"
                            />
                          )}
                        </View>
                        <Text
                          className="text-center text-[11px] font-medium leading-3.5 text-gray-800"
                          numberOfLines={2}
                        >
                          {sub.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </ScrollView>

              {subCategoryPages.length > 1 && (
                <View className="mt-3 flex-row items-center justify-center gap-1.5">
                  {subCategoryPages.map((_, dotIdx) => (
                    <View
                      key={`dot-${dotIdx}`}
                      className={`h-2 rounded-full ${
                        currentPage === dotIdx
                          ? "w-4 bg-orange-500"
                          : "w-2 bg-gray-300"
                      }`}
                    />
                  ))}
                </View>
              )}
            </View>
          )}

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
