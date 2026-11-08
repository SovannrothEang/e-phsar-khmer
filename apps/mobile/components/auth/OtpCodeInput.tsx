import { useTheme } from "@/contexts/ThemeContext";
import React, { useRef, useState } from "react";
import { TextInput, View, type TextInputInstance } from "react-native";

interface OtpCodeInputProps {
  /** Digits entered so far, left to right (no separators). */
  value: string;
  onChange: (code: string) => void;
  length?: number;
  /** Red borders after a rejected code. */
  error?: boolean;
  autoFocus?: boolean;
}

/**
 * The six separate OTP boxes from the reference: typing jumps to the next box,
 * backspace steps back, and pasting a whole code fills them all.
 */
export const OtpCodeInput: React.FC<OtpCodeInputProps> = ({
  value,
  onChange,
  length = 6,
  error = false,
  autoFocus = true,
}) => {
  const { isDark } = useTheme();
  const inputs = useRef<(TextInputInstance | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(
    autoFocus ? 0 : null,
  );

  const digits = Array.from({ length }, (_, index) => value[index] ?? "");

  const focusBox = (index: number) => {
    const next = Math.max(0, Math.min(length - 1, index));
    inputs.current[next]?.focus();
  };

  const handleChange = (text: string, index: number) => {
    const cleaned = text.replace(/[^0-9]/g, "");
    if (!cleaned) {
      // Deleting the digit in this box truncates everything after it.
      onChange(value.slice(0, index));
      return;
    }
    const next = (value.slice(0, index) + cleaned).slice(0, length);
    onChange(next);
    focusBox(index + cleaned.length);
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key !== "Backspace" || digits[index] || index === 0) return;
    // Empty box: step back and remove the previous digit.
    onChange(value.slice(0, index - 1));
    focusBox(index - 1);
  };

  return (
    <View className="flex-row gap-2">
      {digits.map((digit, index) => {
        const isFocused = focusedIndex === index;
        const border = error
          ? "border-red-500"
          : isFocused
            ? "border-primary"
            : isDark
              ? "border-gray-700"
              : "border-neutral-border";

        return (
          <TextInput
            key={index}
            ref={(node) => {
              inputs.current[index] = node;
            }}
            value={digit}
            onChangeText={(text) => handleChange(text, index)}
            onKeyPress={(event) => handleKeyPress(event.nativeEvent.key, index)}
            onFocus={() => setFocusedIndex(index)}
            onBlur={() =>
              setFocusedIndex((prev) => (prev === index ? null : prev))
            }
            keyboardType="number-pad"
            // The first box accepts a pasted code; the rest hold one digit.
            maxLength={index === 0 ? length : 1}
            autoFocus={autoFocus && index === 0}
            autoComplete={index === 0 ? "one-time-code" : "off"}
            textContentType={index === 0 ? "oneTimeCode" : "none"}
            selectTextOnFocus
            accessibilityLabel={`Code digit ${index + 1}`}
            className={`flex-1 h-[52px] rounded-lg border text-center text-lg font-semibold ${
              isDark ? "text-white" : "text-neutral-text-main"
            } ${isDark ? "bg-gray-900" : "bg-neutral-surface"} ${border}`}
            style={{ paddingVertical: 0 }}
          />
        );
      })}
    </View>
  );
};

export default OtpCodeInput;
