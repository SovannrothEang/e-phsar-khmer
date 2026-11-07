import { Product } from "@/types/product";
import { useGridCardSize } from "@/hooks/useGridCardSize";
import { useReactions } from "@/contexts/ReactionsContext";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";

interface ProductCardProps {
  product: Product;
  viewMode: "list" | "grid";
  /** Grid only: a fixed card width for horizontal strips (defaults to half-width). */
  fixedWidth?: number;
}

const ProductCard = ({ product, viewMode, fixedWidth }: ProductCardProps) => {
  const { total } = useGridCardSize();
  const { isLiked, toggleLike } = useReactions();
  const liked = isLiked(product.id);

  const getImageSource = (img: any) => {
    if (!img) return null;
    if (typeof img === "string") return { uri: img };
    return img;
  };

  const renderImageBadges = (mode: "grid" | "list") => (
    <>
      {/* Favorite Button: flat list rows keep the reference's white heart. */}
      <TouchableOpacity
        className={`absolute top-2.5 ${
          mode === "list"
            ? "left-2.5 p-1"
            : "right-2.5 rounded-full border border-white/20 bg-black/50 p-2 shadow-sm"
        }`}
        activeOpacity={0.7}
        onPress={(e) => {
          e.stopPropagation();
          void toggleLike(product.id);
        }}
      >
        <Ionicons
          name={liked ? "heart" : "heart-outline"}
          size={mode === "list" ? 24 : 15}
          color={liked ? "#EF4444" : "white"}
          style={
            mode === "list"
              ? {
                  textShadowColor: "rgba(0,0,0,0.35)",
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 3,
                }
              : undefined
          }
        />
      </TouchableOpacity>

      {/* Free Delivery Badge */}
      {product.hasFreeDelivery && (
        <View
          className={`absolute bottom-2.5 ${
            mode === "list" ? "right-2.5" : "left-2.5"
          } flex-row items-center rounded-full border border-white/20 bg-black/70 px-2 py-0.5`}
        >
          <Ionicons name="car" size={11} color="#38BDF8" />
          <Text className="ml-1 text-[10px] font-bold uppercase tracking-wider text-white">
            Free Delivery
          </Text>
        </View>
      )}

      {/* Image Count Badge */}
      {(product.imageCount ?? 0) > 0 && (
        <View
          className={`absolute bottom-2.5 ${
            mode === "list" ? "left-2.5" : "right-2.5"
          } flex-row items-center rounded-full border border-white/20 bg-black/70 px-2 py-0.5`}
        >
          <Ionicons
            name="camera"
            size={mode === "list" ? 13 : 11}
            color="white"
          />
          <Text
            className={`ml-1 font-bold text-white ${
              mode === "list" ? "text-xs" : "text-[10px]"
            }`}
          >
            {product.imageCount}
          </Text>
        </View>
      )}
    </>
  );

  const getSecondaryInfo = () => {
    const parts = [];
    if (product.type) parts.push(product.type);
    else if (product.condition) parts.push(product.condition);
    else if (product.jobType) parts.push(product.jobType);

    if (product.size) parts.push(product.size);
    else if (product.experienceLevel) parts.push(product.experienceLevel);
    else if (product.year) parts.push(product.year);

    if (product.taxPaper) parts.push("Tax Paper");

    return parts.join(" • ") || " ";
  };

  const renderPlaceholderImage = () => (
    <View className="h-full w-full items-center justify-center bg-gray-100 dark:bg-gray-800">
      <View className="items-center justify-center rounded-2xl bg-gray-200 dark:bg-gray-700 p-4">
        <Ionicons name="image-outline" size={32} color="#9CA3AF" />
      </View>
      <Text
        className="absolute px-2 text-center text-xs font-medium text-gray-500"
        numberOfLines={2}
      >
        {product.title}
      </Text>
    </View>
  );

  // LIST VIEW — a flat reference row, not a bordered card.
  if (viewMode === "list") {
    return (
      <TouchableOpacity
        className="flex-row px-4 py-1.5"
        onPress={() => router.push(`/product/${product.id}`)}
        activeOpacity={0.75}
      >
        {/* Image Container */}
        <View className="relative h-36 w-36 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
          {product.image ? (
            <Image
              source={getImageSource(product.image)}
              className="h-full w-full"
              resizeMode="cover"
            />
          ) : (
            renderPlaceholderImage()
          )}
          {renderImageBadges("list")}
        </View>

        {/* Details */}
        <View className="ml-4 h-36 flex-1 justify-between py-0.5">
          {/* Title */}
          <Text
            className="text-base leading-6 text-gray-900 dark:text-white"
            numberOfLines={2}
          >
            {product.title}
          </Text>

          {/* Time, Location */}
          <View className="flex-row items-center">
            <Ionicons name="time-outline" size={15} color="#6B7280" />
            <Text
              className="ml-1 flex-1 text-sm text-gray-500 dark:text-gray-400"
              numberOfLines={1}
            >
              {product.date}
              {product.location ? ` • ${product.location}` : ""}
            </Text>
          </View>

          {/* Condition / Info */}
          <Text
            className="text-sm text-gray-500 dark:text-gray-400"
            numberOfLines={1}
          >
            {getSecondaryInfo()}
          </Text>

          {/* Verified Badge */}
          {product.isVerified && (
            <View className="flex-row items-center">
              <View className="rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 dark:border-sky-800 dark:bg-sky-950">
                <Text className="text-[10px] font-bold text-sky-600 dark:text-sky-400">
                  ✓ Verified Account
                </Text>
              </View>
            </View>
          )}

          {/* Price */}
          <View className="flex-row items-baseline">
            <Text className="text-xl font-bold text-rose-600 dark:text-rose-400">
              {product.price === null
                ? "Negotiable"
                : `$${product.price.toLocaleString()}`}
              {product.price !== null && product.jobType ? "+" : ""}
            </Text>
            {product.oldPrice ? (
              <Text className="ml-2 text-sm text-gray-400 line-through">
                ${product.oldPrice.toLocaleString()}
              </Text>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // GRID VIEW
  return (
    <TouchableOpacity
      className={`p-1.5 ${fixedWidth ? "" : "w-1/2"}`}
      style={fixedWidth ? { width: fixedWidth } : undefined}
      onPress={() => router.push(`/product/${product.id}`)}
      activeOpacity={0.75}
    >
      <View
        className="overflow-hidden rounded-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800"
        style={{
          height: total,
          elevation: 1,
          shadowColor: "#0F172A",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 6,
        }}
      >
        {/* Image Container */}
        <View className="relative aspect-square">
          {product.image ? (
            <Image
              source={getImageSource(product.image)}
              className="h-full w-full"
              resizeMode="cover"
            />
          ) : (
            renderPlaceholderImage()
          )}
          {renderImageBadges("grid")}
        </View>

        {/* Details */}
        <View className="h-36 justify-between p-3">
          {/* Title */}
          <Text
            className="text-xs font-bold text-gray-900 dark:text-white leading-4"
            numberOfLines={2}
          >
            {product.title}
          </Text>

          {/* Location & Time */}
          <View className="flex-row items-center">
            <Ionicons name="time-outline" size={11} color="#9CA3AF" />
            <Text
              className="ml-1 flex-1 text-[11px] text-gray-500 font-medium"
              numberOfLines={1}
            >
              {product.date}
              {product.location ? ` • ${product.location}` : ""}
            </Text>
          </View>

          {/* Secondary Specs */}
          <Text className="text-[11px] text-gray-400" numberOfLines={1}>
            {getSecondaryInfo()}
          </Text>

          {/* Verified Account Tag */}
          {product.isVerified && (
            <View className="flex-row items-center">
              <View className="rounded-md bg-sky-50 dark:bg-sky-950 px-1.5 py-0.5 border border-sky-200 dark:border-sky-800">
                <Text className="text-[9px] font-bold text-sky-600 dark:text-sky-400">
                  ✓ Verified
                </Text>
              </View>
            </View>
          )}

          {/* Price */}
          <View className="flex-row items-center">
            <Text className="text-base font-black text-rose-600 dark:text-rose-400">
              {product.price === null
                ? "Negotiable"
                : `$${product.price.toLocaleString()}`}
              {product.price !== null && product.jobType ? "+" : ""}
            </Text>
            {product.oldPrice ? (
              <Text className="ml-1.5 text-xs text-gray-400 line-through">
                ${product.oldPrice.toLocaleString()}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default ProductCard;
