import { AuthHeader } from "@/components/auth/AuthHeader";
import {
  SocialAuthDivider,
  SocialProviderButtons,
  TelegramAuthButton,
} from "@/components/auth/SocialAuthSection";
import { AppFooterDeviceInfo } from "@/components/common/AppFooterDeviceInfo";
import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

const AuthLandingScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string | string[] }>();
  // "sell" when a guest tapped Start Selling: the auth screens hand the
  // category chooser back once the account exists.
  const next = Array.isArray(params.next) ? params.next[0] : params.next;
  const authHref = (pathname: "/(auth)/sign-in" | "/(auth)/sign-up") =>
    next ? ({ pathname, params: { next } } as never) : (pathname as never);

  return (
    <SafeAreaView
      statusBarColor={Colors.primary.DEFAULT}
      statusBarStyle="light-content"
      className="bg-neutral-background dark:bg-gray-950"
    >
      <AuthHeader branding />

      <ScrollView
        className="flex-1 bg-neutral-background dark:bg-gray-950 px-4"
        contentContainerStyle={{
          flexGrow: 1,
          // Every row is a direct child, so `space-evenly` gives the white area
          // one identical gap between rows and above/below the block.
          justifyContent: "space-evenly",
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-neutral-text-sub dark:text-gray-300 font-normal text-center text-[14.5px]">
          Login Or Register With Your Phone Number
        </Text>

        {/* Inset from the left and right so the pair is narrower than the rows
            around it. */}
        <View className="flex-row gap-4 px-2">
          <TouchableOpacity
            onPress={() => router.push(authHref("/(auth)/sign-in"))}
            activeOpacity={0.85}
            accessibilityRole="button"
            className="flex-1 bg-secondary-orange h-[44px] rounded-[4px] items-center justify-center shadow-xs"
          >
            <Text className="text-white font-bold text-base">Login</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push(authHref("/(auth)/sign-up"))}
            activeOpacity={0.85}
            accessibilityRole="button"
            className="flex-1 bg-white dark:bg-gray-900 border-[1.5px] border-secondary-orange h-[44px] rounded-[4px] items-center justify-center shadow-xs"
          >
            <Text className="text-secondary-orange font-bold text-base">
              Register
            </Text>
          </TouchableOpacity>
        </View>

        <SocialAuthDivider />
        <View className="mx-2">
          <TelegramAuthButton />
        </View>
        <SocialProviderButtons />

        <Text className="text-neutral-text-sub dark:text-gray-300 text-center text-[13px] leading-5 px-4">
          By continuing, you agree to our{" "}
          <Text className="text-primary font-medium">Posting Rule</Text> and
          {"\n"}
          <Text className="text-primary font-medium">Privacy Policy</Text>.
        </Text>

        {/* Device & App Version */}
        <AppFooterDeviceInfo className="items-center" />
      </ScrollView>
    </SafeAreaView>
  );
};

export default AuthLandingScreen;
