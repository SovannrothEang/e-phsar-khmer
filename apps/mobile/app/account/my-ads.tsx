import AccountHeader from "@/components/account/AccountHeader";
import AdsEmptyState from "@/components/account/AdsEmptyState";
import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { fetchMyAds, type MyAdsTab } from "@/lib/api/account";
import { deleteListing, publishListing } from "@/lib/api/listing-form";
import type { ListingDetail } from "@/lib/api/listings";
import { finalPrice, formatListingDate, formatMoney } from "@/lib/listings";
import { Ionicons } from "@expo/vector-icons";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useColorScheme } from "nativewind";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type VisibleTab = Extract<MyAdsTab, "active" | "expired" | "hidden">;

const BASE_TABS: { id: VisibleTab; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "expired", label: "Expired" },
];

const HIDDEN_TAB: { id: VisibleTab; label: string } = {
  id: "hidden",
  label: "Hidden",
};

function normalizeTab(value?: string): VisibleTab {
  return value === "expired" || value === "hidden" ? value : "active";
}

function statusLabel(status: string): string {
  if (status === "expired") return "Expired";
  if (status === "restricted") return "Hidden";
  if (status === "deleted") return "Removed";
  if (status === "draft") return "Draft";
  return "Active";
}

function statusColor(status: string): string {
  if (status === "expired") return "#B45309";
  if (status === "restricted") return "#6B7280";
  if (status === "deleted") return "#B91C1C";
  return "#047857";
}

