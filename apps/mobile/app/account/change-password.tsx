import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { changeMyPassword } from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

function messageFor(error: unknown): string {
  if (!(error instanceof ApiError)) return "Please try again.";
  if (error.status === 401) return "Your current password is not correct.";
  if (error.status === 429) return "Too many attempts. Wait a minute.";
  return error.message || "Please try again.";
}

export default function ChangePasswordScreen() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!currentPassword) {
      Alert.alert("Required", "Enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert(
        "Required",
        "The new password must be at least 8 characters.",
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Mismatch", "The new passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      await changeMyPassword(currentPassword, newPassword);
      Alert.alert(
        "Password changed",
        "Use the new password next time you sign in.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (error) {
      Alert.alert("Could not change password", messageFor(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-background">
      <Stack.Screen options={{ headerShown: false }} />

      <View className="flex-row items-center justify-between bg-primary px-4 py-4">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-white">Change Password</Text>
        <View className="w-6" />
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        keyboardShouldPersistTaps="handled"
      >
        {[
          {
            label: "Current password",
            value: currentPassword,
            setter: setCurrentPassword,
          },
          {
            label: "New password (min 8 characters)",
            value: newPassword,
            setter: setNewPassword,
          },
          {
            label: "Confirm new password",
            value: confirmPassword,
            setter: setConfirmPassword,
          },
        ].map((field) => (
          <View key={field.label} className="mb-3">
            <Text className="mb-1 text-xs font-medium text-neutral-text-sub">
              {field.label}
            </Text>
            <TextInput
              value={field.value}
              onChangeText={field.setter}
              secureTextEntry
              autoCapitalize="none"
              placeholder={field.label}
              placeholderTextColor={Colors.text.muted}
              className="rounded-lg border border-neutral-border bg-white px-4 py-3 text-base text-neutral-text-main"
            />
          </View>
        ))}

        <TouchableOpacity
          onPress={submit}
          disabled={saving}
          className="mt-3 items-center rounded-xl bg-primary py-3.5"
        >
          {saving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="font-bold text-white">Update password</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
