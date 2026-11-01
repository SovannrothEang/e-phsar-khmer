import ProductCard from "@/components/product/ProductCard";
import { Colors } from "@/constants/Colors";
import { useLanguage } from "@/contexts/LanguageContext";
import { fetchTrending } from "@/lib/api/feed";
import { toCardProduct } from "@/lib/listing-card";
import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

/** Home's engagement-ranked strip; hidden when the backend has no live ads. */
function TrendingStrip() {
  const { t } = useLanguage();
  const query = useQuery({
    queryKey: ["trending", 10],
    queryFn: () => fetchTrending(10),
  });

  if (query.isLoading) {
    return (
      <View className="items-center py-6">
        <ActivityIndicator color={Colors.primary.DEFAULT} />
      </View>
    );
  }

  const products = (query.data ?? []).map(toCardProduct);
  if (products.length === 0) return null;

  return (
    <View className="pb-2 pt-5">
      <View className="mb-3 flex-row items-center gap-2 px-4">
        <View className="h-6 w-2.5 rounded-full bg-orange-500" />
        <Text className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          {t("trending")}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
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
    </View>
  );
}

export default TrendingStrip;
