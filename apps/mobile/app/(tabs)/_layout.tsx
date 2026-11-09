import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNotification } from "@/contexts/NotificationContext";
import { NEXT_SELL } from "@/lib/auth-redirect";
import { Ionicons } from "@expo/vector-icons";
import { router, Tabs } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import type { ColorValue, OpaqueColorValue } from "react-native";

/** React Navigation types the tab tint as `ColorValue` (string | opaque color),
 * while the icon fonts only accept strings or opaque platform colors. The tint
 * is resolved from `tabBarActiveTintColor`/`tabBarInactiveTintColor`, so it is
 * always a string here. */
const toIconColor = (
  color: ColorValue,
): string | OpaqueColorValue | undefined =>
  typeof color === "string" || typeof color === "symbol" ? color : undefined;

const SellTabBarButton = ({ label, canOpen }: any) => {
  const openPostFlow = () => {
    if (!canOpen) {
      router.push("/(auth)/welcome");
      return;
    }
    router.push("/account/choose-category" as never);
  };

  return (
    <TouchableOpacity
      style={{
        top: -16,
        justifyContent: "center",
        alignItems: "center",
      }}
      onPress={openPostFlow}
      activeOpacity={0.85}
    >
      <View
        className="w-[68px] h-[68px] rounded-full items-center justify-center p-1 bg-white dark:bg-gray-900"
        style={{
          elevation: 8,
          shadowColor: "#F97316",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 10,
        }}
      >
        <LinearGradient
          colors={["#FB923C", "#F97316", "#EA580C"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="w-full h-full rounded-full items-center justify-center border border-white/40"
        >
          <View className="items-center justify-center">
            <Ionicons name="camera" size={24} color="white" />
            <View style={{ position: "absolute", top: -4, right: -6 }}>
              <Ionicons name="add-circle" size={14} color="white" />
            </View>
            <Text className="text-white text-[9px] font-black tracking-wider uppercase mt-0.5">
              {label || "Sell"}
            </Text>
          </View>
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );
};

const TabsLayout = () => {
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const { unreadCount } = useNotification();

  const createProtectedTabListener = (navigation: any) => ({
    tabPress: (e: any) => {
      if (!isAuthenticated) {
        e.preventDefault();
        navigation.navigate("(auth)", { screen: "welcome" });
      }
    },
  });

  /** A guest tapping Sell signs in first, then lands on the category chooser. */
  const sellTabListener = (navigation: any) => ({
    tabPress: (e: any) => {
      if (!isAuthenticated) {
        e.preventDefault();
        navigation.navigate("(auth)", {
          screen: "welcome",
          params: { next: NEXT_SELL },
        });
      }
    },
  });

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: "#0EA5E9",
        tabBarInactiveTintColor: "#6B7280",
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          marginTop: -2,
          paddingBottom: 4,
        },
        tabBarStyle: {
          height: 64,
          paddingBottom: 6,
          paddingTop: 6,
          borderTopWidth: 1,
          borderTopColor: "rgba(229, 231, 235, 0.8)",
          backgroundColor: "#FFFFFF",
          elevation: 12,
          shadowColor: "#0F172A",
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.05,
          shadowRadius: 10,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("home"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={22}
              color={toIconColor(color)}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="notification"
        listeners={({ navigation }) => createProtectedTabListener(navigation)}
        options={{
          title: "Notification",
          tabBarBadge:
            isAuthenticated && unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: "#EF4444",
            color: "white",
            fontSize: 9,
            fontWeight: "bold",
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            lineHeight: 16,
          },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "notifications" : "notifications-outline"}
              size={24}
              color={toIconColor(color)}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="sell"
        listeners={({ navigation }) => sellTabListener(navigation)}
        options={{
          title: t("sell"),
          tabBarButton: (props) => (
            <SellTabBarButton
              {...props}
              label={t("sell")}
              canOpen={isAuthenticated}
            />
          ),
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="chat"
        listeners={({ navigation }) => createProtectedTabListener(navigation)}
        options={{
          title: t("chat"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={
                focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"
              }
              size={22}
              color={toIconColor(color)}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        listeners={({ navigation }) => createProtectedTabListener(navigation)}
        options={{
          title: t("account"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={22}
              color={toIconColor(color)}
            />
          ),
        }}
      />
    </Tabs>
  );
};

export default TabsLayout;
