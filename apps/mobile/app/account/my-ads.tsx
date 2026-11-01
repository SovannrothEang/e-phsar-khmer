import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { deleteListing, publishListing } from "@/lib/api/listing-form";
import { fetchMyAds, type MyAdsTab } from "@/lib/api/account";
import type { ListingDetail } from "@/lib/api/listings";
import { finalPrice, formatListingDate, formatMoney } from "@/lib/listings";
import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const TABS: { id: MyAdsTab; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "expired", label: "Expired" },
  { id: "hidden", label: "Hidden" },
  { id: "all", label: "All" },
];

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
  const initialTab: MyAdsTab =
    rawTab === "expired" || rawTab === "hidden" || rawTab === "all"
      ? rawTab
      : "active";
  const [tab, setTab] = useState<MyAdsTab>(initialTab);
  const [busyId, setBusyId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: ["my-ads", tab],
    queryFn: ({ pageParam }) => fetchMyAds(tab, pageParam, 20),
    initialPageParam: 1,
    getNextPageParam: (last, pages) =>
      last.hasMore ? pages.length + 1 : undefined,
  });

  const items = (query.data?.pages ?? []).flatMap((page) => page.items);

  const refreshAll = async (listingId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["my-ads"] }),
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
    <SafeAreaView className="flex-1 bg-neutral-background">
      <Stack.Screen options={{ headerShown: false }} />

      <View className="flex-row items-center justify-between bg-primary px-4 py-4">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-white">Manage Ads</Text>
        <View className="w-6" />
      </View>

      <View className="flex-row gap-2 bg-white px-4 py-3">
        {TABS.map((entry) => (
          <TouchableOpacity
            key={entry.id}
            onPress={() => setTab(entry.id)}
            className={`flex-1 items-center rounded-full py-2 ${
              tab === entry.id ? "bg-primary" : "bg-neutral-background"
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                tab === entry.id ? "text-white" : "text-neutral-text-sub"
              }`}
            >
              {entry.label}
            </Text>
          </TouchableOpacity>
        ))}
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
        ) : items.length === 0 ? (
          <View className="items-center px-6 py-12">
            <Ionicons name="documents-outline" size={40} color="#9CA3AF" />
            <Text className="mt-3 text-neutral-text-sub">No ads here yet.</Text>
          </View>
        ) : (
          items.map((item) => {
            const price = finalPrice(item);
            const busy = busyId === item.id;
            const canRenew =
              item.status === "expired" || item.status === "restricted";

            return (
              <View
                key={item.id}
                className="mx-4 mb-3 rounded-2xl border border-neutral-border bg-white p-4"
              >
                <View className="flex-row items-start justify-between">
                  <TouchableOpacity
                    className="flex-1 pr-3"
                    onPress={() => router.push(`/product/${item.id}` as never)}
                  >
                    <Text
                      className="text-base font-bold text-neutral-text-main"
                      numberOfLines={2}
                    >
                      {item.title}
                    </Text>
                    <Text className="mt-1 text-sm font-semibold text-danger">
                      {price === null ? "Negotiable" : formatMoney(price)}
                    </Text>
                    <Text className="mt-1 text-xs text-neutral-text-sub">
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

                <View className="mt-3 flex-row gap-2 border-t border-neutral-border/60 pt-3">
                  <TouchableOpacity
                    onPress={() => router.push(`/product/${item.id}` as never)}
                    className="flex-1 items-center rounded-lg border border-neutral-border py-2"
                  >
                    <Text className="text-xs font-semibold text-neutral-text-main">
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
    </SafeAreaView>
  );
}
