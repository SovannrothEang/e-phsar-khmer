import { AuthHeader } from "@/components/auth/AuthHeader";
import { SocialAuthSection } from "@/components/auth/SocialAuthSection";
import { AppFooterDeviceInfo } from "@/components/common/AppFooterDeviceInfo";
import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { useRouter } from "expo-router";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

const AuthLandingScreen = () => {
  const router = useRouter();

  return (
    <SafeAreaView
      statusBarColor={Colors.primary.DEFAULT}
      statusBarStyle="light-content"
      className="bg-neutral-background dark:bg-gray-950"
    >
      <AuthHeader branding />

      <ScrollView
        className="flex-1 bg-neutral-background dark:bg-gray-950 px-4"
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-neutral-text-sub dark:text-gray-300 font-semibold text-center text-[14.5px] mt-7 mb-4">
          Login Or Register With Your Phone Number
        </Text>

        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={() => router.push("/(auth)/sign-in")}
            activeOpacity={0.85}
            accessibilityRole="button"
            className="flex-1 bg-secondary-orange h-12 rounded-lg items-center justify-center shadow-xs"
          >
            <Text className="text-white font-bold text-base">Login</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(auth)/sign-up")}
            activeOpacity={0.85}
            accessibilityRole="button"
            className="flex-1 bg-white dark:bg-gray-900 border-[1.5px] border-secondary-orange h-12 rounded-lg items-center justify-center shadow-xs"
          >
            <Text className="text-secondary-orange font-bold text-base">
              Register
            </Text>
          </TouchableOpacity>
        </View>

        <SocialAuthSection />

        <View className="mt-2">
          <Text className="text-neutral-text-sub dark:text-gray-300 text-center text-[13px] leading-5 px-4">
            By continuing, you agree to our{" "}
            <Text className="text-primary font-medium">Posting Rule</Text> and
            {"\n"}
            <Text className="text-primary font-medium">Privacy Policy</Text>.
          </Text>

          {/* Device & App Version */}
          <AppFooterDeviceInfo className="items-center mt-7 mb-6" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AuthLandingScreen;
