import { Colors } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

interface EntryRowProps {
  title: string;
  subtitle?: string;
  detail?: string;
  status?: string;
  /** Reference pill for a legacy skill/language with no level. */
  missing?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

/** One flat list row (Educations / Skills / Languages) with edit + delete. */
export default function EntryRow({
  title,
  subtitle,
  detail,
  status,
  missing = false,
  onEdit,
  onDelete,
}: EntryRowProps) {
  return (
    <View className="border-b border-gray-100 py-4 dark:border-[#2C2C2E]">
      <View className="flex-row items-start gap-2">
        <Text className="flex-1 pr-1 text-base font-bold text-gray-900 dark:text-white">
          {title}
        </Text>

        {missing ? (
          <View className="rounded-full bg-orange-50 px-3 py-1 dark:bg-[#3A2A12]">
            <Text className="text-xs font-semibold text-orange-500">
              Missing info
            </Text>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={onEdit}
          className="h-8 w-8 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Edit"
        >
          <Ionicons name="pencil" size={19} color={Colors.primary.DEFAULT} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDelete}
          className="h-8 w-8 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Delete"
        >
          <Ionicons name="trash-outline" size={19} color={Colors.danger} />
        </TouchableOpacity>
      </View>

      {subtitle ? (
        <Text className="mt-1 text-sm italic text-gray-500 dark:text-gray-400">
          {subtitle}
        </Text>
      ) : null}
      {detail ? (
        <Text className="mt-1 text-sm text-gray-900 dark:text-white">
          {detail}
        </Text>
      ) : null}
      {status ? (
        <Text className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
          {status}
        </Text>
      ) : null}
    </View>
  );
}
