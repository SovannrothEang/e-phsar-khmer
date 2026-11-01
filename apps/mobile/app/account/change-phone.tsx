import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchMyPhones,
  requestPhoneChange,
  verifyPhoneChange,
} from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";
import { normalizePhone } from "@/lib/phone";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
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
  if (error.status === 429) return "Too many attempts. Wait a minute.";
  return error.message || "Please try again.";
}

export default function ChangePhoneScreen() {
  const { refreshUser } = useAuth();
  const [phone, setPhone] = useState("");
  const [token, setToken] = useState("");
  const [stage, setStage] = useState<"enter" | "verify">("enter");
  const [busy, setBusy] = useState(false);

  const phonesQuery = useQuery({
    queryKey: ["my-phones"],
    queryFn: fetchMyPhones,
  });

  const sendCode = async () => {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      Alert.alert("Invalid number", "Enter a valid phone number.");
      return;
    }
    setBusy(true);
    try {
      await requestPhoneChange(normalized);
      setPhone(normalized);
      setStage("verify");
    } catch (error) {
      Alert.alert("Could not send the code", messageFor(error));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (token.trim().length < 4) {
      Alert.alert("Required", "Enter the code from the SMS.");
      return;
    }
    setBusy(true);
    try {
      await verifyPhoneChange(phone, token.trim());
      await Promise.all([refreshUser(), phonesQuery.refetch()]);
      Alert.alert("Phone updated", "This is now your account's phone number.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert("Could not verify", messageFor(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-background">
      <Stack.Screen options={{ headerShown: false }} />

      <View className="flex-row items-center justify-between bg-primary px-4 py-4">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-white">Phone Number</Text>
        <View className="w-6" />
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="mb-2 text-xs font-semibold text-neutral-text-sub">
          Current numbers
        </Text>
        {phonesQuery.isLoading ? (
          <ActivityIndicator color={Colors.primary.DEFAULT} />
        ) : (
          <View className="mb-5 rounded-2xl border border-neutral-border bg-white">
            {(phonesQuery.data ?? []).length === 0 ? (
              <Text className="px-4 py-3 text-sm text-neutral-text-sub">
                No saved numbers.
              </Text>
            ) : (
              (phonesQuery.data ?? []).map((entry, index, all) => (
                <View
                  key={entry.id}
                  className={`flex-row items-center justify-between px-4 py-3 ${
                    index < all.length - 1
                      ? "border-b border-neutral-border/60"
                      : ""
                  }`}
                >
                  <Text className="text-base text-neutral-text-main">
                    {entry.phone}
                  </Text>
                  {entry.isPrimary && (
                    <Text className="text-xs font-semibold text-primary">
                      Primary
                    </Text>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {stage === "enter" ? (
          <>
            <Text className="mb-1 text-xs font-medium text-neutral-text-sub">
              New phone number
            </Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="012 345 678"
              placeholderTextColor={Colors.text.muted}
              className="rounded-lg border border-neutral-border bg-white px-4 py-3 text-base text-neutral-text-main"
            />
            <TouchableOpacity
              onPress={sendCode}
              disabled={busy}
              className="mt-4 items-center rounded-xl bg-primary py-3.5"
            >
              {busy ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="font-bold text-white">Send code</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text className="mb-1 text-xs font-medium text-neutral-text-sub">
              Code sent to {phone}
            </Text>
            <TextInput
              value={token}
              onChangeText={setToken}
              keyboardType="number-pad"
              maxLength={8}
              placeholder="000000"
              placeholderTextColor={Colors.text.muted}
              className="rounded-lg border border-neutral-border bg-white px-4 py-3 text-center text-2xl font-bold tracking-[8px] text-neutral-text-main"
            />
            <TouchableOpacity
              onPress={verify}
              disabled={busy}
              className="mt-4 items-center rounded-xl bg-primary py-3.5"
            >
              {busy ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="font-bold text-white">Verify & save</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setStage("enter");
                setToken("");
              }}
              className="mt-3 items-center py-2"
            >
              <Text className="text-sm font-semibold text-primary">
                Use a different number
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
