import ProductCard from "@/components/product/ProductCard";
import { Colors } from "@/constants/Colors";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { fetchNearby } from "@/lib/api/listings";
import { toCardProduct } from "@/lib/listing-card";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const NEARBY_RADIUS_KM = 10;
const NEARBY_LIMIT = 8;

/**
 * "Nearby" block: a light-blue section between gray bands. Until the device
 * grants foreground location it keeps the original map card and prompt; once
 * a fix is available it lists the nearest live ads, nearest first.
 */
const NearbySection = () => {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const { permission, coords, request, refresh, openSettings } =
    useCurrentLocation();

  const nearbyQuery = useQuery({
    queryKey: [
      "listings",
      "nearby",
      coords ? coords.lat.toFixed(3) : null,
      coords ? coords.lng.toFixed(3) : null,
    ],
    queryFn: () =>
      fetchNearby({
        lat: coords!.lat,
        lng: coords!.lng,
        radiusKm: NEARBY_RADIUS_KM,
        limit: NEARBY_LIMIT,
      }),
    enabled: permission === "granted" && !!coords,
    staleTime: 5 * 60_000,
  });

  const products = (nearbyQuery.data ?? []).map(toCardProduct);
  const hasFix = permission === "granted" && !!coords;

  const renderMapCard = (
    message: string,
    actionLabel: string,
    onPress: () => void,
    busy = false,
  ) => (
    <View className="overflow-hidden rounded-xl bg-white dark:bg-gray-800">
      <View style={{ height: 240 }} className="items-center justify-center">
        <Image
          source={require("@/assets/images/map_placeholder.png")}
          className="absolute h-full w-full"
          resizeMode="cover"
        />
        <View className="items-center px-6">
          <View className="h-24 w-24 items-center justify-center rounded-full bg-sky-400/25">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-sky-500 shadow-md">
              <Ionicons name="navigate" size={30} color="white" />
            </View>
          </View>

          <Text className="mt-4 text-center text-base leading-6 text-gray-700 dark:text-gray-200">
            {message}
          </Text>

          <TouchableOpacity
            activeOpacity={0.8}
            disabled={busy}
            onPress={onPress}
            className="mt-4 rounded-lg bg-[#DCEEF8] px-6 py-3"
          >
            {busy ? (
              <ActivityIndicator color={Colors.primary.DEFAULT} />
            ) : (
              <Text className="text-base font-semibold text-sky-600">
                {actionLabel}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderBody = () => {
    if (hasFix) {
      if (nearbyQuery.isPending) {
        return (
          <View className="items-center py-16">
            <ActivityIndicator color={Colors.primary.DEFAULT} />
          </View>
        );
      }

      if (nearbyQuery.isError) {
        return renderMapCard(
          t("nearbyError"),
          t("nearbyRetry"),
          () => void nearbyQuery.refetch(),
        );
      }

      if (products.length === 0) {
        return renderMapCard(
          t("nearbyEmpty"),
          t("nearbyRetry"),
          () => void nearbyQuery.refetch(),
        );
      }

      return (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 4, gap: 8 }}
          className="mt-1"
        >
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              viewMode="grid"
              fixedWidth={170}
            />
          ))}
        </ScrollView>
      );
    }

    if (permission === "requesting" || (permission === "granted" && !coords)) {
      return renderMapCard(t("nearbyPrompt"), t("nearbyAllow"), () => {}, true);
    }

    if (permission === "blocked") {
      return renderMapCard(
        t("nearbyBlocked"),
        t("nearbyOpenSettings"),
        openSettings,
      );
    }

    if (permission === "denied") {
      return renderMapCard(
        t("nearbyDenied"),
        t("nearbyRetry"),
        () => void request(),
      );
    }

    if (permission === "error") {
      return renderMapCard(
        t("nearbyError"),
        t("nearbyRetry"),
        () => void refresh(),
      );
    }

    return renderMapCard(
      t("nearbyPrompt"),
      t("nearbyAllow"),
      () => void request(),
    );
  };

  return (
    <View className="bg-neutral-border py-3 dark:bg-gray-950">
      <View className="bg-[#E6F4FB] px-4 pb-5 pt-5 dark:bg-gray-900">
        <View className="mb-3 flex-row items-center gap-2">
          <View className="h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-gray-800">
            <Ionicons
              name="navigate"
              size={18}
              color={isDark ? "#F9FAFB" : "#111827"}
            />
          </View>
          <Text className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            {t("nearbyTitle")}
          </Text>
        </View>

        {renderBody()}
      </View>
    </View>
  );
};

export default NearbySection;
