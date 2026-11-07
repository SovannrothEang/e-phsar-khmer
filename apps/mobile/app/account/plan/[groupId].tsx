import AccountHeader from "@/components/account/AccountHeader";
import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import {
  fetchSubscriptionCatalog,
  type SubscriptionCatalogItem,
} from "@/lib/api/subscriptions";
import { discountBadge, finalPrice, money } from "@/lib/subscription-pricing";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const LIMIT_ROWS = [
  { key: "photos", label: "Photos" },
  { key: "ads", label: "Ads" },
  { key: "renews", label: "Renews" },
  { key: "autoRenews", label: "Auto-Renews" },
  { key: "videos", label: "Videos" },
] as const;

export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ groupId?: string | string[] }>();
  const groupId = Array.isArray(params.groupId)
    ? params.groupId[0]
    : params.groupId;
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);

  const catalogQuery = useQuery({
    queryKey: ["subscription-catalog"],
    queryFn: fetchSubscriptionCatalog,
  });

  const items = useMemo(
    () => (catalogQuery.data ?? []).filter((item) => item.groupId === groupId),
    [catalogQuery.data, groupId],
  );
  const groupName = items[0]?.groupName ?? "Plan";

  const packages = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; terms: SubscriptionCatalogItem[] }
    >();
    for (const item of items) {
      const entry = map.get(item.packageId) ?? {
        id: item.packageId,
        name: item.packageName,
        terms: [],
      };
      entry.terms.push(item);
      map.set(item.packageId, entry);
    }
    return [...map.values()];
  }, [items]);

  const allTerms = useMemo(
    () => packages.flatMap((entry) => entry.terms),
    [packages],
  );
  const selected =
    allTerms.find((term) => term.termId === selectedTermId) ?? allTerms[0];

  return (
    <SafeAreaView
      statusBarColor={Colors.primary.DEFAULT}
      statusBarStyle="light-content"
      className="flex-1 bg-neutral-background"
    >
      <AccountHeader title={groupName} variant="blue" showHeadset={false} />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {catalogQuery.isLoading ? (
          <View className="items-center py-16">
            <ActivityIndicator color={Colors.primary.DEFAULT} />
          </View>
        ) : packages.length === 0 ? (
          <View className="items-center px-6 py-16">
            <Text className="text-center text-sm text-gray-500">
              This plan is not available right now.
            </Text>
          </View>
        ) : (
          <View className="px-3 pt-5">
            <Text className="px-1 text-xl font-bold leading-7 text-gray-900 dark:text-white">
              Choose the right plan{"\n"}For your business
            </Text>

            {packages.map((pkg) => {
              const cheapest = pkg.terms.reduce((best, term) =>
                finalPrice(term) < finalPrice(best) ? term : best,
              );
              const isActive = pkg.terms.some(
                (term) => term.termId === selected?.termId,
              );
              return (
                <View
                  key={pkg.id}
                  className={`mt-5 rounded-lg border-2 bg-white p-4 dark:bg-gray-900 ${
                    isActive ? "border-primary" : "border-transparent"
                  }`}
                >
                  <Text className="text-xl font-bold text-gray-900 dark:text-white">
                    {pkg.name}
                  </Text>
                  <Text className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Start from {money(finalPrice(cheapest))}/
                    {cheapest.durationUnit}
                  </Text>

                  <View className="mt-4">
                    {LIMIT_ROWS.map((row) => (
                      <View
                        key={row.key}
                        className="mb-2 flex-row items-center"
                      >
                        <Ionicons
                          name="checkmark-circle-outline"
                          size={18}
                          color="#9CA3AF"
                        />
                        <Text className="ml-2 text-base text-gray-800 dark:text-gray-200">
                          {row.label} {cheapest[row.key]}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <Text className="mt-4 text-sm font-medium text-gray-400">
                    Terms:
                  </Text>
                  <View className="mt-2 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                    {pkg.terms.map((term) => {
                      const selectedTerm = term.termId === selected?.termId;
                      const badge = discountBadge(term);
                      const net = finalPrice(term);
                      return (
                        <TouchableOpacity
                          key={term.termId}
                          activeOpacity={0.7}
                          onPress={() => setSelectedTermId(term.termId)}
                          className="flex-row items-center border-b border-gray-200 px-3 py-4 last:border-b-0 dark:border-gray-700"
                        >
                          {selectedTerm ? (
                            <View className="h-5 w-5 items-center justify-center rounded-full bg-primary">
                              <Ionicons
                                name="checkmark"
                                size={13}
                                color="white"
                              />
                            </View>
                          ) : (
                            <View className="h-5 w-5 rounded-full border border-gray-400" />
                          )}
                          <Text className="ml-3 text-base font-bold text-gray-900 dark:text-white">
                            {term.termName}
                          </Text>
                          {badge ? (
                            <View className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 dark:bg-rose-950">
                              <Text className="text-xs font-semibold text-rose-500">
                                {badge}
                              </Text>
                            </View>
                          ) : null}
                          <View className="ml-auto flex-row items-center">
                            {net < Number(term.price) ? (
                              <Text className="mr-2 text-sm text-gray-400 line-through">
                                {money(Number(term.price))}
                              </Text>
                            ) : null}
                            <Text className="text-base font-semibold text-primary">
                              {money(net)}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {selected ? (
        <View
          className="border-t border-gray-200 bg-white px-4 pt-3 dark:border-gray-800 dark:bg-gray-950"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <View className="mb-3 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Text className="text-base font-semibold text-gray-900 dark:text-white">
                {selected.packageName}: {selected.termName}
              </Text>
              {discountBadge(selected) ? (
                <View className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 dark:bg-rose-950">
                  <Text className="text-xs font-semibold text-rose-500">
                    {discountBadge(selected)}
                  </Text>
                </View>
              ) : null}
            </View>
            <View className="flex-row items-center">
              {finalPrice(selected) < Number(selected.price) ? (
                <Text className="mr-2 text-sm text-gray-400 line-through">
                  {money(Number(selected.price))}
                </Text>
              ) : null}
              <Text className="text-lg font-bold text-gray-900 dark:text-white">
                {money(finalPrice(selected))}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() =>
              router.push(
                `/account/checkout?termId=${encodeURIComponent(
                  selected.termId,
                )}` as never,
              )
            }
            className="h-12 items-center justify-center rounded-md bg-secondary-orange"
          >
            <Text className="text-base font-bold text-white">
              Subscribe Now
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
