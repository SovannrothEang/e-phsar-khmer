import { FeedScrollView } from "@/components/category/FeedScrollView";
import FilterChips from "@/components/category/FilterChips";
import ListingFeed from "@/components/category/ListingFeed";
import PromoCard from "@/components/home/PromoCard";
import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { fetchCategories } from "@/lib/api/listings";
import { categoryImage } from "@/lib/category-images";
import {
  countActiveFilters,
  feedQueryFromParams,
  firstParam,
  pickFilterParams,
} from "@/lib/feed-params";
import { openFiltersHref } from "@/lib/filter-route";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Image,
  Keyboard,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const BLUE = "#0EA5E9";

/**
 * The Post tab. The reference shows a search/browse page: the query in the
 * header, the standard Filters/Location/Sort/Price row, the top-level
 * category grid, the home banner, the sell promo and the listing feed. The X
 * clears the query and leaves this page in its browse state (title "Search").
 */
export default function SearchPostsScreen() {
  const params = useLocalSearchParams();
  const submittedQuery = (firstParam(params.q) ?? "").trim();
  const viewMode = firstParam(params.view) === "grid" ? "grid" : "list";

  const [query, setQuery] = useState(submittedQuery);
  const [syncedQuery, setSyncedQuery] = useState(submittedQuery);
  // Filters Apply dismisses back to this page with a new q; keep the header
  // input in step without an effect that can clobber typing.
  if (submittedQuery !== syncedQuery) {
    setSyncedQuery(submittedQuery);
    setQuery(submittedQuery);
  }

  const filters = useMemo(() => feedQueryFromParams(params), [params]);
  const feedQuery = useMemo(
    () => ({
      q: submittedQuery || undefined,
      ...filters,
      limit: 20,
      includeTotal: true,
    }),
    [submittedQuery, filters],
  );

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime: 5 * 60_000,
  });
  const categories = categoriesQuery.data ?? [];

  const filterCount =
    countActiveFilters(params) + (submittedQuery.length > 0 ? 1 : 0);

  const submit = () => {
    const next = query.trim().slice(0, 100);
    Keyboard.dismiss();
    router.setParams({ q: next });
  };

  const clearQuery = () => {
    setQuery("");
    router.setParams({ q: "" });
  };

  const toggleViewMode = () => {
    router.setParams({ view: viewMode === "list" ? "grid" : "" });
  };

  const openFilters = () => {
    router.push(
      openFiltersHref(
        "searchPosts",
        {},
        {
          ...pickFilterParams(params),
          q: submittedQuery || "",
        },
      ),
    );
  };

  return (
    <SafeAreaView statusBarColor={BLUE} statusBarStyle="light-content">
      <View className="bg-[#0EA5E9] px-3 pb-3 pt-2">
        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={28} color="white" />
          </TouchableOpacity>

          <View className="flex-1 flex-row items-center rounded-md bg-white/25 px-3 py-2.5">
            <Ionicons name="search" size={20} color="white" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={submit}
              returnKeyType="search"
              maxLength={100}
              placeholder="Search"
              placeholderTextColor="rgba(255,255,255,0.8)"
              className="ml-2 flex-1 py-0 text-[15px] text-white"
              accessibilityLabel="Search posts"
            />
            {query.length > 0 ? (
              <TouchableOpacity
                onPress={clearQuery}
                className="p-0.5"
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close" size={22} color="white" />
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: "/account/reactions",
                params: { kind: "saves" },
              } as never)
            }
            className="h-10 w-10 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Saved ads"
          >
            <Ionicons name="bookmark-outline" size={24} color="white" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={openFilters}
            className="h-10 w-10 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Filters"
          >
            <View>
              <Ionicons name="options-outline" size={24} color="white" />
              {filterCount > 0 ? (
                <View className="absolute -right-2.5 -top-2 h-5 min-w-5 items-center justify-center rounded-full bg-secondary-orange px-1">
                  <Text className="text-[11px] font-bold text-white">
                    {filterCount}
                  </Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View className="flex-1 bg-white dark:bg-gray-950">
        <View className="flex-row items-center justify-between px-4 pb-2 pt-3">
          <Text
            className="flex-1 text-xl font-bold text-gray-900 dark:text-white"
            numberOfLines={1}
          >
            {submittedQuery || "Search"}
          </Text>
          <TouchableOpacity onPress={toggleViewMode} className="p-1">
            <Ionicons
              name={viewMode === "list" ? "grid-outline" : "list-outline"}
              size={24}
              color="#1F2937"
            />
          </TouchableOpacity>
        </View>

        <FilterChips
          onFiltersPress={openFilters}
          extraFilterCount={submittedQuery.length > 0 ? 1 : 0}
        />

        <FeedScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {categories.length > 0 ? (
            <View className="bg-white px-1 pb-3 pt-2 dark:bg-gray-950">
              <View className="flex-row flex-wrap">
                {categories.map((item) => {
                  const image = categoryImage(item.slug);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() =>
                        router.push(`/(categories)/${item.slug}` as never)
                      }
                      className="mb-4 w-1/4 items-center px-1"
                      activeOpacity={0.7}
                    >
                      <View className="mb-1.5 h-14 w-14 items-center justify-center">
                        {image ? (
                          <Image
                            source={image}
                            className="h-12 w-12"
                            resizeMode="contain"
                          />
                        ) : (
                          <View className="h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-gray-800">
                            <Ionicons
                              name="grid-outline"
                              size={25}
                              color={Colors.primary.DEFAULT}
                            />
                          </View>
                        )}
                      </View>
                      <Text
                        className="text-center text-[11px] font-medium leading-3.5 text-gray-800 dark:text-gray-200"
                        numberOfLines={2}
                      >
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View className="h-3 bg-neutral-border" />

          <View className="pt-2">
            <ListingFeed
              query={feedQuery}
              viewMode={viewMode}
              leading={<PromoCard viewMode={viewMode} />}
              emptyLabel="No ads found."
            />
          </View>
        </FeedScrollView>
      </View>
    </SafeAreaView>
  );
}
