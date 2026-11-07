import { AppFooterDeviceInfo } from "@/components/common/AppFooterDeviceInfo";
import ProductCard from "@/components/product/ProductCard";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/contexts/AuthContext";
import { fetchFeed } from "@/lib/api/feed";
import { toCardProduct } from "@/lib/listing-card";
import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useIsFocused, useRouter } from "expo-router";
import { useColorScheme } from "nativewind";
import type { ComponentProps } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

const AccountScreen = () => {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const displayName =
    user.name && user.name !== "DATA" && user.name !== "015455758"
      ? user.name
      : "Ban Sreypov";
  const displayUsername =
    user.username && user.username !== "data" && user.username !== "015455758"
      ? user.username
      : "bansreypov";

  const openEditProfile = () => router.push("/(auth)/edit-profile" as never);

  const highlightsQuery = useInfiniteQuery({
    queryKey: ["account-highlights"],
    queryFn: ({ pageParam }) => fetchFeed({ limit: 8, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  // Flatten every loaded page — the section keeps loading as the page scrolls.
  const highlights = (highlightsQuery.data?.pages ?? [])
    .flatMap((page) => page.items)
    .map(toCardProduct);

  const handleHighlightsScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const nearBottom =
      contentOffset.y + layoutMeasurement.height >= contentSize.height - 300;
    if (
      nearBottom &&
      highlightsQuery.hasNextPage &&
      !highlightsQuery.isFetchingNextPage
    ) {
      void highlightsQuery.fetchNextPage();
    }
  };

  const services: {
    label: string;
    icon: IoniconName;
    onPress: () => void;
  }[] = [
    {
      label: "Subscription",
      icon: "receipt-outline",
      onPress: () => router.push("/account/subscription" as never),
    },
    {
      label: "Likes",
      icon: "heart-outline",
      onPress: () => router.push("/account/reactions?kind=likes" as never),
    },
    {
      label: "Saves",
      icon: "bookmark-outline",
      onPress: () => router.push("/account/reactions?kind=saves" as never),
    },
    {
      label: "Jobs",
      icon: "briefcase-outline",
      onPress: () => router.push("/account/jobs" as never),
    },
    {
      label: "Resume (CV)",
      icon: "id-card-outline",
      onPress: () => router.push("/account/resume" as never),
    },
    {
      label: "Insights",
      icon: "trending-up-outline",
      onPress: () => router.push("/account/insights" as never),
    },
  ];

  return (
    <View className="flex-1 bg-primary">
      {isFocused ? <StatusBar barStyle="light-content" /> : null}

      {/* Fixed compact header — stays while the profile block scrolls away */}
      <View className="z-20 bg-primary" style={{ paddingTop: insets.top }}>
        <View className="h-12 flex-row items-center justify-between px-4">
          <View className="flex-1 flex-row items-center gap-3">
            {isAuthenticated ? (
              <>
                <TouchableOpacity
                  onPress={() => router.push("/scan")}
                  className="p-1"
                  accessibilityRole="button"
                  accessibilityLabel="Scan QR code"
                >
                  <Ionicons name="qr-code-outline" size={24} color="white" />
                </TouchableOpacity>
                <Text
                  className="flex-1 text-2xl font-bold tracking-tight text-white"
                  numberOfLines={1}
                >
                  @{displayUsername}
                </Text>
              </>
            ) : (
              <Text className="text-2xl font-extrabold tracking-tight text-white">
                PhsarKhmer
              </Text>
            )}
          </View>

          <View className="flex-row items-center gap-4">
            <TouchableOpacity
              onPress={() => router.push("/(auth)/contact-us")}
              className="p-1"
              accessibilityRole="button"
              accessibilityLabel="Contact support"
            >
              <Ionicons name="headset-outline" size={24} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/(auth)/settings")}
              className="p-1"
              accessibilityRole="button"
              accessibilityLabel="Settings"
            >
              <Ionicons name="settings-outline" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleHighlightsScroll}
      >
        {/* Profile block — scrolls under the fixed header */}
        <View className="relative bg-primary">
          {user.coverPhoto ? (
            <Image
              source={{ uri: user.coverPhoto }}
              blurRadius={18}
              resizeMode="cover"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: -40,
              }}
            />
          ) : null}
          {user.coverPhoto ? (
            <LinearGradient
              colors={[
                "rgba(2, 6, 23, 0.55)",
                "rgba(2, 6, 23, 0.12)",
                "rgba(2, 6, 23, 0.45)",
              ]}
              locations={[0, 0.45, 1]}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: -40,
              }}
            />
          ) : null}

          <View className="px-4 pb-5 pt-2">
            {isAuthenticated ? (
              <>
                <View className="mt-2 items-center">
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={openEditProfile}
                    className="h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-white"
                    accessibilityRole="button"
                    accessibilityLabel="Edit profile photo"
                  >
                    {user.avatar ? (
                      <Image
                        source={{ uri: user.avatar }}
                        className="h-full w-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <Ionicons name="person" size={54} color="#9CA3AF" />
                    )}
                  </TouchableOpacity>
                  <Text className="mt-3 text-xl font-bold text-white">
                    {displayName}
                  </Text>
                  <Text className="mt-1 text-sm font-medium text-white/90">
                    {user.accountType || "Normal account"}
                  </Text>
                </View>

                <View className="mt-1 flex-row justify-end">
                  <TouchableOpacity
                    onPress={openEditProfile}
                    className="p-1"
                    accessibilityRole="button"
                    accessibilityLabel="Change cover photo"
                  >
                    <Ionicons name="camera-outline" size={22} color="white" />
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
        </View>
        <View className="flex-1 rounded-t-3xl bg-neutral-background pt-3 dark:bg-black">
          {isAuthenticated ? (
            <View className="pb-10">
              {/* Upgrade to Business Account */}
              <View className="mx-4 mt-1">
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => router.push("/account/membership" as never)}
                  className="overflow-hidden rounded-2xl"
                >
                  <LinearGradient
                    colors={["#4F46E5", "#7C3AED"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    className="h-12 flex-row items-center justify-between px-4"
                  >
                    <Text className="text-sm font-bold text-white">
                      Upgrade to Business Account
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color="white" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {/* "My ads" Card */}
              <View className="mx-4 mt-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                <View className="mb-4 flex-row items-center justify-between">
                  <Text className="text-base font-bold text-gray-900 dark:text-white">
                    My ads
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push("/account/my-ads" as never)}
                  >
                    <Text className="text-xs font-semibold text-gray-400">
                      View All &gt;
                    </Text>
                  </TouchableOpacity>
                </View>

                <View className="flex-row justify-around">
                  {/* Post Ad */}
                  <TouchableOpacity
                    onPress={() =>
                      router.push("/account/choose-category" as never)
                    }
                    className="flex-1 items-center"
                  >
                    <View className="relative mb-2">
                      <Ionicons
                        name="camera-outline"
                        size={28}
                        color="#6366F1"
                      />
                      <View className="absolute -right-2 -top-1">
                        <Ionicons name="add-circle" size={14} color="#6366F1" />
                      </View>
                    </View>
                    <Text className="text-center text-xs font-medium text-gray-800 dark:text-gray-200">
                      Post Ad
                    </Text>
                  </TouchableOpacity>

                  {/* Active ads */}
                  <TouchableOpacity
                    onPress={() =>
                      router.push("/account/my-ads?tab=active" as never)
                    }
                    className="flex-1 items-center"
                  >
                    <View className="relative mb-2">
                      <Ionicons
                        name="document-text-outline"
                        size={28}
                        color="#6366F1"
                      />
                      <View className="absolute -bottom-1 -right-1">
                        <Ionicons
                          name="checkmark-circle"
                          size={13}
                          color="#6366F1"
                        />
                      </View>
                    </View>
                    <Text className="text-center text-xs font-medium text-gray-800 dark:text-gray-200">
                      Active ads
                    </Text>
                  </TouchableOpacity>

                  {/* Expired ads */}
                  <TouchableOpacity
                    onPress={() =>
                      router.push("/account/my-ads?tab=expired" as never)
                    }
                    className="flex-1 items-center"
                  >
                    <View className="mb-2">
                      <Ionicons name="ban-outline" size={28} color="#6366F1" />
                    </View>
                    <Text className="text-center text-xs font-medium text-gray-800 dark:text-gray-200">
                      Expired ads
                    </Text>
                  </TouchableOpacity>

                  {/* Top ads */}
                  <TouchableOpacity
                    onPress={() => router.push("/account/top-ads" as never)}
                    className="flex-1 items-center"
                  >
                    <View className="mb-2">
                      <Ionicons
                        name="ribbon-outline"
                        size={28}
                        color="#6366F1"
                      />
                    </View>
                    <Text className="text-center text-xs font-medium text-gray-800 dark:text-gray-200">
                      Top ads
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Features & Services Grid Card */}
              <View className="mx-4 mt-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                <View className="flex-row flex-wrap">
                  {services.map((entry) => (
                    <TouchableOpacity
                      key={entry.label}
                      className="mb-5 w-1/4 items-center"
                      onPress={entry.onPress}
                    >
                      <Ionicons
                        name={entry.icon}
                        size={26}
                        color={isDark ? "#D1D5DB" : "#374151"}
                      />
                      <Text className="mt-1 text-center text-xs font-medium text-gray-800 dark:text-gray-200">
                        {entry.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Marketplace highlights — random listings, like the reference */}
              {highlights.length > 0 ? (
                <View className="mt-5 bg-white px-4 pb-2 pt-4 dark:bg-gray-900">
                  <Text className="mb-2 text-lg font-bold text-gray-900 dark:text-white">
                    Marketplace highlights
                  </Text>
                  <View className="-mx-1.5 flex-row flex-wrap">
                    {highlights.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        viewMode="grid"
                      />
                    ))}
                  </View>
                  {highlightsQuery.isFetchingNextPage ? (
                    <View className="items-center py-3">
                      <ActivityIndicator color={Colors.primary.DEFAULT} />
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : (
            /* ================= SIGNED-OUT PROMPT ================= */
            <View className="items-center px-6 pt-10 pb-12">
              <Ionicons
                name="person-circle-outline"
                size={72}
                color={Colors.text.muted}
              />
              <Text className="mt-4 text-center text-lg font-bold text-neutral-text-main dark:text-white">
                Sign in to PhsarKhmer
              </Text>
              <Text className="mt-2 text-center text-sm leading-6 text-neutral-text-sub dark:text-gray-400">
                Log in or create an account to manage your ads, saved posts and
                messages.
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/(auth)/welcome")}
                activeOpacity={0.85}
                accessibilityRole="button"
                className="mt-6 h-12 w-full items-center justify-center rounded-lg bg-secondary-orange shadow-xs"
              >
                <Text className="text-base font-bold text-white">
                  Login or Register
                </Text>
              </TouchableOpacity>

              <AppFooterDeviceInfo className="mt-10 items-center" />
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default AccountScreen;
