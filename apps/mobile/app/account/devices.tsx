import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import {
  fetchMyDevices,
  revokeMyDevice,
  revokeOtherDevices,
} from "@/lib/api/account";
import { formatListingDate } from "@/lib/listings";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function DevicesScreen() {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  const query = useQuery({
    queryKey: ["my-devices"],
    queryFn: fetchMyDevices,
  });
  const devices = query.data ?? [];
  const others = devices.filter((device) => !device.isCurrent).length;

  const revoke = async (id: string) => {
    setBusyId(id);
    try {
      await revokeMyDevice(id);
      await query.refetch();
    } catch {
      Alert.alert("Could not revoke", "Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const revokeOthers = () => {
    Alert.alert(
      "Sign out other devices",
      "This revokes every other session immediately.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            setRevokingOthers(true);
            try {
              await revokeOtherDevices();
              await query.refetch();
            } catch {
              Alert.alert("Could not sign out", "Please try again.");
            } finally {
              setRevokingOthers(false);
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
        <Text className="text-lg font-bold text-white">Active Devices</Text>
        <View className="w-6" />
      </View>

      <ScrollView className="flex-1 px-4 pt-4">
        {query.isLoading ? (
          <View className="items-center py-10">
            <ActivityIndicator color={Colors.primary.DEFAULT} />
          </View>
        ) : devices.length === 0 ? (
          <View className="items-center py-12">
            <Text className="text-neutral-text-sub">No active devices.</Text>
          </View>
        ) : (
          devices.map((device) => {
            const details = [
              device.clientType === "app" ? "App" : "Browser",
              device.clientVersion,
              device.osName,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <View
                key={device.id}
                className="mb-3 rounded-2xl border border-neutral-border bg-white p-4"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-3">
                    <View className="flex-row items-center gap-2">
                      <Text
                        className="text-base font-bold text-neutral-text-main"
                        numberOfLines={1}
                      >
                        {device.name}
                      </Text>
                      {device.isCurrent && (
                        <View className="rounded-full bg-emerald-100 px-2 py-0.5">
                          <Text className="text-[10px] font-bold text-emerald-700">
                            This device
                          </Text>
                        </View>
                      )}
                    </View>
                    {details ? (
                      <Text className="mt-1 text-xs text-neutral-text-sub">
                        {details}
                      </Text>
                    ) : null}
                    <Text className="mt-1 text-xs text-neutral-text-muted">
                      Last active {formatListingDate(device.lastSeenAt)}
                    </Text>
                  </View>

                  {!device.isCurrent && (
                    <TouchableOpacity
                      onPress={() => revoke(device.id)}
                      disabled={busyId === device.id}
                      className="rounded-lg border border-red-300 px-3 py-2"
                    >
                      <Text className="text-xs font-semibold text-red-600">
                        {busyId === device.id ? "Revoking…" : "Revoke"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}

        {others > 0 && (
          <TouchableOpacity
            onPress={revokeOthers}
            disabled={revokingOthers}
            className="mt-2 items-center rounded-xl border border-red-300 py-3"
          >
            <Text className="font-semibold text-red-600">
              {revokingOthers ? "Signing out…" : "Sign out other devices"}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
