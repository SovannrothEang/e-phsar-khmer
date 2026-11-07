import ActionSheet from "@/components/common/ActionSheet";
import { FieldError, FloatingLabel } from "@/components/common/FloatingInput";
import SelectionSheet from "@/components/common/SelectionSheet";
import { Colors } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

export interface DropdownOption {
  id: string;
  name: string;
  image?: string | null;
}

interface DropdownFieldProps {
  label: string;
  value?: string;
  options: DropdownOption[];
  onSelect: (option: DropdownOption) => void;
  /** Enables the sheet's Clear action; omit when the field cannot be emptied. */
  onClear?: () => void;
  disabled?: boolean;
  /** Inline validation message — red border plus the message below the box. */
  error?: string;
  /** Trigger chevron; "forward" matches the summary cards (Product Specification). */
  chevron?: "down" | "forward";
  /** Accepted for call-site compatibility; the floating label replaces both. */
  placeholder?: string;
  searchable?: boolean;
  required?: boolean;
  /** "filled" is the resume wizard's dark surface; "outline" is the app default. */
  variant?: "outline" | "filled";
  /**
   * "sheet" is the shared searchable bottom sheet (default); "actions" is the
   * iOS-style action sheet used by the resume's short choice lists.
   */
  picker?: "sheet" | "actions";
}

/**
 * A bordered select that opens the shared searchable bottom sheet. The label
 * floats like the text inputs: centred while empty, small on top once a value
 * is chosen (captain, 2026-11-04).
 */
function DropdownField({
  label,
  value,
  options,
  onSelect,
  onClear,
  disabled = false,
  error,
  chevron = "down",
  required = false,
  variant = "outline",
  picker = "sheet",
}: DropdownFieldProps) {
  const [visible, setVisible] = useState(false);

  const selected = options.find((option) => option.id === value);
  const surface =
    variant === "filled"
      ? "bg-[#F2F2F7] dark:bg-[#3A3A3C]"
      : "bg-white dark:bg-gray-900";
  const border = error
    ? "border border-red-400"
    : variant === "filled"
      ? "border border-transparent"
      : disabled
        ? "border border-neutral-border dark:border-gray-800"
        : "border border-gray-200 dark:border-gray-700";

  return (
    <View>
      <TouchableOpacity
        onPress={() => !disabled && setVisible(true)}
        disabled={disabled}
        className={`h-14 flex-row items-center justify-end rounded-lg px-4 ${surface} ${border} ${
          disabled ? "opacity-60" : ""
        }`}
      >
        <FloatingLabel label={label} active={!!selected} required={required} />
        {selected ? (
          <Text
            className="text-base text-gray-900 dark:text-white"
            style={{ position: "absolute", left: 16, right: 44, top: 24 }}
            numberOfLines={1}
          >
            {selected.name}
          </Text>
        ) : null}
        <Ionicons
          name={chevron === "forward" ? "chevron-forward" : "chevron-down"}
          size={20}
          color={disabled ? "#D1D5DB" : Colors.text.muted}
        />
      </TouchableOpacity>
      {error ? <FieldError message={error} /> : null}

      {picker === "actions" ? (
        <ActionSheet
          visible={visible}
          options={options}
          onSelect={(option) => {
            onSelect(option);
            setVisible(false);
          }}
          onClose={() => setVisible(false)}
        />
      ) : (
        <SelectionSheet
          visible={visible}
          title={label}
          options={options}
          value={value}
          onSelect={(option) => {
            onSelect(option);
            setVisible(false);
          }}
          onClear={
            onClear
              ? () => {
                  onClear();
                  setVisible(false);
                }
              : undefined
          }
          onClose={() => setVisible(false)}
          emptyLabel="No options"
        />
      )}
    </View>
  );
}

export default DropdownField;
