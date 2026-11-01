import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { fetchMyProfile, updateMyProfile } from "@/lib/api/account";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const ROWS: {
  key:
    | "discoverableByGender"
    | "discoverableByDateOfBirth"
    | "discoverableByPhone"
    | "discoverableByEmail"
    | "discoverableByLocation";
  label: string;
  hint: string;
}[] = [
  {
    key: "discoverableByPhone",
    label: "Phone number",
    hint: "Show your phone on your public profile.",
  },
  {
    key: "discoverableByEmail",
    label: "Email",
    hint: "Show your email on your public profile.",
  },
  {
    key: "discoverableByGender",
    label: "Gender",
    hint: "Show your gender on your public profile.",
  },
  {
    key: "discoverableByDateOfBirth",
    label: "Date of birth",
    hint: "Show your birthday on your public profile.",
  },
  {
    key: "discoverableByLocation",
    label: "Location",
    hint: "Show your location on your public profile.",
  },
];

type PrivacyKey = (typeof ROWS)[number]["key"];

export default function PrivacyScreen() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["my-profile"],
    queryFn: fetchMyProfile,
  });
  const [values, setValues] = useState<Record<PrivacyKey, boolean>>({
    discoverableByGender: false,
    discoverableByDateOfBirth: false,
    discoverableByPhone: true,
    discoverableByEmail: true,
    discoverableByLocation: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!query.data) return;
    setValues({
      discoverableByGender: Boolean(query.data.discoverableByGender),
      discoverableByDateOfBirth: Boolean(query.data.discoverableByDateOfBirth),
      discoverableByPhone: Boolean(query.data.discoverableByPhone),
      discoverableByEmail: Boolean(query.data.discoverableByEmail),
      discoverableByLocation: Boolean(query.data.discoverableByLocation),
    });
  }, [query.data]);

  const save = async () => {
    setSaving(true);
    try {
      await updateMyProfile(values);
      await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      Alert.alert("Saved", "Your privacy settings were updated.");
    } catch {
      Alert.alert("Could not save", "Please try again.");
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
        <Text className="text-lg font-bold text-white">Privacy</Text>
        <View className="w-6" />
      </View>

      <ScrollView className="flex-1 px-4 pt-4">
        <Text className="mb-3 px-1 text-xs text-neutral-text-sub">
          Public shows the field on your public profile; Only Me hides it.
        </Text>

        {query.isLoading ? (
          <View className="items-center py-10">
            <ActivityIndicator color={Colors.primary.DEFAULT} />
          </View>
        ) : (
          <View className="rounded-2xl border border-neutral-border bg-white">
            {ROWS.map((row, index) => (
              <View
                key={row.key}
                className={`flex-row items-center justify-between px-4 py-3 ${
                  index < ROWS.length - 1
                    ? "border-b border-neutral-border/60"
                    : ""
                }`}
              >
                <View className="flex-1 pr-3">
                  <Text className="text-base font-medium text-neutral-text-main">
                    {row.label}
                  </Text>
                  <Text className="mt-0.5 text-xs text-neutral-text-sub">
                    {row.hint}
                  </Text>
                </View>
                <Switch
                  value={values[row.key]}
                  onValueChange={(next) =>
                    setValues((current) => ({ ...current, [row.key]: next }))
                  }
                />
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          onPress={save}
          disabled={saving}
          className="mt-5 items-center rounded-xl bg-primary py-3.5"
        >
          <Text className="font-bold text-white">
            {saving ? "Saving…" : "Save"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
