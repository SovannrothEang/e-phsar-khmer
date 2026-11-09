import SafeAreaView from "@/components/common/SafeAreaView";
import UserResultRow from "@/components/search/UserResultRow";
import { searchUsers } from "@/lib/api/users";
import { firstParam } from "@/lib/feed-params";
import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const BLUE = "#0EA5E9";

/**
 * "Show More" destination for the inline User preview. The reference titles it
 * `Search: <q>`, lists every match as its own white card, and closes with
 * "No more result!" once the last page is in.
 */
export default function SearchUsersScreen() {
  const params = useLocalSearchParams();
  const q = (firstParam(params.q) ?? "").trim();

  const query = useInfiniteQuery({
    queryKey: ["user-search-all", q],
    queryFn: ({ pageParam }) =>
      searchUsers(q, { page: pageParam, pageSize: 20 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: q.length > 0,
  });

  const users = useMemo(
    () => (query.data?.pages ?? []).flatMap((page) => page.items),
    [query.data],
  );

  const fetchMore = () => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  };

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
          data={users}
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
              <UserResultRow user={item} showChevron={false} />
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          onEndReached={fetchMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            query.isLoading ? (
              <View className="items-center pt-16">
                <ActivityIndicator color={BLUE} />
              </View>
            ) : query.isError ? (
              <View className="items-center px-8 pt-16">
                <Text className="text-center text-sm text-gray-500 dark:text-gray-400">
                  Could not load people.
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
                No users found for &quot;{q}&quot;.
              </Text>
            )
          }
          ListFooterComponent={
            query.isFetchNextPageError ? (
              <View className="items-center py-5">
                <Text className="text-sm text-gray-500 dark:text-gray-400">
                  Could not load more.
                </Text>
                <TouchableOpacity
                  onPress={() => query.fetchNextPage()}
                  className="mt-2 rounded-md border border-sky-500 px-4 py-1.5"
                >
                  <Text className="text-sm font-semibold text-sky-600">
                    Retry
                  </Text>
                </TouchableOpacity>
              </View>
            ) : query.isFetchingNextPage ? (
              <View className="items-center py-5">
                <ActivityIndicator color={BLUE} />
              </View>
            ) : users.length > 0 && !query.hasNextPage ? (
              <Text className="py-5 text-center text-sm text-gray-400">
                No more result!
              </Text>
            ) : undefined
          }
        />
      </View>
    </SafeAreaView>
  );
}
