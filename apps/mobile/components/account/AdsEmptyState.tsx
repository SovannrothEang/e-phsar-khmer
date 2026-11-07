import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useColorScheme } from "nativewind";
import { Text, TouchableOpacity, View } from "react-native";

interface AdsEmptyStateProps {
  message: string;
  showSellButton?: boolean;
}

export default function AdsEmptyState({
  message,
  showSellButton = false,
}: AdsEmptyStateProps) {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <View className="items-center px-6 pt-12">
      <View className="relative">
        <Ionicons name="camera" size={82} color="#9CA3AF" />
        <View className="absolute left-0 top-2">
          {/* Plus is painted in the page colour so it reads as a cut-out. */}
          <Ionicons
            name="add"
            size={28}
            color={isDark ? "#000000" : "#F3F4F6"}
          />
        </View>
      </View>
      <Text className="mt-4 text-center text-base text-gray-500 dark:text-gray-400">
        {message}
      </Text>
      {showSellButton ? (
        <TouchableOpacity
          onPress={() => router.push("/account/choose-category" as never)}
          activeOpacity={0.9}
          accessibilityRole="button"
          className="mt-5 h-12 min-w-[180px] items-center justify-center rounded-full bg-secondary-orange px-8"
        >
          <Text className="text-base font-semibold text-white">
            Sell your stuff
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
