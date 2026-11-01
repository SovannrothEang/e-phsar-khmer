import { Colors } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export interface DropdownOption {
  id: string;
  name: string;
}

interface DropdownFieldProps {
  label: string;
  value?: string;
  placeholder?: string;
  options: DropdownOption[];
  onSelect: (option: DropdownOption) => void;
  disabled?: boolean;
  searchable?: boolean;
  required?: boolean;
  error?: boolean;
}

/** A bordered select that opens a searchable bottom sheet. */
function DropdownField({
  label,
  value,
  placeholder,
  options,
  onSelect,
  disabled = false,
  searchable = false,
  required = false,
  error = false,
}: DropdownFieldProps) {
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState("");

  const selected = options.find((option) => option.id === value);
  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const needle = search.toLowerCase();
    return options.filter((option) =>
      option.name.toLowerCase().includes(needle),
    );
  }, [options, search]);

  return (
    <>
      <TouchableOpacity
        onPress={() => !disabled && setVisible(true)}
        disabled={disabled}
        className={`flex-row items-center justify-between rounded-lg border px-4 py-3 ${
          error
            ? "border-red-400 bg-white"
            : disabled
              ? "border-neutral-border bg-neutral-background"
              : "border-neutral-border bg-white"
        }`}
      >
        <View className="flex-1">
          <Text className="text-xs text-neutral-text-muted">
            {label}
            {required ? <Text className="text-red-500"> *</Text> : null}
          </Text>
          <Text
            className={`text-base ${
              selected ? "text-neutral-text-main" : "text-neutral-text-muted"
            }`}
            numberOfLines={1}
          >
            {selected?.name || placeholder || `Select ${label}`}
          </Text>
        </View>
        <Ionicons
          name="chevron-down"
          size={20}
          color={disabled ? "#D1D5DB" : Colors.text.muted}
        />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setVisible(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/50"
          onPress={() => setVisible(false)}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            className="max-h-[70%] w-full rounded-t-3xl bg-white pb-8"
          >
            <View className="items-center py-4">
              <View className="h-1.5 w-12 rounded-full bg-gray-300" />
            </View>
            <Text className="border-b border-gray-100 px-4 pb-4 text-center text-lg font-bold text-gray-900">
              {label}
            </Text>

            {searchable && (
              <View className="border-b border-gray-100 px-4 py-3">
                <View className="flex-row items-center rounded-xl bg-gray-100 px-3 py-2">
                  <Ionicons name="search" size={18} color="#9CA3AF" />
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search"
                    placeholderTextColor="#9CA3AF"
                    className="ml-2 flex-1 py-0 text-base text-gray-900"
                  />
                </View>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false}>
              {filtered.length === 0 ? (
                <Text className="px-4 py-8 text-center text-sm text-neutral-text-muted">
                  No options
                </Text>
              ) : (
                filtered.map((option) => (
                  <TouchableOpacity
                    key={option.id}
                    onPress={() => {
                      onSelect(option);
                      setVisible(false);
                    }}
                    activeOpacity={0.7}
                    className="flex-row items-center justify-between border-b border-gray-100 px-4 py-4"
                  >
                    <Text
                      className={`text-base ${
                        value === option.id
                          ? "font-bold text-blue-500"
                          : "text-gray-900"
                      }`}
                    >
                      {option.name}
                    </Text>
                    {value === option.id && (
                      <Ionicons name="checkmark" size={20} color="#3b82f6" />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export default DropdownField;
