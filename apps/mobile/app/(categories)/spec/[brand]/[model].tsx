import AccountHeader from "@/components/account/AccountHeader";
import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { useLanguage } from "@/contexts/LanguageContext";
import { ApiError } from "@/lib/api/client";
import { fetchProductSpec } from "@/lib/api/products";
import { familyLabel, foldSpecRows, fuelTypeOf } from "@/lib/product-spec";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Image,
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

    const fuelType = fuelTypeOf(product.specGroups);

    return (
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View className="bg-neutral-surface px-4 py-5 dark:bg-gray-900">
          <View className="items-center rounded-xl bg-neutral-background p-4 dark:bg-gray-800">
            {product.image ? (
              <Image
                source={{ uri: product.image }}
                style={{ width: "100%", aspectRatio: 4 / 3 }}
                resizeMode="contain"
                accessibilityLabel={`${product.brandName} ${product.modelName}`}
              />
            ) : (
              <View
                style={{ width: "100%", aspectRatio: 4 / 3 }}
                className="items-center justify-center rounded-lg bg-neutral-border/40 dark:bg-gray-700"
              >
                <Text className="text-4xl font-bold text-neutral-text-sub dark:text-gray-300">
                  {product.brandName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          <Text className="mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-text-sub dark:text-gray-400">
            {product.brandName}
          </Text>
          <Text className="mt-1 text-xl font-bold text-neutral-text-main dark:text-white">
            {product.modelName}
          </Text>

          <View className="mt-2 flex-row flex-wrap items-center gap-2">
            <View className="flex-row items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1">
              <Ionicons
                name="checkmark-circle"
                size={14}
                color={Colors.primary.DEFAULT}
              />
              <Text className="text-xs font-semibold text-primary dark:text-sky-300">
                {t("trustedSpecs")}
              </Text>
            </View>
            <View className="rounded-full border border-neutral-border bg-neutral-background px-3 py-1 dark:border-gray-700 dark:bg-gray-800">
              <Text className="text-xs text-neutral-text-main dark:text-gray-200">
                {familyLabel(product.family)}
              </Text>
            </View>
            {fuelType ? (
              <View className="rounded-full border border-neutral-border bg-neutral-background px-3 py-1 dark:border-gray-700 dark:bg-gray-800">
                <Text className="text-xs text-neutral-text-main dark:text-gray-200">
                  {fuelType}
                </Text>
              </View>
            ) : null}
          </View>

          <Text className="mt-3 text-sm leading-5 text-neutral-text-sub dark:text-gray-400">
            {t("trustedSpecsNote")}
          </Text>
        </View>

        <View className="h-2 bg-neutral-border dark:bg-gray-800" />

        <View className="bg-neutral-surface px-4 py-4 dark:bg-gray-900">
          <Text className="text-base font-bold text-neutral-text-main dark:text-white">
            {t("specifications")}
          </Text>

          {product.specGroups.length === 0 ? (
            <Text className="mt-3 text-sm text-neutral-text-sub dark:text-gray-400">
              {t("specsEmpty")}
            </Text>
          ) : (
            <View className="mt-3 gap-3">
              {product.specGroups.map((group, groupIndex) => (
                <View
                  key={`${group.title}-${groupIndex}`}
                  className="rounded-xl border border-neutral-border bg-neutral-background/40 p-4 dark:border-gray-800 dark:bg-gray-950/40"
                >
                  <View className="flex-row items-center gap-2">
                    <View className="h-4 w-1 rounded-full bg-primary" />
                    <Text className="flex-1 text-sm font-bold text-neutral-text-main dark:text-white">
                      {group.title}
                    </Text>
                  </View>
                  <View className="mt-2">
                    {foldSpecRows(group.rows).map(
                      (row, rowIndex, foldedRows) => (
                        <View
                          key={`${row.label}-${rowIndex}`}
                          className={`flex-row gap-3 py-2.5 ${
                            rowIndex === foldedRows.length - 1
                              ? ""
                              : "border-b border-neutral-border/70 dark:border-gray-800"
                          }`}
                        >
                          <Text className="w-[38%] text-xs leading-5 text-neutral-text-sub dark:text-gray-400">
                            {row.label}
                          </Text>
                          <View className="flex-1">
                            {row.values.map((value, valueIndex) => (
                              <Text
                                key={valueIndex}
                                className="text-sm leading-5 text-neutral-text-main dark:text-gray-100"
                              >
                                {value}
                              </Text>
                            ))}
                          </View>
                        </View>
                      ),
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
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
