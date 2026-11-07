import { Colors } from "@/constants/Colors";
import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface ActionSheetOption {
  id: string;
  name: string;
}

interface ActionSheetProps {
  visible: boolean;
  options: ActionSheetOption[];
  onSelect: (option: ActionSheetOption) => void;
  onClose: () => void;
}

/**
 * iOS-style action sheet used for the short choice lists (Education Level,
 * Degree, Skill/Language level). The options sit in one rounded white panel
 * and Cancel is a separate panel below it, over a dimmed backdrop.
 */
export default function ActionSheet({
  visible,
  options,
  onSelect,
  onClose,
}: ActionSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View
        className="flex-1 justify-end bg-black/40"
        style={{ paddingBottom: insets.bottom + 8 }}
      >
        <Pressable className="absolute inset-0" onPress={onClose} />

        <View className="mx-3 overflow-hidden rounded-2xl bg-white">
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: 420 }}
          >
            {options.map((option, index) => (
              <TouchableOpacity
                key={option.id}
                onPress={() => onSelect(option)}
                activeOpacity={0.7}
                className={`h-14 items-center justify-center ${
                  index < options.length - 1 ? "border-b border-gray-200" : ""
                }`}
                accessibilityRole="button"
                accessibilityLabel={option.name}
              >
                <Text className="text-lg text-gray-900">{option.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View className="mx-3 mt-2 overflow-hidden rounded-2xl bg-white">
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.7}
            className="h-14 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text
              className="text-lg font-semibold"
              style={{ color: Colors.primary.DEFAULT }}
            >
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
