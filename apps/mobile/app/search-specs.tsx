import SafeAreaView from "@/components/common/SafeAreaView";
import SpecResultRow from "@/components/search/SpecResultRow";
import { fetchProducts } from "@/lib/api/products";
import { firstParam } from "@/lib/feed-params";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const BLUE = "#0EA5E9";

/**
 * "Show More" destination for the inline Specifications preview. Mirrors
 * search-users' blue header and white-card list; the products endpoint has no
 * pagination, so one request carries the whole list (the backend caps it at
 * 200).
 */
export default function SearchSpecsScreen() {
  const params = useLocalSearchParams();
  const q = (firstParam(params.q) ?? "").trim();

  const query = useQuery({
    queryKey: ["product-search-all", q],
    queryFn: () => fetchProducts(q, 200),
    enabled: q.length > 0,
  });
  const specs = query.data ?? [];

  return (
    <SafeAreaView statusBarColor={BLUE} statusBarStyle="light-content">
      <View className="bg-[#0EA5E9] px-4 pb-4 pt-3">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={28} color="white" />
          </TouchableOpacity>
          <Text
            className="ml-2 flex-1 text-[18px] font-bold text-white"
            numberOfLines={1}
          >
            Search: {q}
          </Text>
        </View>
      </View>

      <View className="flex-1 bg-neutral-background dark:bg-gray-950">
        <FlatList
          data={specs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View
              className="mx-3 mt-3 overflow-hidden rounded-lg bg-white dark:bg-gray-900"
              style={{
                elevation: 2,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.08,
                shadowRadius: 2,
              }}
            >
              <SpecResultRow product={item} />
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            query.isLoading ? (
              <View className="items-center pt-16">
                <ActivityIndicator color={BLUE} />
              </View>
            ) : query.isError ? (
              <View className="items-center px-8 pt-16">
                <Text className="text-center text-sm text-gray-500 dark:text-gray-400">
                  Could not load specifications.
                </Text>
                <TouchableOpacity
                  onPress={() => query.refetch()}
                  className="mt-3 rounded-md border border-sky-500 px-5 py-2"
                >
                  <Text className="text-sm font-semibold text-sky-600">
                    Try again
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text className="px-8 pt-16 text-center text-sm text-gray-500 dark:text-gray-400">
                No specifications found for &quot;{q}&quot;.
              </Text>
            )
          }
        />
      </View>
    </SafeAreaView>
  );
}
