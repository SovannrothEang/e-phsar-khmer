import { FeedScrollView } from "@/components/category/FeedScrollView";
import NavBar from "@/components/common/NavBar";
import SafeAreaView from "@/components/common/SafeAreaView";
import HomeBanner from "@/components/home/HomeBanner";
import LatestAds from "@/components/home/LatestAds";
import NearbySection from "@/components/home/NearbySection";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { fetchAdvertisements } from "@/lib/api/advertisements";
import { fetchCategories } from "@/lib/api/listings";
import { categoryImage } from "@/lib/category-images";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Image,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

const HomeScreen = () => {
  const { isAuthenticated } = useAuth();
  const { toggleTheme } = useTheme();
  const { t } = useLanguage();
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime: 5 * 60_000,
  });
  const bannersQuery = useQuery({
    queryKey: ["advertisements", "home"],
    queryFn: () => fetchAdvertisements("home"),
    staleTime: 5 * 60_000,
  });

  const categories = categoriesQuery.data ?? [];
  const banners = bannersQuery.data ?? [];

  return (
    <SafeAreaView className="bg-white dark:bg-gray-950">
      <NavBar
        onThemeToggle={isAuthenticated ? toggleTheme : undefined}
        onQRCodePress={() => router.push("/scan")}
        onSearchPress={() => router.push("/search")}
      />
      <FeedScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        className="bg-white dark:bg-gray-950"
      >
        <HomeBanner banners={banners} isLoading={bannersQuery.isLoading} />

        {/* Main Category Grid */}
        <View className="bg-white px-1 pb-2 pt-7 dark:bg-gray-900">
          {categoriesQuery.isLoading ? (
            <View className="items-center py-6">
              <ActivityIndicator color={Colors.primary.DEFAULT} />
            </View>
          ) : categories.length === 0 ? (
            <View className="items-center py-6">
              <Text className="text-sm text-gray-500">
                {t("couldNotLoadCategories")}
              </Text>
            </View>
          ) : (
            <View className="flex-row flex-wrap">
              {categories.map((item, index) => {
                const image = categoryImage(item.slug);
                return (
                  <Animated.View
                    key={item.id}
                    entering={FadeInDown.delay(index * 25).duration(300)}
                    className="mb-5 w-1/4 items-center"
                  >
                    <TouchableOpacity
                      onPress={() =>
                        router.push(`/(categories)/${item.slug}` as never)
                      }
                      className="w-full items-center px-1"
                      activeOpacity={0.7}
                    >
                      <View className="mb-1.5 h-14 w-14 items-center justify-center">
                        {image ? (
                          <Image
                            source={image}
                            className="h-12 w-12"
                            resizeMode="contain"
                          />
                        ) : (
                          <View className="h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-gray-800">
                            <Ionicons
                              name="grid-outline"
                              size={25}
                              color="#0EA5E9"
                            />
                          </View>
                        )}
                      </View>
                      <Text
                        className="px-0.5 text-center text-[11px] font-semibold leading-4 text-gray-800 dark:text-gray-200"
                        numberOfLines={2}
                        style={{ minHeight: 32 }}
                      >
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          )}
        </View>

        {/* Nearby Deals Banner Section */}
        <NearbySection />

        {/* Latest Ads Listing Feed */}
        <LatestAds />
      </FeedScrollView>
    </SafeAreaView>
  );
};

export default HomeScreen;
