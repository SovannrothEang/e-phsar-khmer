import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import React, { useEffect, useState } from "react";
import {
  Animated,
  Text,
  TextInput,
  useAnimatedValue,
  type TextInputProps,
  View,
} from "react-native";

interface FloatingInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  multiline?: boolean;
  keyboardType?: TextInputProps["keyboardType"];
  autoCapitalize?: TextInputProps["autoCapitalize"];
  maxLength?: number;
  /** Inline validation message — red border plus the message below the box. */
  error?: string;
  /** Controls rendered inside the box, right-aligned (the phone +/- buttons). */
  rightAccessory?: React.ReactNode;
  /** Renders a red asterisk beside the floating label. */
  required?: boolean;
  /** "filled" is the resume wizard's dark surface; "outline" is the app default. */
  variant?: "outline" | "filled";
  /** Height used when `multiline` is true (default 112). */
  multilineHeight?: number;
}

/** Inline error line, matching the reference form's submit flags. */
export function FieldError({ message }: { message: string }) {
  return (
    <View className="mt-1 flex-row items-center">
      <Ionicons name="alert-circle" size={15} color="#EF4444" />
      <Text className="ml-1.5 text-sm text-red-500">{message}</Text>
    </View>
  );
}

/**
 * Animated label shared by the floating inputs and the dropdowns: it sits
 * centred like a placeholder while the field is empty and unfocused, then
 * glides up and shrinks once the field holds a value (captain, 2026-11-04).
 *
 * `center` lays the label out with flex centring (exact middle-left, not a
 * fixed offset), `top` keeps it at the top-left for the tall multiline fields.
 */
export function FloatingLabel({
  label,
  active,
  variant = "center",
  required = false,
}: {
  label: string;
  active: boolean;
  variant?: "center" | "top";
  required?: boolean;
}) {
  const progress = useAnimatedValue(active ? 1 : 0);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  useEffect(() => {
    Animated.timing(progress, {
      toValue: active ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [active, progress]);

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        top: 0,
        bottom: 0,
        ...(variant === "center"
          ? { justifyContent: "center" }
          : { paddingTop: 16 }),
      }}
    >
      <Animated.Text
        style={{
          fontSize: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [16, 12],
          }),
          color: active
            ? isDark
              ? "#A1A1AA"
              : "#6B7280"
            : isDark
              ? "#8E8E93"
              : "#9CA3AF",
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                // Centre: the flex-centred label rises to the top padding.
                // Top: the label just shrinks in place.
                outputRange: [0, variant === "center" ? -14 : -9],
              }),
            },
          ],
        }}
      >
        {label}
        {required ? <Text style={{ color: "#EF4444" }}> *</Text> : null}
      </Animated.Text>
    </View>
  );
}

/** Bordered text field with the floating label and inline error styling. */
export default function FloatingInput({
  label,
  value,
  onChangeText,
  multiline = false,
  keyboardType,
  autoCapitalize,
  maxLength,
  error,
  rightAccessory,
  required = false,
  variant = "outline",
  multilineHeight = 112,
}: FloatingInputProps) {
  const [focused, setFocused] = useState(false);
  const active = focused || value.length > 0;

  const surface =
    variant === "filled"
      ? "bg-[#F2F2F7] dark:bg-[#3A3A3C]"
      : "bg-white dark:bg-gray-900";
  const border = error
    ? "border border-red-400"
    : variant === "filled"
      ? "border border-transparent"
      : "border border-gray-200 dark:border-gray-700";

  return (
    <View>
      <View
        className={`rounded-lg ${surface} ${border}`}
        style={{ height: multiline ? multilineHeight : 56 }}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          multiline={multiline}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          maxLength={maxLength}
          textAlignVertical={multiline ? "top" : "center"}
          className="text-base text-gray-900 dark:text-white"
          style={{
            position: "absolute",
            left: 16,
            right: rightAccessory ? 56 : 16,
            top: multiline ? 24 : 22,
            bottom: multiline ? 10 : 6,
            padding: 0,
          }}
        />
        <FloatingLabel
          label={label}
          active={active}
          variant={multiline ? "top" : "center"}
          required={required}
        />
        {rightAccessory ? (
          <View
            style={{
              position: "absolute",
              right: 12,
              top: 0,
              bottom: 0,
              justifyContent: "center",
            }}
          >
            {rightAccessory}
          </View>
        ) : null}
      </View>
      {error ? <FieldError message={error} /> : null}
    </View>
  );
}
