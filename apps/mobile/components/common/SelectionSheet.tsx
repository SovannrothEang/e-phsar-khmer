import BottomSheet from "@/components/common/BottomSheet";
import { Colors } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface SheetOption {
  id: string;
  name: string;
  /** Storage URL; when any option carries one, every row keeps an icon slot. */
  image?: string | null;
}

interface SelectionSheetProps {
  visible: boolean;
  title: string;
  options: SheetOption[];
  value?: string;
  onSelect: (option: SheetOption) => void;
  /** Renders the header Clear action; omit when the field cannot be emptied. */
  onClear?: () => void;
  onClose: () => void;
  /** Renders a back chevron (picker wizard steps) instead of the close X. */
  onBack?: () => void;
  loading?: boolean;
  emptyLabel?: string;
  /** Filter sheets hide the search field (reference status/type/sort sheets). */
  searchable?: boolean;
  /** Sizes the sheet to its rows instead of the 90% height. */
  compact?: boolean;
  /**
   * Row-end marker: the filled check of the location pickers, or the radio
   * pair of the reference's Sort/Date sheets (every row gets a circle).
   */
  indicator?: "check" | "radio";
  /**
   * Hides the leading icon slot even when some options carry an image. Used
   * by lists whose rows have no artwork (the furniture Type sheet), where the
   * initial-letter fallback would be noise.
   */
  showIcons?: boolean;
}

/**
 * Bottom sheet matching the reference post form: close/back, centred title,
 * Clear, a large search field and (optionally) icon rows. The panel slides up
 * over a backdrop that fades in behind it.
 */
export default function SelectionSheet({
  visible,
  title,
  options,
  value,
  onSelect,
  onClear,
  onClose,
  onBack,
  loading = false,
  emptyLabel,
  searchable = true,
  compact = false,
  indicator = "check",
  showIcons = true,
}: SelectionSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = Math.round(windowHeight * 0.9);
  const [search, setSearch] = useState("");
  const [prevOpen, setPrevOpen] = useState({ visible, title });

  // Each wizard step opens with a fresh search. Adjusting state during render
  // is the supported pattern; an effect caused cascading renders.
  if (prevOpen.visible !== visible || prevOpen.title !== title) {
    setPrevOpen({ visible, title });
    if (visible) setSearch("");
  }

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) =>
      option.name.toLowerCase().includes(needle),
    );
  }, [options, search]);

  const withIcons = showIcons && options.some((option) => !!option.image);

  const listBody = loading ? (
    <View className="items-center py-12">
      <ActivityIndicator color={Colors.primary.DEFAULT} />
    </View>
  ) : filtered.length === 0 ? (
    <Text className="px-4 py-12 text-center text-sm text-gray-400">
      {emptyLabel ?? "No options"}
    </Text>
  ) : (
    filtered.map((option) => {
      const selected = option.id === value;
      return (
        <TouchableOpacity
          key={option.id}
          onPress={() => onSelect(option)}
          activeOpacity={0.7}
          className="flex-row items-center border-b border-gray-100 px-4 py-4"
        >
          {withIcons ? (
            <View className="mr-4 h-11 w-11 items-center justify-center rounded-full bg-gray-50">
              {option.image ? (
                <Image
                  source={{ uri: option.image }}
                  className="h-9 w-9"
                  resizeMode="contain"
                />
              ) : (
                <Text className="text-sm font-bold text-gray-500">
                  {option.name.charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
          ) : null}
          <Text className="flex-1 text-lg text-gray-900">{option.name}</Text>
          {indicator === "radio" ? (
            <View
              className={`ml-3 h-6 w-6 items-center justify-center rounded-full border-2 ${
                selected ? "border-primary" : "border-gray-300"
              }`}
            >
              {selected ? (
                <View className="h-3 w-3 rounded-full bg-primary" />
              ) : null}
            </View>
          ) : selected ? (
            <View className="ml-3 h-6 w-6 items-center justify-center rounded-full bg-primary">
              <Ionicons name="checkmark" size={16} color="white" />
            </View>
          ) : null}
        </TouchableOpacity>
      );
    })
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      height={compact ? undefined : sheetHeight}
    >
      {/* Keeps the search field and the focused row above the keyboard. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={compact ? undefined : { flex: 1 }}
      >
        <View className={compact ? "" : "flex-1"}>
          <View className="flex-row items-center justify-between px-4 pb-1 pt-4">
            {onBack ? (
              <TouchableOpacity
                onPress={onBack}
                className="h-10 w-10 items-center justify-center"
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <Ionicons
                  name="chevron-back"
                  size={26}
                  color={Colors.primary.DEFAULT}
                />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={onClose}
                className="h-10 w-10 items-center justify-center rounded-full bg-gray-100"
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={20} color="#4B5563" />
              </TouchableOpacity>
            )}

            <View
              pointerEvents="none"
              className="absolute bottom-0 left-0 right-0 top-0 items-center justify-center"
            >
              <Text className="text-xl font-bold text-gray-900">{title}</Text>
            </View>

            {onClear ? (
              <TouchableOpacity
                onPress={onClear}
                className="px-1 py-2"
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Clear ${title}`}
              >
                <Text className="text-base font-medium text-primary">
                  Clear
                </Text>
              </TouchableOpacity>
            ) : (
              <View className="h-10 w-10" />
            )}
          </View>

          {searchable ? (
            <>
              <View className="px-4 py-3">
                <View className="h-14 flex-row items-center rounded-[4px] bg-gray-100 px-4">
                  <Ionicons name="search" size={22} color="#8E8E93" />
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search"
                    placeholderTextColor="#8E8E93"
                    autoCorrect={false}
                    className="ml-2 flex-1 p-0 text-lg text-gray-900"
                  />
                  {search.length > 0 ? (
                    <TouchableOpacity
                      onPress={() => setSearch("")}
                      accessibilityRole="button"
                      accessibilityLabel="Clear search"
                    >
                      <Ionicons name="close-circle" size={20} color="#C7C7CC" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              <View className="h-px w-full bg-gray-100" />
            </>
          ) : null}

          {compact ? (
            <View style={{ paddingBottom: insets.bottom + 8 }}>{listBody}</View>
          ) : (
            <ScrollView
              key={title}
              className="flex-1"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            >
              {listBody}
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}
