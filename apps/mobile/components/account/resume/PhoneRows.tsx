import FloatingInput from "@/components/common/FloatingInput";
import { Colors } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { TouchableOpacity, View } from "react-native";
import { MAX_PHONES } from "./options";

interface PhoneRowsProps {
  phones: string[];
  onChange: (phones: string[]) => void;
  /** Per-row messages; index 0 falls back to `groupError`. */
  errors?: (string | undefined)[];
  groupError?: string;
  max?: number;
}

/** The reference's phone rows: first number plus up to two, with + / −. */
export default function PhoneRows({
  phones,
  onChange,
  errors = [],
  groupError,
  max = MAX_PHONES,
}: PhoneRowsProps) {
  const update = (index: number, value: string) => {
    onChange(phones.map((phone, i) => (i === index ? value : phone)));
  };

  const add = () => {
    if (phones.length >= max) return;
    onChange([...phones, ""]);
  };

  const remove = (index: number) => {
    if (phones.length === 1) return;
    onChange(phones.filter((_, i) => i !== index));
  };

  return (
    <View className="gap-3">
      {phones.map((phone, index) => (
        <View key={index} className="flex-row items-center gap-2">
          <View className="flex-1">
            <FloatingInput
              label={`Phone Number ${index + 1}`}
              value={phone}
              onChangeText={(text) => update(index, text)}
              keyboardType="phone-pad"
              maxLength={15}
              required={index === 0}
              variant="filled"
              error={errors[index] ?? (index === 0 ? groupError : undefined)}
            />
          </View>

          {index > 0 ? (
            <TouchableOpacity
              onPress={() => remove(index)}
              className="h-9 w-9 items-center justify-center rounded-full"
              style={{ backgroundColor: Colors.danger }}
              accessibilityRole="button"
              accessibilityLabel={`Remove phone number ${index + 1}`}
            >
              <Ionicons name="remove" size={20} color="white" />
            </TouchableOpacity>
          ) : null}

          {index === phones.length - 1 && phones.length < max ? (
            <TouchableOpacity
              onPress={add}
              className="h-9 w-9 items-center justify-center rounded-full"
              style={{ backgroundColor: Colors.primary.DEFAULT }}
              accessibilityRole="button"
              accessibilityLabel="Add another phone number"
            >
              <Ionicons name="add" size={20} color="white" />
            </TouchableOpacity>
          ) : null}
        </View>
      ))}
    </View>
  );
}
