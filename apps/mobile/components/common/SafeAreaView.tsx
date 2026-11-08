import { Colors } from "@/constants/Colors";
import { useColorScheme } from "nativewind";
import { StatusBar, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface SafeAreaViewProps {
  children: React.ReactNode;
  className?: string;
  statusBarColor?: string;
  statusBarStyle?: "light-content" | "dark-content";
}

const SafeAreaView = ({
  children,
  className = "",
  statusBarColor,
  statusBarStyle,
}: SafeAreaViewProps) => {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  // Match the header/page background in dark mode instead of a white strip.
  const barColor =
    statusBarColor ?? (isDark ? "#111827" : Colors.neutral.surface);
  const barStyle =
    statusBarStyle ?? (isDark ? "light-content" : "dark-content");

  return (
    <View className={`flex-1 bg-background ${className}`}>
      {/* RN 0.88 / SDK 58 edge-to-edge no longer lets the app paint the
          system status bar; the colored inset below provides the backdrop. */}
      <StatusBar barStyle={barStyle} />
      {/* Colored background for status bar area */}
      <View
        style={{
          height: insets.top,
          backgroundColor: barColor,
        }}
      />
      {/* Content area */}
      <View className="flex-1">{children}</View>
    </View>
  );
};

export default SafeAreaView;
