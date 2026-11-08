import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { fetchMyReactionsList } from "@/lib/api/account";
import { toCardProduct } from "@/lib/listing-card";
import { formatMoney } from "@/lib/listings";
import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Image,
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
    <SafeAreaView
      statusBarColor={Colors.primary.DEFAULT}
      statusBarStyle="light-content"
      className="flex-1 bg-neutral-background"
    >
      <Stack.Screen options={{ headerShown: false }} />

      <View className="flex-row items-center justify-between bg-primary px-4 py-4">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-white">
          {kind === "likes" ? "Like" : "Save"}
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
          <Text className="py-16 text-center text-base text-gray-400">
            No Result!
          </Text>
        ) : (
          <>
            <View className="px-4 pt-3">
              {products.map((product) => (
                <TouchableOpacity
                  key={product.id}
                  activeOpacity={0.8}
                  onPress={() => router.push(`/product/${product.id}` as never)}
                  className="mb-3 flex-row overflow-hidden rounded-lg bg-white p-2 dark:bg-gray-900"
                >
                  <View className="h-32 w-32 overflow-hidden rounded-md bg-neutral-background dark:bg-gray-800">
                    {product.image ? (
                      <Image
                        source={{ uri: product.image }}
                        className="h-full w-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="h-full w-full items-center justify-center">
                        <Ionicons
                          name="image-outline"
                          size={28}
                          color="#9CA3AF"
                        />
                      </View>
                    )}
                  </View>

                  <View className="ml-3 flex-1 justify-between py-1">
                    <View>
                      <Text
                        className="text-base font-semibold text-gray-900 dark:text-white"
                        numberOfLines={2}
                      >
                        {product.title}
                      </Text>
                      <Text
                        className="mt-1 text-sm text-gray-400"
                        numberOfLines={1}
                      >
                        {product.location}
                      </Text>
                    </View>
                    <View className="mt-2 flex-row items-center justify-between">
                      <Text className="text-lg font-bold text-rose-600 dark:text-rose-400">
                        {product.price === null
                          ? "Negotiable"
                          : formatMoney(product.price)}
                      </Text>
                      <Ionicons
                        name={kind === "likes" ? "heart" : "bookmark"}
                        size={26}
                        color={Colors.primary.DEFAULT}
                      />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {query.hasNextPage ? null : (
              <Text className="py-4 text-center text-base text-gray-400">
                No more result!
              </Text>
            )}
          </>
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
