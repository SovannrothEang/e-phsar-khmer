import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/contexts/AuthContext";
import { deleteMyAccount } from "@/lib/api/account";
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

export default function DeleteAccountScreen() {
  const { logout } = useAuth();
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const confirm = () => {
    if (!password) {
      Alert.alert("Required", "Enter your password to delete the account.");
      return;
    }
    Alert.alert(
      "Delete account",
      "Your account is deactivated now and permanently removed after 90 days. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteMyAccount(password);
              await logout();
              router.replace("/(tabs)");
            } catch (error) {
              const message =
                error instanceof ApiError && error.status === 401
                  ? "That password is not correct."
                  : "Could not delete the account. Please try again.";
              Alert.alert("Delete failed", message);
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-background">
      <Stack.Screen options={{ headerShown: false }} />

      <View className="flex-row items-center justify-between bg-primary px-4 py-4">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-white">Delete Account</Text>
        <View className="w-6" />
      </View>

      <ScrollView className="flex-1 px-4 pt-5">
        <View className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <Text className="font-bold text-red-700">
            This is a serious action
          </Text>
          <Text className="mt-2 text-sm leading-5 text-red-700">
            Your account is deactivated immediately and all data is permanently
            removed after 90 days. Your phone number stays reserved during that
            window so you can recover the account by signing in again.
          </Text>
        </View>

        <Text className="mb-1 mt-5 text-xs font-medium text-neutral-text-sub">
          Confirm with your password
        </Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          placeholder="Password"
          placeholderTextColor={Colors.text.muted}
          className="rounded-lg border border-neutral-border bg-white px-4 py-3 text-base text-neutral-text-main"
        />

        <TouchableOpacity
          onPress={confirm}
          disabled={deleting}
          className="mt-5 items-center rounded-xl bg-red-600 py-3.5"
        >
          {deleting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="font-bold text-white">Delete my account</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
