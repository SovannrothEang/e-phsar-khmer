import AccountHeader from "@/components/account/AccountHeader";
import SafeAreaView from "@/components/common/SafeAreaView";
import ProductSpecBody from "@/components/product/ProductSpecBody";
import { Colors } from "@/constants/Colors";
import { useLanguage } from "@/contexts/LanguageContext";
import { ApiError } from "@/lib/api/client";
import { fetchProductSpec } from "@/lib/api/products";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

function paramValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Public trusted product specification attached to a post. Mirrors web's
 * `/product/[brand]/[model]` page: the same groups, fold rule and fuel chip,
 * with mobile-only 404, retry and empty states.
 */
export default function ProductSpecScreen() {
  const params = useLocalSearchParams<{
    brand?: string | string[];
    model?: string | string[];
  }>();
  const brandSlug = paramValue(params.brand);
  const modelSlug = paramValue(params.model);
  const { t } = useLanguage();

  const specQuery = useQuery({
    queryKey: ["product-spec", brandSlug, modelSlug],
    queryFn: () => fetchProductSpec(brandSlug as string, modelSlug as string),
    enabled: !!brandSlug && !!modelSlug,
    staleTime: 5 * 60_000,
  });

  const product = specQuery.data;
  const notFound =
    specQuery.error instanceof ApiError && specQuery.error.status === 404;

  const renderBody = () => {
    if (specQuery.isPending) {
      return (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={Colors.primary.DEFAULT} />
          <Text className="mt-3 text-neutral-text-sub dark:text-gray-400">
            {t("specsLoading")}
          </Text>
        </View>
      );
    }

    if (!product) {
      return (
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons
            name={notFound ? "document-text-outline" : "cloud-offline-outline"}
            size={44}
            color={Colors.text.muted}
          />
          <Text className="mt-3 text-center text-base text-neutral-text-sub dark:text-gray-400">
            {notFound ? t("productNotFound") : t("specsLoadError")}
          </Text>
          <TouchableOpacity
            onPress={() => (notFound ? router.back() : specQuery.refetch())}
            className="mt-4 rounded-lg bg-primary px-6 py-2.5"
            accessibilityRole="button"
          >
            <Text className="font-semibold text-white">
              {notFound ? t("goBack") : t("retry")}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <ProductSpecBody product={product} />
      </ScrollView>
    );
  };

  return (
    <SafeAreaView
      className="bg-neutral-background dark:bg-gray-950"
      statusBarColor={Colors.primary.DEFAULT}
      statusBarStyle="light-content"
    >
      <Stack.Screen options={{ headerShown: false }} />
      <AccountHeader
        title={t("specifications")}
        variant="blue"
        showHeadset={false}
      />
      {renderBody()}
    </SafeAreaView>
  );
}
