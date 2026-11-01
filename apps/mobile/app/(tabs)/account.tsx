import { AppFooterDeviceInfo } from "@/components/common/AppFooterDeviceInfo";
import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Image,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const AccountScreen = () => {
  const router = useRouter();
  const { isAuthenticated, user, logout } = useAuth();
  const { isDark } = useTheme();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const FEATURE_LINKS = [
    {
      label: "Manage Ads",
      icon: "documents-outline",
      onPress: () => router.push("/account/my-ads" as never),
    },
    {
      label: "Likes",
      icon: "heart-outline",
      onPress: () => router.push("/account/reactions?kind=likes" as never),
    },
    {
      label: "Saves",
      icon: "bookmark-outline",
      onPress: () => router.push("/account/reactions?kind=saves" as never),
    },
    {
      label: "Jobs",
      icon: "briefcase-outline",
      onPress: () => router.push("/(categories)/jobs" as never),
    },
  ];

  const displayName =
    user?.name && user.name !== "DATA" && user.name !== "015455758"
      ? user.name
      : "Ban Sreypov";
  const displayUsername =
    user?.username && user.username !== "data" && user.username !== "015455758"
      ? user.username
      : "bansreypov";

  const confirmLogout = () => {
    setShowLogoutModal(false);
    setTimeout(() => {
      void logout();
    }, 100);
  };

  return (
    <SafeAreaView
      statusBarColor={Colors.primary.DEFAULT}
      statusBarStyle="light-content"
      className="bg-neutral-background"
    >
      {/* Top Header */}
      <View className="bg-primary px-4 pt-3 pb-8 relative overflow-hidden">
        {user?.coverPhoto ? (
          <Image
            source={{ uri: user.coverPhoto }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: 0.35,
            }}
            resizeMode="cover"
          />
        ) : null}
        <View className="flex-row items-center justify-between">
          <Text className="text-white text-xl font-bold tracking-tight">
            @{displayUsername}
          </Text>
          <View className="flex-row items-center gap-4">
            <TouchableOpacity
              onPress={() => router.push("/(auth)/contact-us")}
              className="p-1"
            >
              <Ionicons name="headset-outline" size={24} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/(auth)/settings")}
              className="p-1"
            >
              <Ionicons name="settings-outline" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Add / Change cover photo */}
        <TouchableOpacity
          onPress={() => router.push("/(auth)/edit-profile")}
          className="flex-row items-center justify-center gap-2 mt-4 py-1"
        >
          <Ionicons name="camera-outline" size={20} color="white" />
          <Text className="text-white text-sm font-semibold">
            {user?.coverPhoto ? "Change cover photo" : "Add cover photo"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {isAuthenticated ? (
          /* ================= LOGGED IN VIEW (PHSARKHMER STYLE) ================= */
          <View className="pb-10">
            {/* User Profile Card */}
            <View style={{ marginHorizontal: 16, marginTop: -14, zIndex: 30 }}>
              {/* White Card Body */}
              <View
                style={{
                  backgroundColor: isDark ? "#111827" : "#FFFFFF",
                  borderRadius: 20,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: isDark ? "#1F2937" : "#F1F5F9",
                  elevation: 3,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.06,
                  shadowRadius: 6,
                }}
              >
                {/* Header row: Avatar on left, Name in middle, QR code on right */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  {/* Left: Avatar with camera badge */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => router.push("/(auth)/edit-profile")}
                    style={{ position: "relative", marginRight: 14 }}
                  >
                    <View
                      style={{
                        width: 62,
                        height: 62,
                        borderRadius: 31,
                        backgroundColor: "#E5E7EB",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      {user.avatar ? (
                        <Image
                          source={{ uri: user.avatar }}
                          style={{ width: "100%", height: "100%" }}
                          resizeMode="cover"
                        />
                      ) : (
                        <Ionicons name="person" size={38} color="#9CA3AF" />
                      )}
                    </View>
                    <View
                      style={{
                        position: "absolute",
                        bottom: -2,
                        right: -2,
                        backgroundColor: "#0EA5E9",
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: "#FFFFFF",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="camera" size={10} color="white" />
                    </View>
                  </TouchableOpacity>

                  {/* Middle: Name & Account Type */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => router.push("/(auth)/edit-profile")}
                    style={{ flex: 1, justifyContent: "center" }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 18,
                          fontWeight: "700",
                          color: isDark ? "#FFFFFF" : "#111827",
                        }}
                      >
                        {displayName}
                      </Text>
                      <Ionicons name="pencil-sharp" size={13} color="#0EA5E9" />
                    </View>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "500",
                        color: isDark ? "#9CA3AF" : "#6B7280",
                        marginTop: 2,
                      }}
                    >
                      {user.accountType || "Normal account"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* "My ads" Card */}
            <View className="bg-white dark:bg-gray-900 mx-4 mt-3 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-xs">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-base font-bold text-gray-900 dark:text-white">
                  My ads
                </Text>
                <TouchableOpacity
                  onPress={() => router.push("/account/my-ads" as never)}
                >
                  <Text className="text-xs font-semibold text-gray-400">
                    View All &gt;
                  </Text>
                </TouchableOpacity>
              </View>

              <View className="flex-row justify-around">
                {/* Post Ad */}
                <TouchableOpacity
                  onPress={() => router.push("/(tabs)/sell")}
                  className="items-center flex-1"
                >
                  <View className="relative mb-2">
                    <Ionicons name="camera-outline" size={28} color="#0EA5E9" />
                    <View className="absolute -top-1 -right-2">
                      <Ionicons name="add-circle" size={14} color="#0EA5E9" />
                    </View>
                  </View>
                  <Text className="text-xs font-medium text-gray-800 dark:text-gray-200 text-center">
                    Post Ad
                  </Text>
                </TouchableOpacity>

                {/* Active ads */}
                <TouchableOpacity
                  onPress={() =>
                    router.push("/account/my-ads?tab=active" as never)
                  }
                  className="items-center flex-1"
                >
                  <View className="relative mb-2">
                    <Ionicons
                      name="document-text-outline"
                      size={28}
                      color="#0EA5E9"
                    />
                    <View className="absolute -bottom-1 -right-1">
                      <Ionicons
                        name="checkmark-circle"
                        size={13}
                        color="#0EA5E9"
                      />
                    </View>
                  </View>
                  <Text className="text-xs font-medium text-gray-800 dark:text-gray-200 text-center">
                    Active ads
                  </Text>
                </TouchableOpacity>

                {/* Expired ads */}
                <TouchableOpacity
                  onPress={() =>
                    router.push("/account/my-ads?tab=expired" as never)
                  }
                  className="items-center flex-1"
                >
                  <View className="mb-2">
                    <Ionicons name="ban-outline" size={28} color="#0EA5E9" />
                  </View>
                  <Text className="text-xs font-medium text-gray-800 dark:text-gray-200 text-center">
                    Expired ads
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Features & Services Grid Card */}
            <View className="bg-white dark:bg-gray-900 mx-4 mt-3 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-xs">
              <View className="flex-row flex-wrap">
                {FEATURE_LINKS.map((entry) => (
                  <TouchableOpacity
                    key={entry.label}
                    className="w-1/4 items-center mb-5"
                    onPress={entry.onPress}
                  >
                    <Ionicons
                      name={entry.icon as any}
                      size={26}
                      color={isDark ? "#D1D5DB" : "#374151"}
                    />
                    <Text className="text-xs text-gray-800 dark:text-gray-200 font-medium mt-1 text-center">
                      {entry.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        ) : (
          /* ================= SIGNED-OUT PROMPT ================= */
          <View className="items-center px-6 pt-10 pb-12">
            <Ionicons
              name="person-circle-outline"
              size={72}
              color={Colors.text.muted}
            />
            <Text className="mt-4 text-lg font-bold text-neutral-text-main dark:text-white text-center">
              Sign in to PhsarKhmer
            </Text>
            <Text className="mt-2 text-center text-sm text-neutral-text-sub dark:text-gray-400 leading-6">
              Log in or create an account to manage your ads, saved posts and
              messages.
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/(auth)/welcome")}
              activeOpacity={0.85}
              accessibilityRole="button"
              className="mt-6 w-full bg-secondary-orange h-12 rounded-lg items-center justify-center shadow-xs"
            >
              <Text className="text-white font-bold text-base">
                Login or Register
              </Text>
            </TouchableOpacity>

            <AppFooterDeviceInfo className="items-center mt-10" />
          </View>
        )}
      </ScrollView>

      {/* Logout Confirmation Modal */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View
          className="flex-1 justify-center items-center px-6"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
        >
          <View className="bg-white rounded-3xl p-6 w-full max-w-sm items-center shadow-xl">
            <View className="w-14 h-14 bg-rose-100 rounded-full items-center justify-center mb-3">
              <Ionicons name="log-out" size={28} color="#E11D48" />
            </View>
            <Text className="text-xl font-bold text-neutral-text-main mb-1">
              Log Out?
            </Text>
            <Text className="text-neutral-text-sub text-center text-sm mb-6">
              Are you sure you want to log out of your account?
            </Text>
            <View className="flex-row gap-3 w-full">
              <TouchableOpacity
                onPress={() => setShowLogoutModal(false)}
                className="flex-1 py-3 bg-neutral-background rounded-xl items-center border border-neutral-border"
              >
                <Text className="text-neutral-text-main font-semibold">
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmLogout}
                className="flex-1 py-3 bg-rose-600 rounded-xl items-center"
              >
                <Text className="text-white font-bold">Log Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default AccountScreen;
