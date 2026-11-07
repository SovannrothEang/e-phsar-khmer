import AccountHeader from "@/components/account/AccountHeader";
import SafeAreaView from "@/components/common/SafeAreaView";
import SelectionSheet from "@/components/common/SelectionSheet";
import { Colors } from "@/constants/Colors";
import {
  fetchMySubscriptions,
  type MySubscription,
  type SubscriptionStatus,
} from "@/lib/api/subscriptions";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const STATUS_META: Record<SubscriptionStatus, { label: string; chip: string }> =
  {
    active: { label: "Active", chip: "bg-emerald-100 text-emerald-700" },
    expired: { label: "Expired", chip: "bg-gray-100 text-gray-500" },
    superseded: { label: "Upgraded", chip: "bg-gray-100 text-gray-500" },
    revoked: { label: "Revoked", chip: "bg-red-100 text-red-600" },
  };

type SheetKind = "status" | "type" | "sort" | null;

/** "Nearly expire" = an active subscription ending within a week. */
const NEARLY_EXPIRE_MS = 7 * 24 * 60 * 60 * 1000;

export default function SubscriptionListScreen() {
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [sort, setSort] = useState("newest");
  const [sheet, setSheet] = useState<SheetKind>(null);
  // The "nearly expire" cut-off is evaluated once per screen visit; keeping the
  // timestamp in state keeps Date.now() out of the render path.
  const [now] = useState(() => Date.now());

  const subscriptionsQuery = useQuery({
    queryKey: ["my-subscriptions"],
    queryFn: fetchMySubscriptions,
  });

  const rows = useMemo(
    () => subscriptionsQuery.data ?? [],
    [subscriptionsQuery.data],
  );

  const filtered = useMemo(() => {
    return rows
      .filter((row) => {
        if (statusFilter === "expired") return row.status === "expired";
        if (statusFilter === "nearly") {
          return (
            row.status === "active" &&
            new Date(row.expiresAt).getTime() - now <= NEARLY_EXPIRE_MS
          );
        }
        return true;
      })
      .filter((row) => {
        // Our packages are ad packages; Account/Addons have no products yet.
        if (typeFilter === "ads") return true;
        return typeFilter === "";
      })
      .sort((a, b) => {
        switch (sort) {
          case "oldest":
            return a.subscribedAt.localeCompare(b.subscribedAt);
          case "furthest":
            return b.expiresAt.localeCompare(a.expiresAt);
          case "expiring":
            return a.expiresAt.localeCompare(b.expiresAt);
          case "price_desc":
            return Number(b.priceUsd) - Number(a.priceUsd);
          case "price_asc":
            return Number(a.priceUsd) - Number(b.priceUsd);
          default:
            return b.subscribedAt.localeCompare(a.subscribedAt);
        }
      });
  }, [rows, statusFilter, typeFilter, sort, now]);

  const groups = (["active", "expired", "superseded", "revoked"] as const)
    .map((status) => ({
      status,
      items: filtered.filter((item) => item.status === status),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <SafeAreaView
      statusBarColor={Colors.primary.DEFAULT}
      statusBarStyle="light-content"
      className="flex-1 bg-neutral-background"
    >
      <AccountHeader title="Subscription" variant="blue" showHeadset={false} />

      {/* Filter toolbar */}
      <View className="flex-row items-center justify-around border-b border-gray-100 bg-white px-2 py-3 dark:border-gray-800 dark:bg-gray-900">
        <TouchableOpacity
          onPress={() => setSheet("status")}
          className="flex-row items-center gap-1.5"
          activeOpacity={0.7}
        >
          <Ionicons name="time-outline" size={20} color="#111827" />
          <Text className="text-base font-semibold text-gray-900 dark:text-white">
            Status
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSheet("type")}
          className="flex-row items-center gap-1.5"
          activeOpacity={0.7}
        >
          <Ionicons name="grid-outline" size={20} color="#111827" />
          <Text className="text-base font-semibold text-gray-900 dark:text-white">
            Type
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSheet("sort")}
          className="flex-row items-center gap-1.5"
          activeOpacity={0.7}
        >
          <Ionicons name="swap-vertical" size={20} color="#111827" />
          <Text className="text-base font-semibold text-gray-900 dark:text-white">
            Sort
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {subscriptionsQuery.isLoading ? (
          <View className="items-center py-16">
            <ActivityIndicator color={Colors.primary.DEFAULT} />
          </View>
        ) : filtered.length === 0 ? (
          <Text className="py-16 text-center text-base text-gray-400">
            No Result!
          </Text>
        ) : (
          <>
            {groups.map((group) => (
              <View key={group.status} className="pt-4">
                <Text className="px-4 pb-2 text-base font-bold text-gray-500">
                  {STATUS_META[group.status].label}
                </Text>
                {group.items.map((item) => (
                  <SubscriptionCard key={item.id} item={item} />
                ))}
              </View>
            ))}
            <Text className="py-6 text-center text-base text-gray-400">
              No more result!
            </Text>
          </>
        )}
      </ScrollView>

      <SelectionSheet
        visible={sheet === "status"}
        title="Status"
        options={[
          { id: "expired", name: "Expired" },
          { id: "nearly", name: "Nearly expire" },
        ]}
        value={statusFilter}
        onSelect={(option) => {
          setStatusFilter(option.id);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
        searchable={false}
        compact
      />

      <SelectionSheet
        visible={sheet === "type"}
        title="Type"
        options={[
          { id: "ads", name: "Ads" },
          { id: "account", name: "Account" },
          { id: "addons", name: "Addons" },
        ]}
        value={typeFilter}
        onSelect={(option) => {
          setTypeFilter(option.id);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
        searchable={false}
        compact
      />

      <SelectionSheet
        visible={sheet === "sort"}
        title="Sort"
        options={[
          { id: "newest", name: "Newest subscriptions" },
          { id: "oldest", name: "Oldest Subscriptions" },
          { id: "furthest", name: "Furthest Expiration" },
          { id: "expiring", name: "Next to Expire / Renew" },
          { id: "price_desc", name: "Price descending" },
          { id: "price_asc", name: "Price ascending" },
        ]}
        value={sort}
        onSelect={(option) => {
          setSort(option.id);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
        searchable={false}
        compact
      />
    </SafeAreaView>
  );
}

function SubscriptionCard({ item }: { item: MySubscription }) {
  const meta = STATUS_META[item.status];
  const title = `${item.groupName ?? "Service"}: ${item.packageName ?? "Plan"}${
    item.termName ? ` - ${item.termName}` : ""
  }`;
  const accountId = item.id.slice(0, 8).toUpperCase();
  const canRenew = item.status === "expired" || item.status === "revoked";

  return (
    <View className="mx-4 mb-3 rounded-lg bg-white p-4 dark:bg-gray-900">
      <View className="flex-row">
        <View className="mr-3 h-14 w-14 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
          <Ionicons name="person-outline" size={26} color="#9CA3AF" />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text
              className="flex-1 text-base font-semibold text-gray-900 dark:text-white"
              numberOfLines={1}
            >
              {title}
            </Text>
            <View className={`rounded px-1.5 py-0.5 ${meta.chip}`}>
              <Text className="text-xs font-medium">{meta.label}</Text>
            </View>
          </View>
          <Text className="mt-1 text-sm text-gray-500">
            Account ID: {accountId} · ${Number(item.priceUsd)}
          </Text>
        </View>
      </View>

      {canRenew ? (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push("/account/plans" as never)}
          className="mt-3 h-10 items-center justify-center rounded-md bg-[#DCEEF8]"
        >
          <Text className="text-base font-semibold text-primary">Renew</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
