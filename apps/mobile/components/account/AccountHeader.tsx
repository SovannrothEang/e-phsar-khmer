import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useColorScheme } from "nativewind";
import { Text, TouchableOpacity, View } from "react-native";

interface AccountHeaderProps {
  title: string;
  variant?: "blue" | "white";
  showHeadset?: boolean;
}

/**
 * Back-arrow / centered-title / headset header used by the account sub-screens.
 * The status bar itself is owned by each screen's SafeAreaView.
 */
export default function AccountHeader({
  title,
  variant = "white",
  showHeadset = true,
}: AccountHeaderProps) {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const isBlue = variant === "blue";
  const iconColor = isBlue ? "white" : isDark ? "#F9FAFB" : "#111827";

  return (
    <View
      className={`flex-row items-center justify-between px-4 py-3 ${
        isBlue
          ? "bg-primary"
          : "border-b border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900"
      }`}
    >
      <TouchableOpacity
        onPress={() => router.back()}
        className="p-1"
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="arrow-back" size={24} color={iconColor} />
      </TouchableOpacity>
      <Text
        className={`text-lg font-bold ${
          isBlue ? "text-white" : "text-gray-900 dark:text-white"
        }`}
      >
        {title}
      </Text>
      {showHeadset ? (
        <TouchableOpacity
          onPress={() => router.push("/(auth)/contact-us" as never)}
          className="p-1"
          accessibilityRole="button"
          accessibilityLabel="Contact support"
        >
          <Ionicons name="headset-outline" size={24} color={iconColor} />
        </TouchableOpacity>
      ) : (
        <View className="w-8" />
      )}
    </View>
  );
}
