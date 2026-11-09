import AccountHeader from "@/components/account/AccountHeader";
import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/contexts/AuthContext";
import { NEXT_SELL } from "@/lib/auth-redirect";
import { fetchCategories } from "@/lib/api/listings";
import { categoryImage } from "@/lib/category-images";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Redirect, router, Stack, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function ChooseCategoryScreen() {
  const params = useLocalSearchParams<{ category?: string | string[] }>();
  const categorySlug = Array.isArray(params.category)
    ? params.category[0]
    : params.category;
  const { isAuthenticated, isLoading } = useAuth();

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime: 5 * 60_000,
  });
  const categories = categoriesQuery.data ?? [];
  const parent = categorySlug
    ? categories.find((category) => category.slug === categorySlug)
    : undefined;
  const subcategories = parent?.subcategories ?? [];
  const isSubcategoryStep = Boolean(categorySlug);

  // Posting needs an account: a guest goes through Welcome and the auth
  // screens bring the chooser back once they are signed in.
  if (!isLoading && !isAuthenticated) {
    return (
      <Redirect
        href={
          { pathname: "/(auth)/welcome", params: { next: NEXT_SELL } } as never
        }
      />
    );
  }

  return (
    <SafeAreaView
      statusBarColor={Colors.primary.DEFAULT}
      statusBarStyle="light-content"
      className="flex-1 bg-white dark:bg-black"
    >
      <Stack.Screen options={{ headerShown: false }} />
      <AccountHeader
        title="Choose a Category"
        variant="blue"
        showHeadset={false}
      />

      <ScrollView
        className="flex-1 bg-white dark:bg-black"
        showsVerticalScrollIndicator={false}
      >
        {categoriesQuery.isLoading ? (
          <View className="items-center py-10">
            <ActivityIndicator color={Colors.primary.DEFAULT} />
          </View>
        ) : isSubcategoryStep && !parent ? (
          <View className="items-center px-6 py-10">
            <Text className="text-center text-sm text-gray-500 dark:text-gray-400">
              Could not load this category.
            </Text>
          </View>
        ) : categories.length === 0 ? (
          <View className="items-center px-6 py-10">
            <Text className="text-center text-sm text-gray-500 dark:text-gray-400">
              Could not load categories.
            </Text>
          </View>
        ) : isSubcategoryStep && parent ? (
          subcategories.length === 0 ? (
            <View className="items-center px-6 py-10">
              <Text className="text-center text-sm text-gray-500 dark:text-gray-400">
                No subcategories yet.
              </Text>
            </View>
          ) : (
            subcategories.map((subcategory) => {
              const remoteIcon =
                subcategory.icon?.startsWith("http") ||
                subcategory.icon?.includes("/storage/")
                  ? subcategory.icon
                  : null;
              return (
                <TouchableOpacity
                  key={subcategory.id}
                  activeOpacity={0.7}
                  onPress={() =>
                    router.push(
                      `/account/new-ad?category=${encodeURIComponent(
                        parent.slug,
                      )}&subcategory=${encodeURIComponent(
                        subcategory.slug,
                      )}` as never,
                    )
                  }
                  className="flex-row items-center border-b border-gray-100 px-4 py-3 dark:border-gray-800"
                >
                  <View className="h-14 w-14 items-center justify-center">
                    {remoteIcon ? (
                      <Image
                        source={{ uri: remoteIcon }}
                        className="h-12 w-12"
                        resizeMode="contain"
                      />
                    ) : (
                      <View className="h-12 w-12 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-950/40">
                        <Text className="text-lg font-bold text-primary">
                          {subcategory.name.charAt(0)}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text className="ml-4 flex-1 text-base font-semibold text-gray-900 dark:text-white">
                    {subcategory.name}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              );
            })
          )
        ) : (
          categories.map((category) => {
            const image = categoryImage(category.slug);
            return (
              <TouchableOpacity
                key={category.id}
                activeOpacity={0.7}
                onPress={() =>
                  router.push(
                    `/account/choose-category?category=${encodeURIComponent(
                      category.slug,
                    )}` as never,
                  )
                }
                className="flex-row items-center border-b border-gray-100 px-4 py-3 dark:border-gray-800"
              >
                <View className="h-14 w-14 items-center justify-center">
                  {image ? (
                    <Image
                      source={image}
                      className="h-14 w-14"
                      resizeMode="contain"
                    />
                  ) : (
                    <Ionicons
                      name="grid-outline"
                      size={30}
                      color={Colors.primary.DEFAULT}
                    />
                  )}
                </View>
                <Text className="ml-4 flex-1 text-base font-semibold text-gray-900 dark:text-white">
                  {category.name}
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
