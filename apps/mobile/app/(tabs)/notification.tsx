import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  AppNotification,
  useNotification,
} from "@/contexts/NotificationContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const NotificationScreen = () => {
  const router = useRouter();
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const {
    notifications,
    isLoading,
    hasMore,
    refresh,
    loadMore,
    markAsRead,
    markAllAsRead,
    clearAll,
    preferences,
    updatePreferences,
  } = useNotification();

  const [menuOpen, setMenuOpen] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [localPrefs, setLocalPrefs] = useState(preferences);

  // No push channel exists: re-read the feed whenever the tab regains focus.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const handleNotificationPress = (notif: AppNotification) => {
    markAsRead(notif.id);
    if (notif.actionRoute) {
      router.push(notif.actionRoute as never);
    }
  };

  const confirmClearAll = () => {
    Alert.alert(
      "Delete all notifications",
      "Are you sure you want to remove all notifications?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete all",
          style: "destructive",
          onPress: () => clearAll(),
        },
      ],
    );
  };

  const openSettings = () => {
    setLocalPrefs(preferences);
    setShowSettingsModal(true);
  };

  return (
    <SafeAreaView
      statusBarColor={Colors.primary.DEFAULT}
      statusBarStyle="light-content"
      className={isDark ? "flex-1 bg-gray-950" : "flex-1 bg-neutral-background"}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between bg-primary px-4 py-3">
        <Text className="text-xl font-bold text-white">
          {t("notification")}
        </Text>
        <TouchableOpacity
          onPress={() => setMenuOpen(true)}
          className="p-1"
          accessibilityRole="button"
          accessibilityLabel="Notification options"
        >
          <Ionicons name="ellipsis-vertical" size={22} color="white" />
        </TouchableOpacity>
      </View>

      {/* List — the rows sit on white, the space below stays page-gray */}
      <ScrollView
        className={
          isDark ? "flex-1 bg-gray-950" : "flex-1 bg-neutral-background"
        }
        showsVerticalScrollIndicator={false}
      >
        {notifications.length === 0 ? (
          <View className="flex-1 items-center justify-center px-6 py-16">
            <View
              className={`h-16 w-16 items-center justify-center rounded-full ${
                isDark ? "bg-gray-800" : "bg-gray-200"
              }`}
            >
              <Ionicons
                name="notifications-outline"
                size={30}
                color={isDark ? "#9CA3AF" : "#6B7280"}
              />
            </View>
            <Text
              className={`mt-3 text-base ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              {t("noNotificationsYet")}
            </Text>
          </View>
        ) : (
          <View className={isDark ? "bg-gray-900" : "bg-white"}>
            {notifications.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => handleNotificationPress(item)}
                activeOpacity={0.75}
                className={`flex-row border-b px-4 py-3.5 ${
                  isDark ? "border-gray-800" : "border-gray-100"
                }`}
              >
                <View
                  className={`mr-3 h-12 w-12 items-center justify-center rounded-full ${
                    isDark ? "bg-gray-800" : "bg-gray-100"
                  }`}
                >
                  <Ionicons name="notifications" size={22} color="#9CA3AF" />
                </View>
                <View className="flex-1">
                  <Text
                    className={`text-base leading-6 ${
                      item.isRead
                        ? "text-gray-900 dark:text-gray-200"
                        : "font-semibold text-gray-900 dark:text-white"
                    }`}
                    numberOfLines={2}
                  >
                    {item.description || item.title}
                  </Text>
                  <Text className="mt-1 text-xs text-gray-400">
                    {item.timestamp}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}

            {hasMore ? (
              <View className="items-center py-5">
                <TouchableOpacity
                  onPress={() => void loadMore()}
                  disabled={isLoading}
                  className="rounded-xl border border-primary px-6 py-2.5"
                >
                  {isLoading ? (
                    <ActivityIndicator color={Colors.primary.DEFAULT} />
                  ) : (
                    <Text className="font-bold text-primary">
                      {t("loadMore")}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* 3-dot action sheet */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuOpen(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setMenuOpen(false)}
          className="flex-1 justify-end bg-black/40 p-4"
        >
          <View
            className={`overflow-hidden rounded-2xl ${
              isDark ? "bg-gray-900" : "bg-white"
            }`}
          >
            <TouchableOpacity
              onPress={() => {
                setMenuOpen(false);
                markAllAsRead();
              }}
              className={`items-center border-b py-4 ${
                isDark ? "border-gray-800" : "border-gray-200/70"
              }`}
            >
              <Text className="text-base font-medium text-primary">
                {t("markAllRead")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setMenuOpen(false);
                confirmClearAll();
              }}
              className={`items-center border-b py-4 ${
                isDark ? "border-gray-800" : "border-gray-200/70"
              }`}
            >
              <Text className="text-base font-medium text-primary">
                {t("deleteAllNotifications")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setMenuOpen(false);
                openSettings();
              }}
              className="items-center py-4"
            >
              <Text className="text-base font-medium text-primary">
                {t("notificationSettings")}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => setMenuOpen(false)}
            className={`mt-2 items-center rounded-2xl py-4 ${
              isDark ? "bg-gray-900" : "bg-white"
            }`}
          >
            <Text className="text-base font-semibold text-gray-500">
              {t("cancel")}
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Notification Preferences Settings Modal */}
      <Modal
        visible={showSettingsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <View className="flex-1 justify-end bg-black/60">
          <View
            className={`rounded-t-3xl p-5 ${
              isDark ? "bg-gray-900" : "bg-white"
            }`}
          >
            <View
              className={`flex-row items-center justify-between border-b pb-3 ${
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
                  Customize and edit what alerts you receive
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowSettingsModal(false)}
                className="p-1"
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={isDark ? "white" : Colors.text.primary}
                />
              </TouchableOpacity>
            </View>

            <ScrollView className="my-3 max-h-[380px]">
              {[
                {
                  key: "pushEnabled",
                  title: "Push Notifications",
                  subtitle: "Enable all mobile push alerts from PhsarKhmer",
                  icon: "notifications",
                },
                {
                  key: "priceDropAlerts",
                  title: "Price Drop Alerts",
                  subtitle: "Get notified when saved listing prices decrease",
                  icon: "trending-down",
                },
                {
                  key: "chatMessages",
                  title: "Chat & Buyer Inquiries",
                  subtitle:
                    "Instant alerts for new messages from buyers/sellers",
                  icon: "chatbubbles",
                },
                {
                  key: "adStatusUpdates",
                  title: "Listing Status & Expiry",
                  subtitle: "Ad approval status, bumps, and expiry alerts",
                  icon: "megaphone",
                },
                {
                  key: "promotionsAndDeals",
                  title: "Promotions & Discounts",
                  subtitle: "Special holiday bumps and marketplace offers",
                  icon: "pricetag",
                },
                {
                  key: "soundEnabled",
                  title: "Notification Sound",
                  subtitle: "Play sound when receiving new alerts",
                  icon: "volume-high",
                },
              ].map((item) => (
                <View
                  key={item.key}
                  className={`flex-row items-center justify-between border-b py-3 ${
                    isDark ? "border-gray-800/80" : "border-neutral-border/60"
                  }`}
                >
                  <View className="flex-1 flex-row items-center gap-3 pr-3">
                    <View
                      className={`h-9 w-9 items-center justify-center rounded-xl ${
                        isDark ? "bg-gray-800" : "bg-sky-50"
                      }`}
                    >
                      <Ionicons
                        name={item.icon as never}
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
                        className={`text-[11px] leading-3.5 ${
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
                      setLocalPrefs((prev) => ({ ...prev, [item.key]: val }))
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
                setShowSettingsModal(false);
                Alert.alert(
                  "Preferences Saved",
                  "Your notification settings have been updated.",
                );
              }}
              className="mt-2 items-center justify-center rounded-2xl bg-primary py-3.5 shadow-sm"
            >
              <Text className="text-base font-bold text-white">
                Save Preferences
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default NotificationScreen;
