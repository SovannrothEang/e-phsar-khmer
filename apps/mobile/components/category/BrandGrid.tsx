import { useLanguage } from "@/contexts/LanguageContext";
import { Ionicons } from "@expo/vector-icons";
import { Image, Text, TouchableOpacity, View } from "react-native";

interface BrandItem {
  id: string;
  name: string;
  /** Storage URL from `GET /brands`; null renders an initial-letter tile. */
  image: string | null;
}

interface BrandGridProps {
  brands: BrandItem[];
  onBrandPress: (id: string) => void;
  /** Opens the full brand list; the tile is hidden when everything fits. */
  onShowMore?: () => void;
}

const BrandGrid = ({ brands, onBrandPress, onShowMore }: BrandGridProps) => {
  const { t } = useLanguage();
  if (!brands || brands.length === 0) return null;

  // Show top 9 brands + "See All" = 10 items (2 rows of 5)
  const displayBrands = brands.slice(0, 9);
  const hasMore = brands.length > displayBrands.length;

  return (
    <View className="px-2 pt-2 pb-2">
      <View className="flex-row flex-wrap">
        {displayBrands.map((brand) => (
          <TouchableOpacity
            key={brand.id}
            className="w-1/5 items-center mb-2"
            onPress={() => onBrandPress(brand.id)}
          >
            <View className="w-14 h-14 mb-2 items-center justify-center">
              {brand.image ? (
                <Image
                  source={{ uri: brand.image }}
                  className="w-full h-full"
                  resizeMode="contain"
                />
              ) : (
                <View className="w-full h-full rounded-full bg-gray-100 items-center justify-center">
                  <Text className="text-base font-bold text-gray-500">
                    {brand.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <Text
              className="text-xs text-center text-gray-900 mb-2"
              numberOfLines={1}
            >
              {brand.name}
            </Text>
          </TouchableOpacity>
        ))}

        {/* See All — opens the full, searchable brand list */}
        {hasMore && onShowMore ? (
          <TouchableOpacity
            className="w-1/5 items-center mb-2"
            onPress={onShowMore}
            accessibilityRole="button"
            accessibilityLabel={t("seeAll")}
          >
            <View className="w-14 h-14 mb-2 rounded-full items-center justify-center">
              <Ionicons
                name="ellipsis-horizontal-circle-outline"
                size={28}
                color="gray"
              />
            </View>
            <Text className="text-xs text-center text-gray-900">
              {t("seeAll")}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

export default BrandGrid;
