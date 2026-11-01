import ProductCard from "@/components/product/ProductCard";
import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { fetchMyReactionsList } from "@/lib/api/account";
import { toCardProduct } from "@/lib/listing-card";
import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function MyReactionsScreen() {
  const params = useLocalSearchParams<{ kind?: string | string[] }>();
  const rawKind = Array.isArray(params.kind) ? params.kind[0] : params.kind;
  const kind: "likes" | "saves" = rawKind === "saves" ? "saves" : "likes";

  const query = useInfiniteQuery({
    queryKey: ["my-reactions", kind],
    queryFn: ({ pageParam }) => fetchMyReactionsList(kind, pageParam, 20),
    initialPageParam: 1,
    getNextPageParam: (last, pages) =>
      last.hasMore ? pages.length + 1 : undefined,
  });

  const products = (query.data?.pages ?? [])
    .flatMap((page) => page.items)
    .map(toCardProduct);

  return (
    <SafeAreaView className="flex-1 bg-neutral-background">
      <Stack.Screen options={{ headerShown: false }} />

      <View className="flex-row items-center justify-between bg-primary px-4 py-4">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-white">
          {kind === "likes" ? "Likes" : "Saved Ads"}
        </Text>
        <View className="w-6" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {query.isLoading ? (
          <View className="items-center py-10">
            <ActivityIndicator color={Colors.primary.DEFAULT} />
          </View>
        ) : products.length === 0 ? (
          <View className="items-center px-6 py-12">
            <Ionicons
              name={kind === "likes" ? "heart-outline" : "bookmark-outline"}
              size={40}
              color="#9CA3AF"
            />
            <Text className="mt-3 text-neutral-text-sub">
              {kind === "likes"
                ? "Ads you like will appear here."
                : "Ads you save will appear here."}
            </Text>
          </View>
        ) : (
          <View className="flex-row flex-wrap px-1.5 pt-2">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} viewMode="grid" />
            ))}
          </View>
        )}

        {query.hasNextPage ? (
          <View className="items-center py-4">
            <TouchableOpacity
              onPress={() => query.fetchNextPage()}
              disabled={query.isFetchingNextPage}
              className="rounded-xl border border-primary px-6 py-2.5"
            >
              {query.isFetchingNextPage ? (
                <ActivityIndicator color={Colors.primary.DEFAULT} />
              ) : (
                <Text className="font-bold text-primary">Load more</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
