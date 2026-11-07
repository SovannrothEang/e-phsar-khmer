import AccountHeader from "@/components/account/AccountHeader";
import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { fetchFreePlan } from "@/lib/api/subscriptions";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Zero reads as "None", like an unavailable feature (matches the web). */
const amount = (value: number) => (value > 0 ? String(value) : "None");

export default function MembershipScreen() {
  const insets = useSafeAreaInsets();
  const freeQuery = useQuery({
    queryKey: ["free-plan"],
    queryFn: fetchFreePlan,
  });
  const plan = freeQuery.data;

  const rows = plan
    ? [
        { label: "Photos", value: amount(plan.photos) },
        { label: "Videos", value: amount(plan.videos) },
        ...plan.caps.map((cap) => ({
          label: cap.name,
          value: amount(cap.ads),
        })),
        { label: "Other Ads", value: amount(plan.otherAds) },
        { label: "Renews", value: amount(plan.renews) },
        { label: "Auto-Renews", value: amount(plan.autoRenews) },
      ]
    : [];

  return (
    <SafeAreaView
      statusBarColor={Colors.primary.DEFAULT}
      statusBarStyle="light-content"
      className="flex-1 bg-neutral-background"
    >
      <AccountHeader title="Normal" variant="blue" showHeadset={false} />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View className="p-3">
          <View className="overflow-hidden rounded-lg border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
            <Text className="py-4 text-center text-lg font-semibold text-gray-900 dark:text-white">
              Free
            </Text>
            {freeQuery.isLoading ? (
              <View className="items-center py-8">
                <ActivityIndicator color={Colors.primary.DEFAULT} />
              </View>
            ) : (
              rows.map((row) => (
                <View
                  key={row.label}
                  className="flex-row items-center justify-between border-t border-gray-100 px-4 py-4 dark:border-gray-800"
                >
                  <Text className="text-base text-gray-800 dark:text-gray-200">
                    {row.label}
                  </Text>
                  <Text className="text-base text-gray-600 dark:text-gray-400">
                    {row.value}
                  </Text>
                </View>
              ))
            )}
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push("/account/plans")}
            className="mt-3 flex-row items-center rounded-lg border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
          >
            <View className="flex-1">
              <Text className="text-lg font-bold text-gray-900 dark:text-white">
                Need More?
              </Text>
              <Text className="mt-1 text-sm leading-5 text-gray-500 dark:text-gray-400">
                Upgrade to the right plan that better suits your business.
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={22}
              color={Colors.primary.DEFAULT}
            />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View
        className="bg-white px-3 pt-3 dark:bg-gray-950"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => router.push("/account/plans")}
          className="h-12 items-center justify-center rounded-md bg-primary"
        >
          <Text className="text-base font-bold text-white">
            Upgrade Account
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
