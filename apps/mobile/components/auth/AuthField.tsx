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
} from "react-native";

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
  inputRef?: React.RefObject<TextInput | null>;
  /** Extra classes for the TextInput itself (e.g. centred OTP digits). */
  inputClassName?: string;
}

/**
 * The bordered label + input + error row used by every auth form. Kept in one
 * place so Sign in, Register and the OTP screen cannot drift apart.
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

  return (
    <View>
      <View
        className={`rounded-xl border p-3 ${
          isDark
            ? "bg-gray-900 border-gray-800"
            : "bg-neutral-surface border-neutral-border"
        } ${error ? "border-red-500" : ""}`}
      >
        <Text
          className={`text-xs mb-1 font-medium ${
            error
              ? "text-red-500"
              : isDark
                ? "text-gray-400"
                : "text-neutral-text-sub"
          }`}
        >
          {label}
        </Text>
        <View className="flex-row items-center">
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={onChangeText}
            secureTextEntry={secure && !revealed}
            placeholderTextColor={isDark ? "#6B7280" : Colors.text.muted}
            className={`flex-1 text-base font-medium p-0 ${
              isDark ? "text-white" : "text-neutral-text-main"
            } ${inputClassName ?? ""}`}
            {...inputProps}
          />
          {secure ? (
            <TouchableOpacity
              onPress={() => setRevealed((prev) => !prev)}
              className="p-1"
              accessibilityRole="button"
              accessibilityLabel={revealed ? "Hide password" : "Show password"}
            >
              <Ionicons
                name={revealed ? "eye-off-outline" : "eye-outline"}
                size={22}
                color={isDark ? "#9CA3AF" : Colors.text.muted}
              />
            </TouchableOpacity>
          ) : null}
        </View>
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
