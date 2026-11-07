import SafeAreaView from "@/components/common/SafeAreaView";
import ProductCard from "@/components/product/ProductCard";
import { Colors } from "@/constants/Colors";
import { fetchCategories } from "@/lib/api/listings";
import { fetchFeed } from "@/lib/api/feed";
import { firstParam } from "@/lib/feed-params";
import { toCardProduct } from "@/lib/listing-card";
import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function SearchScreen() {
  const params = useLocalSearchParams();
  // A category/subcategory/brand/type screen opens this with its own scope;
  // the field then searches only inside that slice of the feed.
  const scopedCategory = firstParam(params.categorySlug) ?? "";
  const scopedSubcategory = firstParam(params.subcategorySlug) ?? "";
  const scopedBrand = firstParam(params.brand) ?? "";
  const scopedAttrKey = firstParam(params.attrKey) ?? "";
  const scopedAttrValue = firstParam(params.attrValue) ?? "";
  const scopeName = firstParam(params.scopeName) ?? "";
  const isScoped =
    !!scopedCategory ||
    !!scopedSubcategory ||
    !!scopedBrand ||
    (!!scopedAttrKey && !!scopedAttrValue);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [categorySlug, setCategorySlug] = useState(scopedCategory);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(timer);
  }, []);

  // Debounce typing so every keystroke does not hit the feed.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime: 5 * 60_000,
  });
  const categories = categoriesQuery.data ?? [];

  const hasFilter =
    debouncedQuery.length > 0 || categorySlug.length > 0 || isScoped;

  const results = useInfiniteQuery({
    queryKey: [
      "search",
      debouncedQuery,
      categorySlug,
      scopedSubcategory,
      scopedBrand,
      scopedAttrKey,
      scopedAttrValue,
    ],
    queryFn: ({ pageParam }) =>
      fetchFeed({
        q: debouncedQuery || undefined,
        categorySlug: categorySlug || undefined,
        subcategorySlug: scopedSubcategory || undefined,
        ...(scopedBrand ? { brand: scopedBrand } : {}),
        ...(scopedAttrKey && scopedAttrValue
          ? { attrs: { [scopedAttrKey]: scopedAttrValue } }
          : {}),
        cursor: pageParam,
        limit: 20,
        includeTotal: true,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: hasFilter,
  });

  const products = useMemo(
    () =>
      (results.data?.pages ?? [])
        .flatMap((page) => page.items)
        .map(toCardProduct),
    [results.data],
  );
  const total = results.data?.pages[0]?.total ?? products.length;

  return (
    <SafeAreaView statusBarColor="white" statusBarStyle="dark-content">
      {/* Search Header */}
      <View
        className="flex-row items-center border-b border-neutral-border/50 bg-white px-4 py-3"
        style={{
          elevation: 2,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          className="mr-3 rounded-full p-1"
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>

        <View className="flex-1 flex-row items-center rounded-xl border border-neutral-border/30 bg-neutral-background px-3 py-2">
          <Ionicons name="search" size={20} color={Colors.text.muted} />
          <TextInput
            ref={inputRef}
            placeholder={scopeName || "Search products, jobs, cars..."}
            placeholderTextColor={Colors.text.muted}
            className="ml-2 flex-1 py-0.5 text-base text-neutral-text-main"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => setQuery("")}
              className="rounded-full bg-neutral-border/60 p-0.5"
            >
              <Ionicons name="close" size={16} color={Colors.text.sub} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity onPress={() => router.back()} className="ml-4 py-2">
          <Text className="text-base font-bold text-primary">Cancel</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-1 bg-white">
        {!hasFilter ? (
          <ScrollView className="flex-1 px-4 pt-6">
            <Text className="mb-4 text-base font-bold text-neutral-text-main">
              Browse categories
            </Text>
            <View className="flex-row flex-wrap gap-2.5">
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  onPress={() =>
                    router.push(`/(categories)/${category.slug}` as never)
                  }
                  activeOpacity={0.7}
                  className="rounded-full border border-neutral-border/20 bg-neutral-background px-4 py-2"
                >
                  <Text className="text-sm font-medium text-neutral-text-sub">
                    {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        ) : (
          <View className="flex-1">
            {/* Category facet — hidden when the opener already scoped this search. */}
            {!isScoped && (
              <View className="border-b border-neutral-border/10 bg-white py-2">
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
                >
                  <TouchableOpacity
                    onPress={() => setCategorySlug("")}
                    className={`rounded-full px-3.5 py-1.5 ${
                      categorySlug === ""
                        ? "bg-sky-500"
                        : "border border-neutral-border/40 bg-neutral-background"
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        categorySlug === ""
                          ? "text-white"
                          : "text-neutral-text-sub"
                      }`}
                    >
                      All
                    </Text>
                  </TouchableOpacity>
                  {categories.map((category) => {
                    const selected = categorySlug === category.slug;
                    return (
                      <TouchableOpacity
                        key={category.id}
                        onPress={() =>
                          setCategorySlug(selected ? "" : category.slug)
                        }
                        className={`rounded-full px-3.5 py-1.5 ${
                          selected
                            ? "bg-sky-500"
                            : "border border-neutral-border/40 bg-neutral-background"
                        }`}
                      >
                        <Text
                          className={`text-xs font-semibold ${
                            selected ? "text-white" : "text-neutral-text-sub"
                          }`}
                        >
                          {category.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Header info bar */}
            <View className="flex-row items-center justify-between border-b border-neutral-border/10 bg-neutral-background/30 px-4 py-3">
              <Text
                className="flex-1 text-sm font-medium text-neutral-text-sub"
                numberOfLines={1}
              >
                {results.isLoading
                  ? "Searching…"
                  : scopeName
                    ? `${total} result${total !== 1 ? "s" : ""} in ${scopeName}`
                    : `${total} result${total !== 1 ? "s" : ""} found`}
              </Text>
              {products.length > 0 && (
                <TouchableOpacity
                  onPress={() =>
                    setViewMode((prev) => (prev === "list" ? "grid" : "list"))
                  }
                  className="rounded-md p-1"
                >
                  <Ionicons
                    name={viewMode === "list" ? "grid-outline" : "list-outline"}
                    size={20}
                    color={Colors.text.sub}
                  />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView
              className="flex-1"
              contentContainerStyle={{ paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
            >
              {results.isLoading ? (
                <View className="mt-20 items-center">
                  <ActivityIndicator color={Colors.primary.DEFAULT} />
                </View>
              ) : results.isError ? (
                <View className="mt-20 items-center px-8">
                  <Text className="text-center text-neutral-text-sub">
                    Could not run this search.
                  </Text>
                  <TouchableOpacity
                    onPress={() => results.refetch()}
                    className="mt-3 rounded-lg border border-primary px-5 py-2"
                  >
                    <Text className="font-bold text-primary">Try again</Text>
                  </TouchableOpacity>
                </View>
              ) : products.length === 0 ? (
                <View className="mt-20 items-center justify-center p-8">
                  <View className="mb-6 h-20 w-20 items-center justify-center rounded-full bg-neutral-background">
                    <Ionicons
                      name="search-outline"
                      size={40}
                      color={Colors.text.muted}
                    />
                  </View>
                  <Text className="mb-2 text-center text-xl font-bold text-neutral-text-main">
                    {debouncedQuery
                      ? `No results found for "${debouncedQuery}"`
                      : "No ads in this category yet"}
                  </Text>
                  <Text className="px-8 text-center text-sm leading-5 text-neutral-text-sub">
                    Check the spelling or try something more general like
                    &quot;iPhone&quot; or &quot;Car&quot;.
                  </Text>
                </View>
              ) : viewMode === "list" ? (
                <View>
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      viewMode="list"
                    />
                  ))}
                </View>
              ) : (
                <View className="flex-row flex-wrap px-1.5 pt-1.5">
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      viewMode="grid"
                    />
                  ))}
                </View>
              )}

              {results.hasNextPage ? (
                <View className="items-center px-6 py-5">
                  <TouchableOpacity
                    onPress={() => results.fetchNextPage()}
                    disabled={results.isFetchingNextPage}
                    className="rounded-xl border border-primary px-6 py-2.5"
                  >
                    {results.isFetchingNextPage ? (
                      <ActivityIndicator color={Colors.primary.DEFAULT} />
                    ) : (
                      <Text className="font-bold text-primary">Load more</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : null}
            </ScrollView>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
