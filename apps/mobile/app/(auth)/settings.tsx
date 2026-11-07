import BottomSheet from "@/components/common/BottomSheet";
import SafeAreaView from "@/components/common/SafeAreaView";
import { AppFooterDeviceInfo } from "@/components/common/AppFooterDeviceInfo";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/contexts/AuthContext";
import {
  LANGUAGES,
  LanguageCode,
  useLanguage,
} from "@/contexts/LanguageContext";
import { useNotification } from "@/contexts/NotificationContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  authenticateWithGoogle,
  authenticateWithTelegram,
} from "@/services/authService";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const SettingsScreen = () => {
  const router = useRouter();
  const { language, setLanguage, t, currentLanguageObj } = useLanguage();
  const { isDark } = useTheme();
  const { user, isAuthenticated, logout, updateUser } = useAuth();
  const { preferences, updatePreferences } = useNotification();

  // Modals & form state
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [localPrefs, setLocalPrefs] = useState(preferences);

  const [editUsernameVisible, setEditUsernameVisible] = useState(false);
  const [newUsername, setNewUsername] = useState(
    user?.username || "bansreypov",
  );

  const [editPhoneVisible, setEditPhoneVisible] = useState(false);
  const [newPhone, setNewPhone] = useState(user?.phone || "015 455 758");

  const [changePasswordVisible, setChangePasswordVisible] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");

  const [autoUpdateAvatar, setAutoUpdateAvatar] = useState(true);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(
    null,
  );

  const displayName =
    user?.name && user.name !== "DATA" && user.name !== "015455758"
      ? user.name
      : "Ban Sreypov";
  const displayUsername = user?.username || "bansreypov";
  const displayPhone = user?.phone || "015455758";

  // Determine connected Google account
  const connectedGoogle =
    user?.connectedAccounts?.google ||
    (user?.email?.toLowerCase().includes("gmail") ? displayName : "");

  // Determine connected Telegram account
  const connectedTelegram =
    user?.connectedAccounts?.telegram ||
    (user?.telegram ? `@${user.telegram}` : "");

  // Determine connected Facebook account
  const connectedFacebook = user?.connectedAccounts?.facebook || "";

  // Determine connected Apple account
  const connectedApple = user?.connectedAccounts?.apple || "";

  const handleSelectLanguage = (code: LanguageCode) => {
    setLanguage(code);
    setLangModalVisible(false);
  };

  // Connected Account: Google Handler
  const handleGooglePress = async () => {
    if (connectedGoogle) {
      Alert.alert(
        "Google Connected",
        `Currently connected as ${connectedGoogle} (${user?.email || "Gmail"}).`,
        [
          { text: "Keep Connected", style: "cancel" },
          {
            text: "Disconnect",
            style: "destructive",
            onPress: () => {
              updateUser({
                connectedAccounts: {
                  ...user.connectedAccounts,
                  google: "",
                },
              });
              Alert.alert("Disconnected", "Google account has been unlinked.");
            },
          },
        ],
      );
    } else {
      setConnectingProvider("google");
      const result = await authenticateWithGoogle("login");
      setConnectingProvider(null);
      if (result.success && result.user) {
        updateUser({
          name: result.user.name || displayName,
          email: result.user.email || user.email,
          connectedAccounts: {
            ...user.connectedAccounts,
            google: result.user.name || "Ban Sreypov",
          },
        });
        Alert.alert(
          "Connected!",
          `Linked with Google account ${result.user.name}.`,
        );
      }
    }
  };

  // Connected Account: Telegram Handler
  const handleTelegramPress = async () => {
    if (connectedTelegram) {
      Alert.alert(
        "Telegram Connected",
        `Connected with Telegram account ${connectedTelegram}.`,
        [
          { text: "Keep Connected", style: "cancel" },
          {
            text: "Disconnect",
            style: "destructive",
            onPress: () => {
              updateUser({
                connectedAccounts: {
                  ...user.connectedAccounts,
                  telegram: "",
                },
              });
              Alert.alert(
                "Disconnected",
                "Telegram account has been unlinked.",
              );
            },
          },
        ],
      );
    } else {
      setConnectingProvider("telegram");
      const result = await authenticateWithTelegram("login");
      setConnectingProvider(null);
      if (result.success && result.user) {
        updateUser({
          telegram: result.user.username || "sokha_kh",
          connectedAccounts: {
            ...user.connectedAccounts,
            telegram: result.user.username
              ? `@${result.user.username}`
              : "Connected",
          },
        });
        Alert.alert(
          "Connected!",
          `Linked with Telegram @${result.user.username || "user"}.`,
        );
      }
    }
  };

  // Connected Account: Facebook Handler
  const handleFacebookPress = () => {
    if (connectedFacebook) {
      Alert.alert("Facebook Connected", `Linked as ${connectedFacebook}.`, [
        { text: "Keep Connected", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: () => {
            updateUser({
              connectedAccounts: {
                ...user.connectedAccounts,
                facebook: "",
              },
            });
          },
        },
      ]);
    } else {
      updateUser({
        connectedAccounts: {
          ...user.connectedAccounts,
          facebook: displayName,
        },
      });
      Alert.alert(
        "Connected!",
        `Facebook linked successfully as ${displayName}.`,
      );
    }
  };

  // Connected Account: Apple Handler
  const handleApplePress = () => {
    if (connectedApple) {
      Alert.alert(
        "Apple ID Connected",
        `Linked with Apple ID ${connectedApple}.`,
        [
          { text: "Keep Connected", style: "cancel" },
          {
            text: "Disconnect",
            style: "destructive",
            onPress: () => {
              updateUser({
                connectedAccounts: {
                  ...user.connectedAccounts,
                  apple: "",
                },
              });
            },
          },
        ],
      );
    } else {
      updateUser({
        connectedAccounts: {
          ...user.connectedAccounts,
          apple: "Apple User",
        },
      });
      Alert.alert("Connected!", "Apple ID linked successfully.");
    }
  };

  const handleLogoutPress = () => {
    if (isAuthenticated) {
      Alert.alert(
        "Log Out",
        "Are you sure you want to log out of your account?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Log Out",
            style: "destructive",
            onPress: async () => {
              await logout();
              router.replace("/(tabs)/account");
            },
          },
        ],
      );
    } else {
      router.push("/(auth)/sign-in");
    }
  };

  return (
    <SafeAreaView
      statusBarColor={Colors.primary.DEFAULT}
      statusBarStyle="light-content"
      className={isDark ? "bg-gray-950 flex-1" : "bg-[#F3F4F6] flex-1"}
    >
      {/* 1. Header Matching Screenshot 1 */}
      <View className="bg-primary px-4 py-3 flex-row items-center justify-between shadow-xs">
        <TouchableOpacity
          onPress={() => router.back()}
          className="p-1 -ml-1 flex-row items-center"
        >
          <Ionicons name="chevron-back" size={26} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-lg font-bold">Settings</Text>
        <View className="w-8" />
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        {/* The signed-in view gets its top gap from the profile card's `mt-4`. */}
        {!isAuthenticated && <View className="h-4" />}

        {/* Account-only sections: signed-out visitors see App Setting + Support
            (the reference Settings screen) and nothing that needs an account. */}
        {isAuthenticated && (
          <>
            {/* 2. Top Profile Card (Matching Screenshot 1) */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push("/(auth)/edit-profile")}
              className={`mx-4 mt-4 mb-5 p-3.5 rounded-2xl flex-row items-center justify-between border shadow-2xs ${
                isDark
                  ? "bg-gray-900 border-gray-800"
                  : "bg-white border-gray-100"
              }`}
            >
              <View className="flex-row items-center gap-3.5">
                <View
                  className={`w-14 h-14 rounded-full items-center justify-center overflow-hidden ${
                    isDark ? "bg-gray-800" : "bg-gray-200"
                  }`}
                >
                  {user?.avatar ? (
                    <Image
                      source={{ uri: user.avatar }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons name="person" size={28} color="#9CA3AF" />
                  )}
                </View>
                <View>
                  <Text
                    className={`text-base font-bold ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {displayName}
                  </Text>
                  <Text className="text-xs text-gray-400 mt-0.5">
                    @{displayUsername}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={19} color="#9CA3AF" />
            </TouchableOpacity>

            {/* 3. Section: Profile (Matching Screenshot 1) */}
            <Text className="text-xs text-gray-500 font-normal px-5 mb-2.5">
              Profile
            </Text>
            <View
              className={`mx-4 mb-5 rounded-2xl border shadow-2xs overflow-hidden ${
                isDark
                  ? "bg-gray-900 border-gray-800"
                  : "bg-white border-gray-100"
              }`}
            >
              {/* Edit Profile */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push("/(auth)/edit-profile")}
                className={`px-4 py-5 flex-row items-center justify-between border-b ${
                  isDark ? "border-gray-800" : "border-gray-100"
                }`}
              >
                <View className="flex-row items-center gap-3">
                  <Ionicons
                    name="person-outline"
                    size={22}
                    color={isDark ? "#D1D5DB" : "#374151"}
                  />
                  <Text
                    className={`text-[16px] font-medium ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    Edit Profile
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color="#9CA3AF" />
              </TouchableOpacity>

              {/* Username */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  setNewUsername(displayUsername);
                  setEditUsernameVisible(true);
                }}
                className={`px-4 py-5 flex-row items-center justify-between border-b ${
                  isDark ? "border-gray-800" : "border-gray-100"
                }`}
              >
                <View className="flex-row items-center gap-3">
                  <Ionicons
                    name="at-outline"
                    size={22}
                    color={isDark ? "#D1D5DB" : "#374151"}
                  />
                  <Text
                    className={`text-[16px] font-medium ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    Username
                  </Text>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-[14px] text-gray-400">
                    {displayUsername}
                  </Text>
                  <Ionicons name="chevron-forward" size={17} color="#9CA3AF" />
                </View>
              </TouchableOpacity>

              {/* Auto Update Profile Picture */}
              <View className="px-4 py-2.5 flex-row items-center justify-between">
                <View className="flex-row items-center gap-3 flex-1 pr-3">
                  <Ionicons
                    name="sync-outline"
                    size={22}
                    color={isDark ? "#D1D5DB" : "#374151"}
                  />
                  <Text
                    className={`text-[16px] font-medium ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    Auto Update Profile Picture
                  </Text>
                </View>
                <Switch
                  value={autoUpdateAvatar}
                  onValueChange={setAutoUpdateAvatar}
                  trackColor={{ false: "#D1D5DB", true: "#22C55E" }}
                  thumbColor="white"
                />
              </View>
            </View>

            {/* 4. Section: Security (Matching Screenshot 1) */}
            <Text className="text-xs text-gray-500 font-normal px-5 mb-2.5">
              Security
            </Text>
            <View
              className={`mx-4 mb-5 rounded-2xl border shadow-2xs overflow-hidden ${
                isDark
                  ? "bg-gray-900 border-gray-800"
                  : "bg-white border-gray-100"
              }`}
            >
              {/* Activate Phone */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push("/account/change-phone" as never)}
                className={`px-4 py-5 flex-row items-center justify-between border-b ${
                  isDark ? "border-gray-800" : "border-gray-100"
                }`}
              >
                <View className="flex-row items-center gap-3">
                  <Ionicons
                    name="call-outline"
                    size={22}
                    color={isDark ? "#D1D5DB" : "#374151"}
                  />
                  <Text
                    className={`text-[16px] font-medium ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    Activate Phone
                  </Text>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-[14px] text-gray-400">
                    {displayPhone}
                  </Text>
                  <Ionicons name="chevron-forward" size={17} color="#9CA3AF" />
                </View>
              </TouchableOpacity>

              {/* Change Password */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push("/account/change-password" as never)}
                className={`px-4 py-5 flex-row items-center justify-between border-b ${
                  isDark ? "border-gray-800" : "border-gray-100"
                }`}
              >
                <View className="flex-row items-center gap-3">
                  <Ionicons
                    name="lock-closed-outline"
                    size={22}
                    color={isDark ? "#D1D5DB" : "#374151"}
                  />
                  <Text
                    className={`text-[16px] font-medium ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    Change Password
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color="#9CA3AF" />
              </TouchableOpacity>

              {/* Passkeys: deferred while web's Passkeys page stays a stub. */}
              {false && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() =>
                    Alert.alert(
                      "Passkeys",
                      "Passkey is enabled for biometric sign-in on this device.",
                    )
                  }
                  className={`px-4 py-5 flex-row items-center justify-between border-b ${
                    isDark ? "border-gray-800" : "border-gray-100"
                  }`}
                >
                  <View className="flex-row items-center gap-3">
                    <Ionicons
                      name="key-outline"
                      size={22}
                      color={isDark ? "#D1D5DB" : "#374151"}
                    />
                    <Text
                      className={`text-[16px] font-medium ${
                        isDark ? "text-white" : "text-gray-900"
                      }`}
                    >
                      Passkeys
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={17} color="#9CA3AF" />
                </TouchableOpacity>
              )}

              {/* Devices */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push("/account/devices" as never)}
                className="px-4 py-5 flex-row items-center justify-between"
              >
                <View className="flex-row items-center gap-3">
                  <Ionicons
                    name="phone-portrait-outline"
                    size={22}
                    color={isDark ? "#D1D5DB" : "#374151"}
                  />
                  <Text
                    className={`text-[16px] font-medium ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    Devices
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {false && (
              <>
                {/* Connected accounts are deferred: native OAuth needs a backend change. */}
                {/* 5. Section: Connected Accounts (Matching Screenshot 2) */}
                <Text className="text-xs text-gray-500 font-normal px-5 mb-2.5">
                  Connected Accounts
                </Text>
                <View
                  className={`mx-4 mb-5 rounded-2xl border shadow-2xs overflow-hidden ${
                    isDark
                      ? "bg-gray-900 border-gray-800"
                      : "bg-white border-gray-100"
                  }`}
                >
                  {/* Facebook */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleFacebookPress}
                    className={`px-4 py-5 flex-row items-center justify-between border-b ${
                      isDark ? "border-gray-800" : "border-gray-100"
                    }`}
                  >
                    <View className="flex-row items-center gap-3">
                      <Ionicons
                        name="logo-facebook"
                        size={22}
                        color="#1877F2"
                      />
                      <Text
                        className={`text-[16px] font-medium ${
                          isDark ? "text-white" : "text-gray-900"
                        }`}
                      >
                        Facebook
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1.5">
                      <Text
                        className={`text-[14px] ${
                          connectedFacebook
                            ? isDark
                              ? "text-gray-300"
                              : "text-gray-700"
                            : "text-sky-500 font-medium"
                        }`}
                      >
                        {connectedFacebook || "Add"}
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={17}
                        color="#9CA3AF"
                      />
                    </View>
                  </TouchableOpacity>

                  {/* Google / Gmail (Matches Screenshot 2: Google -> Ban Sreypov >) */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleGooglePress}
                    disabled={connectingProvider !== null}
                    className={`px-4 py-5 flex-row items-center justify-between border-b ${
                      isDark ? "border-gray-800" : "border-gray-100"
                    }`}
                  >
                    <View className="flex-row items-center gap-3">
                      <Ionicons name="logo-google" size={22} color="#EA4335" />
                      <Text
                        className={`text-[16px] font-medium ${
                          isDark ? "text-white" : "text-gray-900"
                        }`}
                      >
                        Google
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1.5">
                      {connectingProvider === "google" ? (
                        <ActivityIndicator size="small" color="#EA4335" />
                      ) : (
                        <Text
                          className={`text-[14px] ${
                            connectedGoogle
                              ? isDark
                                ? "text-gray-300"
                                : "text-gray-700"
                              : "text-sky-500 font-medium"
                          }`}
                        >
                          {connectedGoogle || "Add"}
                        </Text>
                      )}
                      <Ionicons
                        name="chevron-forward"
                        size={17}
                        color="#9CA3AF"
                      />
                    </View>
                  </TouchableOpacity>

                  {/* Telegram */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleTelegramPress}
                    disabled={connectingProvider !== null}
                    className={`px-4 py-5 flex-row items-center justify-between border-b ${
                      isDark ? "border-gray-800" : "border-gray-100"
                    }`}
                  >
                    <View className="flex-row items-center gap-3">
                      <Ionicons name="paper-plane" size={19} color="#24A1DE" />
                      <Text
                        className={`text-[16px] font-medium ${
                          isDark ? "text-white" : "text-gray-900"
                        }`}
                      >
                        Telegram
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1.5">
                      {connectingProvider === "telegram" ? (
                        <ActivityIndicator size="small" color="#24A1DE" />
                      ) : (
                        <Text
                          className={`text-[14px] ${
                            connectedTelegram
                              ? isDark
                                ? "text-gray-300"
                                : "text-gray-700"
                              : "text-sky-500 font-medium"
                          }`}
                        >
                          {connectedTelegram || "Add"}
                        </Text>
                      )}
                      <Ionicons
                        name="chevron-forward"
                        size={17}
                        color="#9CA3AF"
                      />
                    </View>
                  </TouchableOpacity>

                  {/* Apple */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleApplePress}
                    className="px-4 py-5 flex-row items-center justify-between"
                  >
                    <View className="flex-row items-center gap-3">
                      <Ionicons
                        name="logo-apple"
                        size={22}
                        color={isDark ? "white" : "black"}
                      />
                      <Text
                        className={`text-[16px] font-medium ${
                          isDark ? "text-white" : "text-gray-900"
                        }`}
                      >
                        Apple
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1.5">
                      <Text
                        className={`text-[14px] ${
                          connectedApple
                            ? isDark
                              ? "text-gray-300"
                              : "text-gray-700"
                            : "text-sky-500 font-medium"
                        }`}
                      >
                        {connectedApple || "Add"}
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={17}
                        color="#9CA3AF"
                      />
                    </View>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* 6. Section: Privacy & Data (Matching Screenshot 2) */}
            <Text className="text-xs text-gray-500 font-normal px-5 mb-2.5">
              Privacy & Data
            </Text>
            <View
              className={`mx-4 mb-5 rounded-2xl border shadow-2xs overflow-hidden ${
                isDark
                  ? "bg-gray-900 border-gray-800"
                  : "bg-white border-gray-100"
              }`}
            >
              {/* Privacy */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push("/account/privacy" as never)}
                className={`px-4 py-5 flex-row items-center justify-between border-b ${
                  isDark ? "border-gray-800" : "border-gray-100"
                }`}
              >
                <View className="flex-row items-center gap-3">
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={22}
                    color={isDark ? "#D1D5DB" : "#374151"}
                  />
                  <Text
                    className={`text-[16px] font-medium ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    Privacy
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color="#9CA3AF" />
              </TouchableOpacity>

              {/* Delete account */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push("/account/delete-account" as never)}
                className="px-4 py-5 flex-row items-center justify-between"
              >
                <View className="flex-row items-center gap-3">
                  <Ionicons
                    name="person-remove-outline"
                    size={22}
                    color={isDark ? "#D1D5DB" : "#374151"}
                  />
                  <Text
                    className={`text-[16px] font-medium ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    Delete account
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {false && (
              <>
                {/* Billing & membership are deferred; mobile has no subscription surface yet. */}
                {/* 7. Section: Billing & Membership (Matching Screenshot 2) */}
                <Text className="text-xs text-gray-500 font-normal px-5 mb-2.5">
                  Billing & Membership
                </Text>
                <View
                  className={`mx-4 mb-5 rounded-2xl border shadow-2xs overflow-hidden ${
                    isDark
                      ? "bg-gray-900 border-gray-800"
                      : "bg-white border-gray-100"
                  }`}
                >
                  {/* Membership Information */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() =>
                      Alert.alert(
                        "Membership Information",
                        `Current Plan: Free Seller Plan\nStatus: Active\nPosting Limit: Free Unlimited`,
                      )
                    }
                    className={`px-4 py-5 flex-row items-center justify-between border-b ${
                      isDark ? "border-gray-800" : "border-gray-100"
                    }`}
                  >
                    <View className="flex-row items-center gap-3">
                      <Ionicons
                        name="ribbon-outline"
                        size={22}
                        color={isDark ? "#D1D5DB" : "#374151"}
                      />
                      <Text
                        className={`text-[16px] font-medium ${
                          isDark ? "text-white" : "text-gray-900"
                        }`}
                      >
                        Membership Information
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={17}
                      color="#9CA3AF"
                    />
                  </TouchableOpacity>

                  {/* Billing Address */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() =>
                      Alert.alert(
                        "Billing Address",
                        `Address: ${user?.location || "Phnom Penh, Cambodia"}`,
                      )
                    }
                    className="px-4 py-5 flex-row items-center justify-between"
                  >
                    <View className="flex-row items-center gap-3">
                      <Ionicons
                        name="receipt-outline"
                        size={22}
                        color={isDark ? "#D1D5DB" : "#374151"}
                      />
                      <Text
                        className={`text-[16px] font-medium ${
                          isDark ? "text-white" : "text-gray-900"
                        }`}
                      >
                        Billing Address
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={17}
                      color="#9CA3AF"
                    />
                  </TouchableOpacity>
                </View>
              </>
            )}
          </>
        )}

        {/* 8. Section: App Setting (Matching Screenshot 3) */}
        <Text className="text-xs text-gray-500 font-normal px-5 mb-2.5">
          App Setting
        </Text>
        <View
          className={`mx-4 mb-5 rounded-2xl border shadow-2xs overflow-hidden ${
            isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"
          }`}
        >
          {/* Language */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setLangModalVisible(true)}
            className={`px-4 py-5 flex-row items-center justify-between border-b ${
              isDark ? "border-gray-800" : "border-gray-100"
            }`}
          >
            <View className="flex-row items-center gap-3">
              <Ionicons
                name="language-outline"
                size={22}
                color={isDark ? "#D1D5DB" : "#374151"}
              />
              <Text
                className={`text-[16px] font-medium ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                Language
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <Text className="text-[14px] text-gray-400">
                {currentLanguageObj.nativeName}
              </Text>
              <Ionicons name="chevron-down" size={17} color="#9CA3AF" />
            </View>
          </TouchableOpacity>

          {/* Theme */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push("/(auth)/theme")}
            className={`px-4 py-5 flex-row items-center justify-between border-b ${
              isDark ? "border-gray-800" : "border-gray-100"
            }`}
          >
            <View className="flex-row items-center gap-3">
              <Ionicons
                name="color-palette-outline"
                size={22}
                color={isDark ? "#D1D5DB" : "#374151"}
              />
              <Text
                className={`text-[16px] font-medium ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                Theme
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Notification */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              setLocalPrefs(preferences);
              setNotifModalVisible(true);
            }}
            className="px-4 py-5 flex-row items-center justify-between"
          >
            <View className="flex-row items-center gap-3">
              <Ionicons
                name="notifications-outline"
                size={22}
                color={isDark ? "#D1D5DB" : "#374151"}
              />
              <Text
                className={`text-[16px] font-medium ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                Notification
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* 9. Section: Support (Matching Screenshot 3 & 4) */}
        <Text className="text-xs text-gray-500 font-normal px-5 mb-2.5">
          Support
        </Text>
        <View
          className={`mx-4 mb-6 rounded-2xl border shadow-2xs overflow-hidden ${
            isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"
          }`}
        >
          {[
            { title: "Our Website", icon: "link-outline" },
            { title: "Posting Rule", icon: "document-text-outline" },
            { title: "Privacy Policy", icon: "shield-outline" },
            { title: "Account Deletion", icon: "person-remove-outline" },
            { title: "Contact Us", icon: "person-circle-outline" },
            { title: "Rate Us", icon: "star-outline" },
            { title: "Safety Tips", icon: "shield-checkmark-outline" },
            { title: "Feedback", icon: "chatbubble-ellipses-outline" },
          ].map((item, index, array) => (
            <TouchableOpacity
              key={item.title}
              activeOpacity={0.7}
              onPress={() => {
                if (item.title === "Contact Us") {
                  router.push("/(auth)/contact-us");
                } else {
                  Alert.alert(
                    item.title,
                    `${item.title} information & details.`,
                  );
                }
              }}
              className={`px-4 py-5 flex-row items-center justify-between ${
                index < array.length - 1
                  ? isDark
                    ? "border-b border-gray-800"
                    : "border-b border-gray-100"
                  : ""
              }`}
            >
              <View className="flex-row items-center gap-3">
                <Ionicons
                  name={item.icon as any}
                  size={22}
                  color={isDark ? "#D1D5DB" : "#374151"}
                />
                <Text
                  className={`text-[16px] font-medium ${
                    isDark ? "text-white" : "text-gray-900"
                  }`}
                >
                  {item.title}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </View>

        {/* 10. Logout Button (Matching Screenshot 4) */}
        {isAuthenticated && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleLogoutPress}
            className={`mx-4 py-3.5 rounded-2xl items-center justify-center border shadow-2xs mb-6 ${
              isDark
                ? "bg-gray-900 border-gray-800"
                : "bg-white border-gray-100"
            }`}
          >
            <Text className="font-semibold text-base text-rose-500">
              Logout
            </Text>
          </TouchableOpacity>
        )}

        {/* 11. Dynamic Device & IP Footer Info */}
        <AppFooterDeviceInfo
          username={isAuthenticated ? displayUsername : undefined}
          className="items-center pb-8 gap-0.5"
          textClassName="text-gray-400 text-xs font-normal text-center"
        />
      </ScrollView>

      {/* Language Selector Modal */}
      <BottomSheet
        visible={langModalVisible}
        onClose={() => setLangModalVisible(false)}
      >
        <View className={`p-5 gap-4 ${isDark ? "bg-gray-900" : "bg-white"}`}>
          <View
            className={`flex-row items-center justify-between border-b pb-3 ${
              isDark ? "border-gray-800" : "border-neutral-border"
            }`}
          >
            <Text
              className={`text-base font-bold ${
                isDark ? "text-white" : "text-neutral-text-main"
              }`}
            >
              {t("selectLanguage")}
            </Text>
            <TouchableOpacity onPress={() => setLangModalVisible(false)}>
              <Ionicons
                name="close"
                size={24}
                color={isDark ? "white" : Colors.text.primary}
              />
            </TouchableOpacity>
          </View>

          <View className="gap-2 py-2">
            {LANGUAGES.map((lang) => {
              const isSelected = language === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  onPress={() => handleSelectLanguage(lang.code)}
                  className={`flex-row items-center justify-between p-4 rounded-2xl border ${
                    isSelected
                      ? "border-primary bg-primary/10"
                      : isDark
                        ? "border-gray-800 bg-gray-800"
                        : "border-neutral-border bg-neutral-background"
                  }`}
                >
                  <View className="flex-row items-center gap-3">
                    <Image
                      source={lang.flag}
                      className="w-8 h-8 rounded-full"
                      resizeMode="contain"
                    />
                    <View>
                      <Text
                        className={`text-base font-bold ${
                          isDark ? "text-white" : "text-neutral-text-main"
                        }`}
                      >
                        {lang.nativeName}
                      </Text>
                      <Text className="text-xs text-neutral-text-sub">
                        {lang.name}
                      </Text>
                    </View>
                  </View>

                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={Colors.primary.DEFAULT}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </BottomSheet>

      {/* Notification Settings Modal */}
      <BottomSheet
        visible={notifModalVisible}
        onClose={() => setNotifModalVisible(false)}
      >
        <View className={`p-5 ${isDark ? "bg-gray-900" : "bg-white"}`}>
          <View
            className={`flex-row items-center justify-between pb-3 border-b ${
              isDark ? "border-gray-800" : "border-neutral-border"
            }`}
          >
            <View>
              <Text
                className={`text-lg font-bold ${
                  isDark ? "text-white" : "text-neutral-text-main"
                }`}
              >
                Notification Settings
              </Text>
              <Text
                className={`text-xs ${
                  isDark ? "text-gray-400" : "text-neutral-text-sub"
                }`}
              >
                Configure your alert preferences
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setNotifModalVisible(false)}
              className="p-1"
            >
              <Ionicons
                name="close"
                size={24}
                color={isDark ? "white" : Colors.text.primary}
              />
            </TouchableOpacity>
          </View>

          <ScrollView className="max-h-[380px] my-3">
            {[
              {
                key: "pushEnabled",
                title: "Push Notifications",
                subtitle: "Enable all push alerts from PhsarKhmer",
                icon: "notifications",
              },
              {
                key: "priceDropAlerts",
                title: "Price Drop Alerts",
                subtitle: "Alerts when saved item prices drop",
                icon: "trending-down",
              },
              {
                key: "chatMessages",
                title: "Chat & Buyer Inquiries",
                subtitle: "Alerts for new buyer/seller messages",
                icon: "chatbubbles",
              },
              {
                key: "adStatusUpdates",
                title: "Listing Status & Expiry",
                subtitle: "Ad approvals, bumps, and expiry alerts",
                icon: "megaphone",
              },
              {
                key: "promotionsAndDeals",
                title: "Promotions & Discounts",
                subtitle: "Exclusive deals and marketing discounts",
                icon: "pricetag",
              },
              {
                key: "soundEnabled",
                title: "Notification Sound",
                subtitle: "Play sound when alert arrives",
                icon: "volume-high",
              },
            ].map((item) => (
              <View
                key={item.key}
                className={`flex-row items-center justify-between py-3 border-b ${
                  isDark ? "border-gray-800/80" : "border-neutral-border/60"
                }`}
              >
                <View className="flex-row items-center gap-3 flex-1 pr-3">
                  <View
                    className={`w-9 h-9 rounded-xl items-center justify-center ${
                      isDark ? "bg-gray-800" : "bg-sky-50"
                    }`}
                  >
                    <Ionicons
                      name={item.icon as any}
                      size={18}
                      color={Colors.primary.DEFAULT}
                    />
                  </View>
                  <View className="flex-1">
                    <Text
                      className={`text-sm font-semibold ${
                        isDark ? "text-white" : "text-neutral-text-main"
                      }`}
                    >
                      {item.title}
                    </Text>
                    <Text
                      className={`text-[11px] ${
                        isDark ? "text-gray-400" : "text-neutral-text-sub"
                      }`}
                    >
                      {item.subtitle}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={
                    localPrefs[item.key as keyof typeof localPrefs] as boolean
                  }
                  onValueChange={(val) =>
                    setLocalPrefs((prev) => ({
                      ...prev,
                      [item.key]: val,
                    }))
                  }
                  trackColor={{
                    false: isDark ? "#374151" : "#E5E7EB",
                    true: Colors.primary.DEFAULT,
                  }}
                  thumbColor="white"
                />
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity
            onPress={() => {
              updatePreferences(localPrefs);
              setNotifModalVisible(false);
              Alert.alert(
                "Saved",
                "Your notification preferences have been updated.",
              );
            }}
            className="bg-primary py-3.5 rounded-2xl items-center justify-center mt-2 shadow-sm"
          >
            <Text className="text-white text-base font-bold">
              Save Preferences
            </Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* Edit Username Modal */}
      <Modal
        visible={editUsernameVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEditUsernameVisible(false)}
      >
        <View className="flex-1 bg-black/60 items-center justify-center px-6">
          <View
            className={`w-full max-w-sm rounded-3xl p-6 ${
              isDark ? "bg-gray-900" : "bg-white"
            }`}
          >
            <Text
              className={`text-lg font-bold mb-1 ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              Update Username
            </Text>
            <Text className="text-xs text-gray-400 mb-4">
              Enter your public handle on PhsarKhmer
            </Text>

            <View
              className={`flex-row items-center border rounded-xl px-3 py-2.5 mb-4 ${
                isDark
                  ? "border-gray-700 bg-gray-800"
                  : "border-gray-200 bg-gray-50"
              }`}
            >
              <Text className="text-gray-400 font-bold mr-1">@</Text>
              <TextInput
                value={newUsername}
                onChangeText={setNewUsername}
                autoCapitalize="none"
                className={`flex-1 font-medium ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
                placeholder="username"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setEditUsernameVisible(false)}
                className={`flex-1 py-3 rounded-xl items-center border ${
                  isDark ? "border-gray-700" : "border-gray-200"
                }`}
              >
                <Text className={isDark ? "text-gray-300" : "text-gray-700"}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (newUsername.trim()) {
                    updateUser({
                      username: newUsername
                        .trim()
                        .toLowerCase()
                        .replace(/^@/, ""),
                    });
                    setEditUsernameVisible(false);
                    Alert.alert("Updated", "Username updated successfully.");
                  }
                }}
                className="flex-1 py-3 rounded-xl items-center bg-primary"
              >
                <Text className="text-white font-bold">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Phone Modal */}
      <Modal
        visible={editPhoneVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEditPhoneVisible(false)}
      >
        <View className="flex-1 bg-black/60 items-center justify-center px-6">
          <View
            className={`w-full max-w-sm rounded-3xl p-6 ${
              isDark ? "bg-gray-900" : "bg-white"
            }`}
          >
            <Text
              className={`text-lg font-bold mb-1 ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              Activate Phone
            </Text>
            <Text className="text-xs text-gray-400 mb-4">
              Enter verified phone number for listing contact & SMS alerts
            </Text>

            <View
              className={`flex-row items-center border rounded-xl px-3 py-2.5 mb-4 ${
                isDark
                  ? "border-gray-700 bg-gray-800"
                  : "border-gray-200 bg-gray-50"
              }`}
            >
              <Ionicons
                name="call-outline"
                size={18}
                color="#9CA3AF"
                className="mr-2"
              />
              <TextInput
                value={newPhone}
                onChangeText={setNewPhone}
                keyboardType="phone-pad"
                className={`flex-1 font-medium ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
                placeholder="012 345 678"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setEditPhoneVisible(false)}
                className={`flex-1 py-3 rounded-xl items-center border ${
                  isDark ? "border-gray-700" : "border-gray-200"
                }`}
              >
                <Text className={isDark ? "text-gray-300" : "text-gray-700"}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (newPhone.trim()) {
                    updateUser({ phone: newPhone.trim() });
                    setEditPhoneVisible(false);
                    Alert.alert(
                      "Verified",
                      "Phone number updated & activated.",
                    );
                  }
                }}
                className="flex-1 py-3 rounded-xl items-center bg-primary"
              >
                <Text className="text-white font-bold">Activate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        visible={changePasswordVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setChangePasswordVisible(false)}
      >
        <View className="flex-1 bg-black/60 items-center justify-center px-6">
          <View
            className={`w-full max-w-sm rounded-3xl p-6 ${
              isDark ? "bg-gray-900" : "bg-white"
            }`}
          >
            <Text
              className={`text-lg font-bold mb-1 ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              Change Password
            </Text>
            <Text className="text-xs text-gray-400 mb-4">
              Enter your current password and a new secure password
            </Text>

            <View
              className={`border rounded-xl px-3 py-2.5 mb-3 ${
                isDark
                  ? "border-gray-700 bg-gray-800"
                  : "border-gray-200 bg-gray-50"
              }`}
            >
              <TextInput
                value={oldPassword}
                onChangeText={setOldPassword}
                secureTextEntry
                className={`font-medium ${isDark ? "text-white" : "text-gray-900"}`}
                placeholder="Current Password"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View
              className={`border rounded-xl px-3 py-2.5 mb-4 ${
                isDark
                  ? "border-gray-700 bg-gray-800"
                  : "border-gray-200 bg-gray-50"
              }`}
            >
              <TextInput
                value={nextPassword}
                onChangeText={setNextPassword}
                secureTextEntry
                className={`font-medium ${isDark ? "text-white" : "text-gray-900"}`}
                placeholder="New Password (min 4 chars)"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setChangePasswordVisible(false)}
                className={`flex-1 py-3 rounded-xl items-center border ${
                  isDark ? "border-gray-700" : "border-gray-200"
                }`}
              >
                <Text className={isDark ? "text-gray-300" : "text-gray-700"}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (nextPassword.length >= 4) {
                    setChangePasswordVisible(false);
                    Alert.alert("Success", "Password changed successfully.");
                  } else {
                    Alert.alert(
                      "Error",
                      "Password must be at least 4 characters.",
                    );
                  }
                }}
                className="flex-1 py-3 rounded-xl items-center bg-primary"
              >
                <Text className="text-white font-bold">Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default SettingsScreen;
