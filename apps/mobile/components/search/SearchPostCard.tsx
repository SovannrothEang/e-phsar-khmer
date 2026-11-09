import type { Product } from "@/types/product";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";

/**
 * The compact white post card from the search reference: a 96 px thumbnail,
 * a two-line title, the relative date, the optional paid badge and the price.
 * Kept separate from `ProductCard` because the search row is a card with less
 * metadata and a smaller image than the browse feed's flat row.
 */
const SearchPostCard = ({ product }: { product: Product }) => (
  <TouchableOpacity
    activeOpacity={0.75}
    onPress={() => router.push(`/product/${product.id}` as never)}
    className="mx-3 mb-2.5 flex-row rounded-lg bg-white p-2.5 dark:bg-gray-900"
    style={{
      elevation: 2,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
    }}
    accessibilityRole="button"
    accessibilityLabel={product.title}
  >
    <View className="h-24 w-24 overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800">
      {product.image ? (
        <Image
          source={{ uri: product.image }}
          className="h-full w-full"
          resizeMode="cover"
        />
      ) : (
        <View className="h-full w-full items-center justify-center">
          <Ionicons name="image-outline" size={28} color="#9CA3AF" />
        </View>
      )}
    </View>

    <View className="ml-3 flex-1 justify-between py-0.5">
      <Text
        className="text-[15px] leading-5 text-gray-900 dark:text-white"
        numberOfLines={2}
      >
        {product.title}
      </Text>

      <View>
        <Text className="text-xs text-gray-500 dark:text-gray-400">
          {product.date}
        </Text>

        {product.isVerified ? (
          <View className="mt-1 flex-row items-center self-start rounded bg-violet-100 px-1.5 py-0.5 dark:bg-violet-950">
            <Ionicons name="checkmark-circle" size={12} color="#7C3AED" />
            <Text className="ml-1 text-[10px] font-bold text-violet-700 dark:text-violet-300">
              Verified Account
            </Text>
          </View>
        ) : null}

        <Text className="mt-1 text-[16px] font-bold text-rose-600 dark:text-rose-400">
          {product.price === null
            ? "Negotiable"
            : `$${product.price.toLocaleString()}`}
          {product.price !== null && product.jobType ? "+" : ""}
        </Text>
      </View>
    </View>
  </TouchableOpacity>
);

export default SearchPostCard;
