import SafeAreaView from "@/components/common/SafeAreaView";
import SearchPostCard from "@/components/search/SearchPostCard";
import UserResultRow from "@/components/search/UserResultRow";
import { Colors } from "@/constants/Colors";
import { fetchFeed } from "@/lib/api/feed";
import { searchUsers } from "@/lib/api/users";
import { firstParam } from "@/lib/feed-params";
import { toCardProduct } from "@/lib/listing-card";
import {
  addRecentSearch,
  clearRecentSearches,
  loadRecentSearches,
} from "@/lib/recent-searches";
import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const BLUE = "#0EA5E9";

/**
 * The reference's chips are navigation tabs, not in-place filters: User opens
 * the full list page and Post opens the search/browse page.
 */
const ResultChip = ({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.8}
    className="h-11 flex-1 items-center justify-center rounded-md bg-sky-100 dark:bg-sky-950"
    accessibilityRole="button"
  >
    <Text className="text-[15px] font-semibold text-sky-600 dark:text-sky-300">
      {label}
    </Text>
  </TouchableOpacity>
);

const EmptyState = ({ query }: { query: string }) => (
  <View className="items-center px-8 pt-16">
    <View className="mb-5 h-20 w-20 items-center justify-center rounded-full bg-white dark:bg-gray-900">
      <Ionicons name="search-outline" size={38} color={Colors.text.muted} />
    </View>
    <Text className="mb-2 text-center text-[18px] font-bold text-gray-900 dark:text-white">
      No results found for &quot;{query}&quot;
    </Text>
    <Text className="text-center text-sm leading-5 text-gray-500 dark:text-gray-400">
      Check the spelling or try something more general like &quot;iPhone&quot;
      or &quot;Car&quot;.
    </Text>
  </View>
);

