import React from "react";
import { Modal, Pressable, Text, View } from "react-native";

/** The contact channels a suspended account can appeal through, all optional. */
export interface SuspensionSupport {
  email?: string;
  telegram?: string;
  phone?: string;
}

export interface SuspensionInfo {
  reason: string | null;
  support: SuspensionSupport;
}

/**
 * The only surface a suspended account can see.
 *
 * A suspension blocks every sign-in path, so there is no screen, feed or
 * notification the blocked user can open — the login or OTP failure is where
 * the reason and the appeal channels have to live. Channels come from the
 * runtime settings, so an unset one is simply absent.
 *
 * Shared by both auth screens: a suspension reaches `/auth/login` and
 * `/auth/otp/verify` alike.
 */
export function SuspendedDialog({
  info,
  onClose,
}: {
  info: SuspensionInfo | null;
  onClose: () => void;
}) {
  const support = info?.support ?? {};
  const rows = [
    support.email ? ["Email", support.email] : null,
    support.telegram ? ["Telegram", support.telegram] : null,
    support.phone ? ["Phone", support.phone] : null,
  ].filter((row): row is [string, string] => row !== null);

  return (
    <Modal
      visible={info !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View className="w-full rounded-md bg-white dark:bg-gray-900 p-5 gap-3">
          <Text className="text-lg font-bold text-gray-900 dark:text-white">
            This account is suspended
          </Text>
          <Text className="text-sm text-gray-600 dark:text-gray-300">
            {info?.reason ??
              "An administrator has suspended this account. You cannot sign in until it is reviewed."}
          </Text>
          {rows.length === 0 ? (
            <Text className="text-sm text-gray-600 dark:text-gray-300">
              Contact support through the app&apos;s help channels to request a
              review.
            </Text>
          ) : (
            <View className="gap-1">
              <Text className="text-sm font-semibold text-gray-900 dark:text-white">
                Contact us to resolve it:
              </Text>
              {rows.map(([label, value]) => (
                <Text
                  key={label}
                  className="text-sm text-gray-600 dark:text-gray-300"
                >
                  {label}: {value}
                </Text>
              ))}
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            className="mt-2 h-[44px] items-center justify-center rounded-[4px] bg-secondary-orange"
          >
            <Text className="text-white font-bold text-base">Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
