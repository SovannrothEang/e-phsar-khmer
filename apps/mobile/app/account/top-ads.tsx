import AccountHeader from "@/components/account/AccountHeader";
import AdsEmptyState from "@/components/account/AdsEmptyState";
import SafeAreaView from "@/components/common/SafeAreaView";
import { Stack } from "expo-router";
import { useColorScheme } from "nativewind";
import { View } from "react-native";

export default function TopAdsScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <SafeAreaView
      statusBarColor={isDark ? "#111827" : "#FFFFFF"}
      statusBarStyle={isDark ? "light-content" : "dark-content"}
      className="flex-1 bg-neutral-background dark:bg-black"
    >
      <Stack.Screen options={{ headerShown: false }} />
      <AccountHeader title="Top ads" />
      {/* Paid placement is not built yet; the screen matches the reference's
          empty state until the backend exposes top/promoted ads. */}
      <View className="flex-1">
        <AdsEmptyState
          message="Oops! You don't have any active ads"
          showSellButton
        />
      </View>
    </SafeAreaView>
  );
}