export default function MyAdsScreen() {
  const params = useLocalSearchParams<{ tab?: string | string[] }>();
  const rawTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const [tab, setTab] = useState<VisibleTab>(normalizeTab(rawTab));
  const [tabParam, setTabParam] = useState(rawTab);
  const [busyId, setBusyId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  // Follow a `?tab=` deep-link change. The tab is derived from the route param,
  // so it is adjusted during render instead of synced from an effect.
  if (rawTab !== tabParam) {
    setTabParam(rawTab);
    setTab(normalizeTab(rawTab));
  }

  const query = useInfiniteQuery({
    queryKey: ["my-ads", tab],
    queryFn: ({ pageParam }) => fetchMyAds(tab, pageParam, 20),
    initialPageParam: 1,
    getNextPageParam: (last, pages) =>
      last.hasMore ? pages.length + 1 : undefined,
  });

  // The reference tabs show both counts; the API only returns one total per
  // tab, so probe each with a one-row page.
  const countsQuery = useQuery({
    queryKey: ["my-ads-counts"],
    queryFn: async () => {
      const [active, expired, hidden] = await Promise.all([
        fetchMyAds("active", 1, 1),
        fetchMyAds("expired", 1, 1),
        fetchMyAds("hidden", 1, 1),
      ]);
      return {
        active: active.total,
        expired: expired.total,
        hidden: hidden.total,
      };
    },
  });
  const counts = countsQuery.data;
  const showHidden = (counts?.hidden ?? 0) > 0 || tab === "hidden";
  const tabs = showHidden ? [...BASE_TABS, HIDDEN_TAB] : BASE_TABS;

  const items = (query.data?.pages ?? []).flatMap((page) => page.items);

  const refreshAll = async (listingId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["my-ads"] }),
      queryClient.invalidateQueries({ queryKey: ["my-ads-counts"] }),
      queryClient.invalidateQueries({ queryKey: ["feed"] }),
      queryClient.invalidateQueries({ queryKey: ["listing", listingId] }),
    ]);
  };

  const handleRenew = (item: ListingDetail) => {
    Alert.alert("Renew ad", `Renew "${item.title}" for another 30 days?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Renew",
        onPress: async () => {
          setBusyId(item.id);
          try {
            await publishListing(item.id);
            await refreshAll(item.id);
            Alert.alert("Renewed", "The ad is live again for 30 days.");
          } catch {
            Alert.alert("Could not renew", "Please try again.");
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const handleDelete = (item: ListingDetail) => {
    Alert.alert("Delete ad", `Delete "${item.title}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setBusyId(item.id);
          try {
            await deleteListing(item.id);
            await refreshAll(item.id);
          } catch {
            Alert.alert("Could not delete", "Please try again.");
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView
      statusBarColor={isDark ? "#111827" : "#FFFFFF"}
      statusBarStyle={isDark ? "light-content" : "dark-content"}
      className="flex-1 bg-neutral-background dark:bg-black"
    >
      <Stack.Screen options={{ headerShown: false }} />
      <AccountHeader title="My ads" />

      <View className="mx-4 mt-3 flex-row overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        {tabs.map((entry, index) => (
          <TouchableOpacity
            key={entry.id}
            onPress={() => setTab(entry.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === entry.id }}
            className={`h-12 flex-1 items-center justify-center ${
              index > 0 ? "border-l border-gray-200 dark:border-gray-800" : ""
            }`}
          >
            <Text
              className={`text-sm ${
                tab === entry.id
                  ? "font-semibold text-primary"
                  : "font-medium text-gray-500 dark:text-gray-400"
              }`}
            >
              {entry.label} ({counts?.[entry.id] ?? 0})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {query.isLoading ? (
          <View className="items-center py-10">
            <ActivityIndicator color={Colors.primary.DEFAULT} />
          </View>
        ) : items.length === 0 ? (
          tab === "expired" ? (
            <Text className="mt-24 text-center text-sm text-gray-400">
              No more result!
            </Text>
          ) : tab === "hidden" ? (
            <Text className="mt-24 text-center text-sm text-gray-400">
              No hidden ads.
            </Text>
          ) : (
            <AdsEmptyState
              message="Oops! You don't have any active ads"
              showSellButton
            />
          )
        ) : (
          items.map((item) => {
            const price = finalPrice(item);
            const busy = busyId === item.id;
            const canRenew =
              item.status === "expired" || item.status === "restricted";

            return (
              <View
                key={item.id}
                className="mx-4 mb-3 rounded-2xl border border-neutral-border bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
              >
                <View className="flex-row items-start justify-between">
                  <TouchableOpacity
                    className="flex-1 pr-3"
                    onPress={() => router.push(`/product/${item.id}` as never)}
                  >
                    <Text
                      className="text-base font-bold text-neutral-text-main dark:text-white"
                      numberOfLines={2}
                    >
                      {item.title}
                    </Text>
                    <Text className="mt-1 text-sm font-semibold text-danger">
                      {price === null ? "Negotiable" : formatMoney(price)}
                    </Text>
                    <Text className="mt-1 text-xs text-neutral-text-sub dark:text-gray-400">
                      {formatListingDate(item.publishedAt ?? item.createdAt)}
                    </Text>
                  </TouchableOpacity>
                  <View
                    className="rounded-full px-2.5 py-1"
                    style={{ backgroundColor: `${statusColor(item.status)}1A` }}
                  >
                    <Text
                      className="text-[11px] font-bold"
                      style={{ color: statusColor(item.status) }}
                    >
                      {statusLabel(item.status)}
                    </Text>
                  </View>
                </View>

                <View className="mt-3 flex-row gap-2 border-t border-neutral-border/60 pt-3 dark:border-gray-800">
                  <TouchableOpacity
                    onPress={() => router.push(`/product/${item.id}` as never)}
                    className="flex-1 items-center rounded-lg border border-neutral-border py-2 dark:border-gray-700"
                  >
                    <Text className="text-xs font-semibold text-neutral-text-main dark:text-gray-200">
                      View
                    </Text>
                  </TouchableOpacity>
                  {canRenew && (
                    <TouchableOpacity
                      onPress={() => handleRenew(item)}
                      disabled={busy}
                      className="flex-1 items-center rounded-lg border border-primary py-2"
                    >
                      <Text className="text-xs font-semibold text-primary">
                        {busy ? "Renewing…" : "Renew"}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => handleDelete(item)}
                    disabled={busy}
                    className="flex-1 items-center rounded-lg border border-red-300 py-2"
                  >
                    <Text className="text-xs font-semibold text-red-600">
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
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

      {/* Floating Sell action, matching the reference */}
      <TouchableOpacity
        onPress={() => router.push("/account/choose-category" as never)}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel="Sell your stuff"
        className="absolute right-5"
        style={{ bottom: insets.bottom + 24 }}
      >
        <View
          className="h-16 w-16 items-center justify-center rounded-full bg-white p-1 dark:bg-gray-900"
          style={{
            elevation: 8,
            shadowColor: "#F97316",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 10,
          }}
        >
          <LinearGradient
            colors={["#FB923C", "#F97316", "#EA580C"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="h-full w-full items-center justify-center rounded-full border border-white/40"
          >
            <View className="items-center justify-center">
              <Ionicons name="camera" size={22} color="white" />
              <View className="absolute -right-1.5 -top-1">
                <Ionicons name="add-circle" size={13} color="white" />
              </View>
              <Text className="mt-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                Sell
              </Text>
            </View>
          </LinearGradient>
        </View>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
