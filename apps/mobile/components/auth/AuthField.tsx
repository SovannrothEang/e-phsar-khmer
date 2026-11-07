import { FloatingLabel } from "@/components/common/FloatingInput";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  type TextInputInstance,
} from "react-native";

/** Matches the auth buttons; the floating label needs room for two rows. */
const FIELD_HEIGHT = 48;

interface AuthFieldProps extends Omit<
  TextInputProps,
  "style" | "value" | "onChangeText"
> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  /** Red border, red label and an inline message under the field. */
  error?: string;
  /** Masks the value and renders the show/hide eye. */
  secure?: boolean;
  inputRef?: React.RefObject<TextInputInstance | null>;
  /** Extra classes for the TextInput itself (e.g. centred OTP digits). */
  inputClassName?: string;
}

/**
 * The bordered input used by every auth form. The label is the only label:
 * it rests inside the box like a placeholder, then glides up once the field
 * is focused or holds a value (same `FloatingLabel` as the posting form).
 */
export const AuthField: React.FC<AuthFieldProps> = ({
  label,
  value,
  onChangeText,
  error,
  secure = false,
  inputRef,
  inputClassName,
  ...inputProps
}) => {
  const { isDark } = useTheme();
  const [revealed, setRevealed] = useState(false);
  const [focused, setFocused] = useState(false);
  const active = focused || value.length > 0;

  // Callers still pass placeholders; the floating label is the only label, so
  // they are dropped rather than doubling up with it.
  const {
    placeholder: _placeholder,
    onFocus,
    onBlur,
    keyboardType,
    ...textInputProps
  } = inputProps;
  // Keep Android's password keyboard while the value is revealed: a plain
  // `default` keyboard swaps to the suggestion row when the eye is tapped.
  const resolvedKeyboardType =
    secure && revealed ? "visible-password" : keyboardType;

  return (
    <View>
      <View
        className={`rounded-[4px] border ${
          isDark
            ? "bg-gray-900 border-gray-800"
            : "bg-neutral-surface border-neutral-border"
        } ${error ? "border-red-500" : ""}`}
        style={{ height: FIELD_HEIGHT }}
      >
        <FloatingLabel label={label} active={active} />

        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secure && !revealed}
          keyboardType={resolvedKeyboardType}
          placeholderTextColor={isDark ? "#6B7280" : Colors.text.muted}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          textAlignVertical="center"
          className={`text-base font-medium ${
            isDark ? "text-white" : "text-neutral-text-main"
          } ${inputClassName ?? ""}`}
          style={{
            position: "absolute",
            left: 16,
            right: secure ? 48 : 16,
            top: 16,
            bottom: 0,
            padding: 0,
          }}
          {...textInputProps}
        />

        {secure ? (
          <TouchableOpacity
            onPress={() => setRevealed((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Hide password" : "Show password"}
            style={{
              position: "absolute",
              right: 10,
              top: 0,
              bottom: 0,
              justifyContent: "center",
            }}
          >
            <Ionicons
              name={revealed ? "eye-off-outline" : "eye-outline"}
              size={22}
              color={isDark ? "#9CA3AF" : Colors.text.muted}
            />
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? (
        <View className="flex-row items-center gap-1.5 mt-1.5 ml-1">
          <Ionicons name="alert-circle" size={15} color="#EF4444" />
          <Text className="text-red-500 text-xs font-medium">{error}</Text>
        </View>
      ) : null}
    </View>
  );
};
