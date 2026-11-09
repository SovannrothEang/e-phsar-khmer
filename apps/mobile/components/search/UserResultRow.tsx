import { Colors } from "@/constants/Colors";
import type { UserSearchItem } from "@/lib/api/users";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";

function displayName(user: UserSearchItem): string {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username
  );
}

interface UserResultRowProps {
  user: UserSearchItem;
  /** The reference's all-users page shows plain rows; the inline card shows chevrons. */
  showChevron?: boolean;
}

/**
 * One public user hit. The reference's default avatar is a person silhouette,
 * not initials. The inline card carries the paid badge beside the name and a
 * chevron; the all-users page puts the same purple badge at the far right,
 * matching "Search: <q>".
 */
const UserResultRow = ({ user, showChevron = true }: UserResultRowProps) => {
  const title = displayName(user);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => router.push(`/user/${user.username}` as never)}
      className="flex-row items-center px-4 py-3"
      accessibilityRole="button"
      accessibilityLabel={`${title}, @${user.username}`}
    >
      {user.profilePhotoUrl ? (
        <Image
          source={{ uri: user.profilePhotoUrl }}
          className="h-14 w-14 rounded-full bg-neutral-background"
          resizeMode="cover"
        />
      ) : (
        <View className="h-14 w-14 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-800">
          <Ionicons name="person" size={30} color={Colors.text.muted} />
        </View>
      )}

      <View className="ml-3 flex-1">
        <View className="flex-row items-center">
          <Text
            className="shrink text-[16px] font-semibold text-gray-900 dark:text-white"
            numberOfLines={1}
          >
            {title}
          </Text>
          {showChevron && user.verifiedAccount ? (
            <Ionicons
              name="checkmark-circle"
              size={16}
              color="#7C3AED"
              style={{ marginLeft: 4 }}
            />
          ) : null}
        </View>
        <Text
          className="mt-0.5 text-[13px] text-gray-500 dark:text-gray-400"
          numberOfLines={1}
        >
          @{user.username}
        </Text>
      </View>

      {showChevron ? (
        <Ionicons name="chevron-forward" size={20} color={Colors.text.muted} />
      ) : user.verifiedAccount ? (
        <Ionicons name="checkmark-circle" size={22} color="#7C3AED" />
      ) : null}
    </TouchableOpacity>
  );
};

export default UserResultRow;
