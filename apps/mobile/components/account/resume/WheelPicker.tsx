import BottomSheet from "@/components/common/BottomSheet";
import { Colors } from "@/constants/Colors";
import React, { useEffect, useRef } from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface WheelOption {
  id: string;
  name: string;
}

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 7;
export const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const VERTICAL_PADDING = (WHEEL_HEIGHT - ITEM_HEIGHT) / 2;

interface WheelColumnProps {
  options: WheelOption[];
  value: string;
  onChange: (value: string) => void;
  flex?: number;
}

/** One snapping wheel column with the reference's rounded selected row. */
export function WheelColumn({
  options,
  value,
  onChange,
  flex = 1,
}: WheelColumnProps) {
  const ref = useRef<ScrollViewInstance>(null);
  const index = Math.max(
    0,
    options.findIndex((option) => option.id === value),
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      ref.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: false });
    }, 0);
    return () => clearTimeout(timer);
  }, [index, options.length]);

  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(options.length - 1, next));
    const option = options[clamped];
    if (!option) return;
    if (option.id !== value) onChange(option.id);
    ref.current?.scrollTo({ y: clamped * ITEM_HEIGHT, animated: true });
  };

  return (
    <View style={{ flex, height: WHEEL_HEIGHT }} className="relative">
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: VERTICAL_PADDING,
          left: 4,
          right: 4,
          height: ITEM_HEIGHT,
        }}
        className="rounded-lg bg-[#F2F2F7]"
      />

      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: VERTICAL_PADDING }}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={settle}
      >
        {options.map((option, optionIndex) => {
          const selected = option.id === value;
          return (
            <TouchableOpacity
              key={option.id}
              onPress={() => {
                onChange(option.id);
                ref.current?.scrollTo({
                  y: optionIndex * ITEM_HEIGHT,
                  animated: true,
                });
              }}
              style={{ height: ITEM_HEIGHT }}
              className="items-center justify-center"
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text
                className={`text-xl ${
                  selected ? "font-semibold text-gray-900" : "text-gray-400"
                }`}
              >
                {option.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

interface WheelSheetProps {
  visible: boolean;
  onCancel: () => void;
  onDone: () => void;
  /** Date of birth uses the top toolbar; the month-year picker the bottom bar. */
  toolbarPosition?: "top" | "bottom";
  children: React.ReactNode;
}

/** White wheel panel with the reference's Cancel/Done actions. */
export function WheelSheet({
  visible,
  onCancel,
  onDone,
  toolbarPosition = "top",
  children,
}: WheelSheetProps) {
  const insets = useSafeAreaInsets();

  const topToolbar = (
    <View className="flex-row items-center justify-between border-b border-gray-100 px-4 py-2">
      <TouchableOpacity
        onPress={onCancel}
        className="px-1 py-2"
        accessibilityRole="button"
        accessibilityLabel="Cancel"
      >
        <Text className="text-base text-gray-900">Cancel</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onDone}
        className="px-1 py-2"
        accessibilityRole="button"
        accessibilityLabel="Done"
      >
        <Text
          className="text-base font-semibold"
          style={{ color: Colors.primary.DEFAULT }}
        >
          Done
        </Text>
      </TouchableOpacity>
    </View>
  );

  const bottomToolbar = (
    <View className="flex-row items-center border-t border-gray-200">
      <TouchableOpacity
        onPress={onCancel}
        className="flex-1 items-center py-4"
        accessibilityRole="button"
        accessibilityLabel="Cancel"
      >
        <Text className="text-base text-gray-900">Cancel</Text>
      </TouchableOpacity>
      <View className="h-8 w-px bg-gray-200" />
      <TouchableOpacity
        onPress={onDone}
        className="flex-1 items-center py-4"
        accessibilityRole="button"
        accessibilityLabel="Done"
      >
        <Text
          className="text-base font-semibold"
          style={{ color: Colors.primary.DEFAULT }}
        >
          Done
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <BottomSheet visible={visible} onClose={onCancel}>
      <View className="bg-white">
        {toolbarPosition === "top" ? topToolbar : null}

        <View className="flex-row gap-1 px-2 py-3">{children}</View>

        {toolbarPosition === "bottom" ? bottomToolbar : null}

        <View style={{ height: insets.bottom }} />
      </View>
    </BottomSheet>
  );
}
