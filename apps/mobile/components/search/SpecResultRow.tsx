import { Colors } from "@/constants/Colors";
import type { ProductSummary } from "@/lib/api/products";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";

/** One trusted spec page in search results. */
const SpecResultRow = ({ product }: { product: ProductSummary }) => (
  <TouchableOpacity
    activeOpacity={0.7}
    onPress={() =>
      router.push({
        pathname: "/spec/[brand]/[model]",
        params: { brand: product.brandSlug, model: product.modelSlug },
      } as never)
    }
    className="flex-row items-center px-4 py-3"
    accessibilityRole="button"
    accessibilityLabel={`${product.brandName} ${product.modelName}`}
  >
    {product.image ? (
      <Image
        source={{ uri: product.image }}
        className="h-14 w-14 rounded-lg bg-neutral-background"
        resizeMode="contain"
      />
    ) : (
      <View className="h-14 w-14 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
        <Ionicons
          name="document-text-outline"
          size={26}
          color={Colors.text.muted}
        />
      </View>
    )}

    <View className="ml-3 flex-1">
      <Text
        className="text-[16px] font-semibold text-gray-900 dark:text-white"
        numberOfLines={1}
      >
        {product.modelName}
      </Text>
      <Text
        className="mt-0.5 text-[13px] text-gray-500 dark:text-gray-400"
        numberOfLines={1}
      >
        {product.brandName}
      </Text>
    </View>

    <Ionicons name="chevron-forward" size={20} color={Colors.text.muted} />
  </TouchableOpacity>
);

export default SpecResultRow;
