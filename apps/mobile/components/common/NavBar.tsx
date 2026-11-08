import BottomSheet from "@/components/common/BottomSheet";
import { LANGUAGES, useLanguage } from "@/contexts/LanguageContext";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Image,
  ImageSourcePropType,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";

interface NavBarProps {
  onThemeToggle?: () => void;
  onLanguageChange?: () => void;
  onQRCodePress?: () => void;
  onSearchPress?: () => void;
  logoSource?: ImageSourcePropType;
}

const NavBar: React.FC<NavBarProps> = ({
  onThemeToggle,
  onLanguageChange,
  onQRCodePress,
  onSearchPress,
  logoSource,
}) => {
  const scheme = useColorScheme();
  const iconColor = scheme === "dark" ? "#E5E7EB" : "#374151";
  const { language, setLanguage, currentLanguageObj, t } = useLanguage();
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <View className="bg-white dark:bg-gray-900 px-4 h-16 flex-row items-center justify-between border-b border-gray-100 dark:border-gray-800">
      {/* PhsarKhmer wordmark — same treatment as the web BrandWordmark. */}
      <View className="flex-row items-center">
        <Text className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">
          Phsar<Text style={{ color: "#00A0E9" }}>Khmer</Text>
        </Text>
      </View>

      {/* Header Actions */}
      <View className="flex-row items-center gap-2.5">
        {onThemeToggle ? (
          <TouchableOpacity
            className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-800 items-center justify-center border border-gray-200/60 dark:border-gray-700/60"
            onPress={onThemeToggle}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Toggle light and dark mode"
          >
            <Ionicons
              name={scheme === "dark" ? "sunny-outline" : "moon-outline"}
              size={20}
              color={iconColor}
            />
          </TouchableOpacity>
        ) : null}

        {/* Language selector — the flag alone, matching the icon buttons. */}
        <TouchableOpacity
          className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-800 items-center justify-center border border-gray-200/60 dark:border-gray-700/60"
          onPress={() => setModalVisible(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Change language, current: ${currentLanguageObj.name}`}
        >
          <View className="w-6 h-6 rounded-full overflow-hidden border border-gray-300 dark:border-gray-600 items-center justify-center">
            <Image
              source={currentLanguageObj.flag}
              className="w-full h-full"
              resizeMode="cover"
            />
          </View>
        </TouchableOpacity>

        {/* QR scanning is deferred (no web counterpart): hidden without a handler. */}
        {onQRCodePress ? (
          <TouchableOpacity
            className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-800 items-center justify-center border border-gray-200/60 dark:border-gray-700/60"
            onPress={onQRCodePress}
            activeOpacity={0.7}
          >
            <Ionicons name="qr-code-outline" size={20} color={iconColor} />
          </TouchableOpacity>
        ) : null}

        {/* Search Action Button */}
        <TouchableOpacity
          className="w-10 h-10 rounded-full bg-sky-50 dark:bg-sky-950/40 items-center justify-center border border-sky-100 dark:border-sky-900/60"
          onPress={onSearchPress}
          activeOpacity={0.7}
        >
          <Ionicons name="search" size={20} color="#0EA5E9" />
        </TouchableOpacity>
      </View>

      {/* Change Language Sheet — shared fade/slide, not Modal's overlay slide. */}
      <BottomSheet
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      >
        <View className="bg-white px-5 pb-8 pt-3 dark:bg-gray-900">
          {/* Grab Bar */}
          <View className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-300 dark:bg-gray-700" />

          {/* Header Row */}
          <View className="mb-2 flex-row items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
            <Text className="text-lg font-bold text-gray-900 dark:text-white">
              {t("selectLanguage") || "Change Language"}
            </Text>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              className="h-8 w-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800"
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={18} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Language List */}
          <View className="py-1">
            {LANGUAGES.map((lang) => {
              const isSelected = language === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  onPress={() => {
                    setLanguage(lang.code);
                    setModalVisible(false);
                    onLanguageChange?.();
                  }}
                  className={`mb-1 flex-row items-center justify-between rounded-xl px-3 py-3.5 ${
                    isSelected
                      ? "border border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/40"
                      : "bg-transparent"
                  }`}
                  activeOpacity={0.7}
                >
                  {/* Left Flag + Name */}
                  <View className="flex-row items-center gap-3">
                    <View className="h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-gray-200 dark:border-gray-700">
                      <Image
                        source={lang.flag}
                        className="h-full w-full"
                        resizeMode="cover"
                      />
                    </View>
                    <View>
                      <Text
                        className={`text-base ${
                          isSelected
                            ? "font-bold text-sky-600 dark:text-sky-400"
                            : "font-medium text-gray-900 dark:text-gray-100"
                        }`}
                      >
                        {lang.nativeName}
                      </Text>
                      <Text className="text-xs text-gray-400">{lang.name}</Text>
                    </View>
                  </View>

                  {/* Right Checkmark or Radio */}
                  <View
                    className={`h-6 w-6 items-center justify-center rounded-full border-2 ${
                      isSelected
                        ? "border-sky-500 bg-sky-500"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                  >
                    {isSelected && (
                      <Ionicons name="checkmark" size={14} color="white" />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </BottomSheet>
    </View>
  );
};

export default NavBar;
