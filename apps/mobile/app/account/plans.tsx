import AccountHeader from "@/components/account/AccountHeader";
import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import {
  fetchSubscriptionCatalog,
  type SubscriptionCatalogItem,
} from "@/lib/api/subscriptions";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function PlansScreen() {
  const catalogQuery = useQuery({
    queryKey: ["subscription-catalog"],
    queryFn: fetchSubscriptionCatalog,
  });

  const groups = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        description: string | null;
        items: SubscriptionCatalogItem[];
      }
    >();
    for (const item of catalogQuery.data ?? []) {
      const group = map.get(item.groupId) ?? {
        id: item.groupId,
        name: item.groupName,
        description: item.groupDescription,
        items: [],
      };
      group.items.push(item);
      map.set(item.groupId, group);
    }
    return [...map.values()];
  }, [catalogQuery.data]);

  return (
    <SafeAreaView
      statusBarColor={Colors.primary.DEFAULT}
      statusBarStyle="light-content"
      className="flex-1 bg-neutral-background"
    >
      <AccountHeader title="Premium plan" variant="blue" showHeadset={false} />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View className="px-4 pb-2 pt-5">
          <Text className="text-xl font-bold leading-7 text-gray-900 dark:text-white">
            Increase your sales with PhsarKhmer Premium Services!
          </Text>
          <Text className="mt-2 text-sm leading-5 text-gray-500 dark:text-gray-400">
            Choose the right category for your ads and start selling faster.
          </Text>
        </View>

        {catalogQuery.isLoading ? (
          <View className="items-center py-12">
            <ActivityIndicator color={Colors.primary.DEFAULT} />
          </View>
        ) : groups.length === 0 ? (
          <View className="items-center px-6 py-12">
            <Text className="text-center text-sm text-gray-500">
              No plans are available right now.
            </Text>
          </View>
        ) : (
          <View className="px-3 pt-3">
            {groups.map((group) => (
              <View
                key={group.id}
                className="mb-3 rounded-lg border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
              >
                <Text className="text-lg font-bold text-gray-900 dark:text-white">
                  {group.name}
                </Text>
                {group.description ? (
                  <Text className="mt-1 text-sm leading-5 text-gray-500 dark:text-gray-400">
                    {group.description}
                  </Text>
                ) : null}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() =>
                    router.push(`/account/plan/${group.id}` as never)
                  }
                  className="mt-3 flex-row items-center gap-1 self-start"
                >
                  <Text className="text-base font-medium text-primary">
                    Subscribe
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={Colors.primary.DEFAULT}
                  />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
