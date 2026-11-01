import { Colors } from "@/constants/Colors";
import ProductCard from "@/components/product/ProductCard";
import { fetchFeed, type FeedQuery } from "@/lib/api/feed";
import { toCardProduct } from "@/lib/listing-card";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo, type ReactNode } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { useFeedScroll } from "./FeedScrollView";

interface ListingFeedProps {
  query: FeedQuery;
  viewMode: "list" | "grid";
  emptyLabel?: string;
  /** Rendered before the cards (Latest Ads keeps its promo card there). */
  leading?: ReactNode;
}

/** The one feed renderer every browse and home screen uses; pages as you scroll. */
function ListingFeed({
  query,
  viewMode,
  emptyLabel = "No ads found.",
  leading,
}: ListingFeedProps) {
  const clean = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(query).filter(
          ([, value]) => value !== undefined && value !== "",
        ),
      ) as FeedQuery,
    [query],
  );

  const feed = useInfiniteQuery({
    queryKey: ["feed", clean],
    queryFn: ({ pageParam }) => fetchFeed({ ...clean, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  // The surrounding FeedScrollView reports when the user reaches the bottom;
  // one swipe pages in one batch, with no button to press.
  const { hasNextPage, isFetchingNextPage, isFetching, fetchNextPage } = feed;
  const feedScroll = useFeedScroll();
  useEffect(() => {
    if (!feedScroll || !feedScroll.atEnd) return;
    if (!hasNextPage || isFetchingNextPage || isFetching) return;
    feedScroll.markConsumed();
    void fetchNextPage();
  }, [feedScroll, hasNextPage, isFetchingNextPage, isFetching, fetchNextPage]);

  if (feed.isLoading) {
    return (
      <>
        {leading}
        <View className="items-center py-10">
          <ActivityIndicator color={Colors.primary.DEFAULT} />
        </View>
      </>
    );
  }

  if (feed.isError) {
    return (
      <>
        {leading}
        <View className="items-center px-6 py-10">
          <Text className="text-center text-neutral-text-sub">
            Could not load ads.
          </Text>
          <TouchableOpacity
            onPress={() => feed.refetch()}
            className="mt-3 rounded-lg border border-primary px-5 py-2"
          >
            <Text className="font-bold text-primary">Try again</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  const products = (feed.data?.pages ?? [])
    .flatMap((page) => page.items)
    .map(toCardProduct);

  if (products.length === 0) {
    return (
      <>
        {leading}
        <View className="items-center px-6 py-10">
          <Text className="text-center text-neutral-text-sub">
            {emptyLabel}
          </Text>
        </View>
      </>
    );
  }

  const loadingMore = feed.isFetchingNextPage ? (
    <View className="w-full items-center py-4">
      <ActivityIndicator color={Colors.primary.DEFAULT} />
    </View>
  ) : null;

  if (viewMode === "list") {
    return (
      <View>
        {leading}
        {products.map((product) => (
          <ProductCard key={product.id} product={product} viewMode="list" />
        ))}
        {loadingMore}
      </View>
    );
  }

  return (
    <View className="flex-row flex-wrap px-1">
      {leading}
      {products.map((product) => (
        <ProductCard key={product.id} product={product} viewMode="grid" />
      ))}
      {loadingMore}
    </View>
  );
}

export default ListingFeed;