export default function SearchScreen() {
  const params = useLocalSearchParams();
  // Category/search headers open this screen with their own scope; the field
  // then searches only inside that slice of the feed.
  const scopedCategory = firstParam(params.categorySlug) ?? "";
  const scopedSubcategory = firstParam(params.subcategorySlug) ?? "";
  const scopedBrand = firstParam(params.brand) ?? "";
  const scopedAttrKey = firstParam(params.attrKey) ?? "";
  const scopedAttrValue = firstParam(params.attrValue) ?? "";
  const isScoped =
    !!scopedCategory ||
    !!scopedSubcategory ||
    !!scopedBrand ||
    (!!scopedAttrKey && !!scopedAttrValue);

  // The submitted query lives in the route so the results state is
  // shareable/reloadable; the draft in the field may differ until submit.
  const submittedQuery = (firstParam(params.q) ?? "").trim();
  const showResults = submittedQuery.length > 0;

  const [query, setQuery] = useState(submittedQuery);
  const [recents, setRecents] = useState<string[]>([]);
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  // Recent searches are read from the device once per mount.
  useEffect(() => {
    let active = true;
    void loadRecentSearches().then((list) => {
      if (active) setRecents(list);
    });
    return () => {
      active = false;
    };
  }, []);

  // The reference's entry state has the keyboard up; results do not.
  useEffect(() => {
    if (showResults) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(timer);
  }, [showResults]);

  const submit = (term: string) => {
    // The backend rejects q > 100 chars; cap here so a paste cannot turn into
    // a generic error card on both sections.
    const next = term.trim().slice(0, 100);
    if (!next) return;
    Keyboard.dismiss();
    setQuery(next);
    router.setParams({ q: next });
    void addRecentSearch(next).then(setRecents);
  };

  const clearQuery = () => {
    setQuery("");
    router.setParams({ q: "" });
  };

  const goBack = () => {
    if (showResults) {
      clearQuery();
    } else {
      router.back();
    }
  };

  const editRecent = (term: string) => {
    setQuery(term);
    inputRef.current?.focus();
  };

  const clearRecents = () => {
    void clearRecentSearches().then(() => setRecents([]));
  };

  const openUsers = () => {
    router.push({
      pathname: "/search-users",
      params: { q: submittedQuery },
    } as never);
  };

  const openPosts = () => {
    router.push({
      pathname: "/search-posts",
      params: { q: submittedQuery },
    } as never);
  };

  const userQuery = useQuery({
    queryKey: ["user-search", submittedQuery, 3],
    queryFn: () => searchUsers(submittedQuery, { pageSize: 3 }),
    enabled: showResults && !isScoped,
    staleTime: 30_000,
  });

  const postsQuery = useInfiniteQuery({
    queryKey: [
      "search-posts",
      submittedQuery,
      scopedCategory,
      scopedSubcategory,
      scopedBrand,
      scopedAttrKey,
      scopedAttrValue,
    ],
    queryFn: ({ pageParam }) =>
      fetchFeed({
        q: submittedQuery || undefined,
        categorySlug: scopedCategory || undefined,
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
    enabled: showResults,
  });

  const products = useMemo(
    () =>
      (postsQuery.data?.pages ?? [])
        .flatMap((page) => page.items)
        .map(toCardProduct),
    [postsQuery.data],
  );

  const users = userQuery.data?.items ?? [];
  const userTotal = userQuery.data?.total ?? 0;
  const showUsers = !isScoped;

  const usersEmpty = !isScoped && userQuery.isSuccess && users.length === 0;
  const postsEmpty =
    postsQuery.isSuccess && !postsQuery.isLoading && products.length === 0;
  // The reference's "sakkuna" state shows the User card only: in the default
  // All view an empty post section disappears. The dedicated Post page is
  // where an empty post result is reported; scoped searches keep the message.
  const showPostsSection = isScoped || !postsEmpty;
  const showGlobalEmpty =
    !isScoped && userQuery.isSuccess && usersEmpty && postsEmpty;

  return (
    <SafeAreaView
      statusBarColor={showResults ? BLUE : "#FFFFFF"}
      statusBarStyle={showResults ? "light-content" : "dark-content"}
    >
      {showResults ? (
        <View className="bg-[#0EA5E9] px-4 pb-3 pt-2">
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={goBack}
              className="h-10 w-10 items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="arrow-back" size={28} color="white" />
            </TouchableOpacity>

            <View className="flex-1 flex-row items-center rounded-full bg-white px-3.5 py-2.5">
              <TextInput
                ref={inputRef}
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => submit(query)}
                returnKeyType="search"
                maxLength={100}
                placeholder="Search..."
                placeholderTextColor={Colors.text.muted}
                className="flex-1 py-0 text-[15px] text-gray-900"
                accessibilityLabel="Search"
              />
              {query.length > 0 ? (
                <TouchableOpacity
                  onPress={clearQuery}
                  className="ml-1 p-0.5"
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                >
                  <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                onPress={() => submit(query)}
                className="ml-2 p-0.5"
                accessibilityRole="button"
                accessibilityLabel="Search"
              >
                <Ionicons name="search" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <View className="flex-row items-center bg-white px-4 py-3">
          <TouchableOpacity
            onPress={goBack}
            className="mr-2 rounded-full p-1"
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={26} color={Colors.text.primary} />
          </TouchableOpacity>

          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => submit(query)}
            returnKeyType="search"
            maxLength={100}
            placeholder="Search..."
            placeholderTextColor={Colors.text.muted}
            className="ml-1 flex-1 py-1 text-[18px] text-gray-900"
            accessibilityLabel="Search"
          />

          <TouchableOpacity
            onPress={() => submit(query)}
            className="p-1"
            accessibilityRole="button"
            accessibilityLabel="Search"
          >
            <Ionicons name="search" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>
      )}

      {!showResults ? (
        <ScrollView
          className="flex-1 bg-white"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {recents.length > 0 ? (
            <>
              <View className="flex-row items-center justify-between px-4 pb-2 pt-5">
                <Text className="text-[17px] font-bold text-gray-900">
                  Recent
                </Text>
                <TouchableOpacity
                  onPress={clearRecents}
                  accessibilityRole="button"
                >
                  <Text className="text-[15px] font-semibold text-sky-500">
                    Clear
                  </Text>
                </TouchableOpacity>
              </View>

              {recents.map((term, index) => (
                <View key={`${term}-${index}`}>
                  <TouchableOpacity
                    onPress={() => submit(term)}
                    activeOpacity={0.7}
                    className="flex-row items-center px-4 py-3.5"
                    accessibilityRole="button"
                  >
                    <Ionicons name="time-outline" size={22} color="#9CA3AF" />
                    <Text
                      className="ml-3 flex-1 text-[15px] text-gray-900"
                      numberOfLines={1}
                    >
                      {term}
                    </Text>
                    <TouchableOpacity
                      onPress={() => editRecent(term)}
                      hitSlop={10}
                      className="p-1"
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${term}`}
                    >
                      <Ionicons name="pencil" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                  {index < recents.length - 1 ? (
                    <View className="ml-[50px] h-px bg-gray-100" />
                  ) : null}
                </View>
              ))}
            </>
          ) : null}
        </ScrollView>
      ) : (
        <ScrollView
          key={submittedQuery}
          className="flex-1 bg-neutral-background dark:bg-gray-950"
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {!isScoped ? (
            <View className="flex-row gap-2 bg-white px-3 pb-3 pt-2 dark:bg-gray-950">
              <ResultChip label="User" onPress={openUsers} />
              <ResultChip label="Post" onPress={openPosts} />
            </View>
          ) : null}

          {showUsers ? (
            userQuery.isLoading ? (
              <View className="mx-3 mt-3 items-center rounded-lg bg-white py-6 dark:bg-gray-900">
                <ActivityIndicator color={BLUE} />
              </View>
            ) : userQuery.isError ? (
              <View className="mx-3 mt-3 rounded-lg bg-white px-4 py-4 dark:bg-gray-900">
                <Text className="text-sm text-gray-500 dark:text-gray-400">
                  Could not load people.
                </Text>
                <TouchableOpacity
                  onPress={() => userQuery.refetch()}
                  className="mt-2 self-start"
                >
                  <Text className="text-sm font-semibold text-sky-600">
                    Try again
                  </Text>
                </TouchableOpacity>
              </View>
            ) : users.length > 0 ? (
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
                <Text className="px-4 pb-1 pt-4 text-[16px] font-bold text-gray-900 dark:text-white">
                  User
                </Text>
                {users.map((user, index) => (
                  <View
                    key={user.id}
                    className={
                      index > 0
                        ? "border-t border-gray-100 dark:border-gray-800"
                        : ""
                    }
                  >
                    <UserResultRow user={user} />
                  </View>
                ))}
                {userTotal >= 3 ? (
                  <TouchableOpacity
                    onPress={openUsers}
                    activeOpacity={0.8}
                    className="mx-3 mb-3 mt-1 h-11 items-center justify-center rounded-md bg-sky-100 dark:bg-sky-950"
                    accessibilityRole="button"
                  >
                    <Text className="text-[15px] font-semibold text-sky-600 dark:text-sky-300">
                      Show More
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null
          ) : null}

          {showPostsSection ? (
            <View className="mt-4">
              <Text className="mx-3 mb-2 text-[16px] font-bold text-gray-900 dark:text-white">
                Posts
              </Text>

              {postsQuery.isLoading ? (
                <View className="items-center py-8">
                  <ActivityIndicator color={BLUE} />
                </View>
              ) : postsQuery.isError ? (
                <View className="mx-3 items-center rounded-lg bg-white px-4 py-6 dark:bg-gray-900">
                  <Text className="text-center text-sm text-gray-500">
                    Could not run this search.
                  </Text>
                  <TouchableOpacity
                    onPress={() => postsQuery.refetch()}
                    className="mt-3 rounded-md border border-sky-500 px-5 py-2"
                  >
                    <Text className="text-sm font-semibold text-sky-600">
                      Try again
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : products.length === 0 ? (
                <Text className="mx-4 pt-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  No posts found for &quot;{submittedQuery}&quot;.
                </Text>
              ) : (
                products.map((product) => (
                  <SearchPostCard key={product.id} product={product} />
                ))
              )}

              {postsQuery.hasNextPage ? (
                <TouchableOpacity
                  onPress={() => postsQuery.fetchNextPage()}
                  disabled={postsQuery.isFetchingNextPage}
                  className="mx-3 my-4 h-11 items-center justify-center rounded-md border border-sky-500"
                >
                  {postsQuery.isFetchingNextPage ? (
                    <ActivityIndicator color={BLUE} />
                  ) : (
                    <Text className="text-sm font-semibold text-sky-600">
                      Load more
                    </Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {showGlobalEmpty ? <EmptyState query={submittedQuery} /> : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
