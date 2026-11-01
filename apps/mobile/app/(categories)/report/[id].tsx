import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/api/client";
import {
  fetchReportReasons,
  reportListing,
  reportUser,
  type ReportTargetType,
} from "@/lib/api/reports";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
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

const DESCRIPTION_MAX = 2000;

function reportErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Could not submit the report. Check your connection and try again.";
  }
  if (error.status === 429) {
    return "Too many reports. Please wait a minute and try again.";
  }
  if (error.status === 409) {
    return "You already have a report pending for this.";
  }
  if (
    error.message === "CANNOT_REPORT_SELF" ||
    error.message === "CANNOT_REPORT_OWN_LISTING"
  ) {
    return "You cannot report your own content.";
  }
  if (error.status === 401) {
    return "Your session expired. Please sign in again.";
  }
  return error.message || "Could not submit the report.";
}

const ReportScreen = () => {
  const params = useLocalSearchParams<{
    id?: string | string[];
    title?: string | string[];
    targetType?: string | string[];
  }>();
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const targetId = first(params.id);
  const title = first(params.title);
  const targetType: ReportTargetType =
    first(params.targetType) === "user" ? "user" : "listing";
  const { isAuthenticated } = useAuth();

  const [selectedReasonId, setSelectedReasonId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reasonsQuery = useQuery({
    queryKey: ["report-reasons", targetType],
    queryFn: () => fetchReportReasons(targetType),
    staleTime: 5 * 60_000,
  });
  const reasons = reasonsQuery.data ?? [];

  const handleSubmit = async () => {
    if (!selectedReasonId || !targetId) {
      Alert.alert("Required", "Please select a reason for reporting.");
      return;
    }
    if (!isAuthenticated) {
      router.push("/(auth)/sign-in");
      return;
    }

    setSubmitting(true);
    try {
      const trimmed = description.trim();
      if (targetType === "user") {
        await reportUser({
          targetUserId: targetId,
          reasonId: selectedReasonId,
          ...(trimmed ? { description: trimmed } : {}),
        });
      } else {
        await reportListing({
          listingId: targetId,
          reasonId: selectedReasonId,
          ...(trimmed ? { description: trimmed } : {}),
        });
      }
      Alert.alert(
        "Report Submitted",
        targetType === "user"
          ? "Thank you. We will review this account shortly."
          : "Thank you. We will review this listing shortly.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (error) {
      Alert.alert("Report failed", reportErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView>
      <Stack.Screen options={{ headerShown: false }} />

      <View className="flex-row items-center bg-primary p-4">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-bold text-white" numberOfLines={1}>
          Report: {title || (targetType === "user" ? "Account" : "Product")}
        </Text>
      </View>

      {!isAuthenticated ? (
        <View className="flex-1 items-center justify-center bg-neutral-surface px-6">
          <Ionicons name="lock-closed-outline" size={44} color="#9CA3AF" />
          <Text className="mt-3 text-center text-neutral-text-sub">
            Sign in to report this {targetType === "user" ? "account" : "ad"}.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/(auth)/sign-in")}
            className="mt-4 rounded-lg bg-secondary-orange px-8 py-3"
          >
            <Text className="font-bold text-white">Sign in</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView className="flex-1 bg-neutral-surface">
            {reasonsQuery.isLoading ? (
              <View className="items-center py-10">
                <ActivityIndicator color={Colors.primary.DEFAULT} />
              </View>
            ) : reasons.length === 0 ? (
              <View className="items-center px-6 py-10">
                <Text className="text-center text-neutral-text-sub">
                  No report reasons are available right now.
                </Text>
              </View>
            ) : (
              reasons.map((reason) => (
                <TouchableOpacity
                  key={reason.id}
                  onPress={() => setSelectedReasonId(reason.id)}
                  activeOpacity={0.7}
                  className="border-b border-neutral-border p-4"
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="flex-1 text-base text-neutral-text-main">
                      {reason.reason}
                    </Text>
                    {selectedReasonId === reason.id && (
                      <Ionicons
                        name="checkmark"
                        size={20}
                        color={Colors.primary.DEFAULT}
                      />
                    )}
                  </View>
                </TouchableOpacity>
              ))
            )}

            <View className="p-4">
              <Text className="mb-2 text-sm font-medium text-neutral-text-main">
                Description (optional)
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                multiline
                maxLength={DESCRIPTION_MAX}
                placeholder="Tell us what happened…"
                placeholderTextColor={Colors.text.muted}
                className="min-h-[96px] rounded-lg border border-neutral-border bg-white p-3 text-base text-neutral-text-main"
                textAlignVertical="top"
              />
              <Text className="mt-1 self-end text-xs text-neutral-text-muted">
                {description.length}/{DESCRIPTION_MAX}
              </Text>
            </View>

            <View className="h-24" />
          </ScrollView>

          <View className="absolute bottom-0 left-0 right-0 border-t border-neutral-border bg-neutral-surface p-4">
            <TouchableOpacity
              onPress={handleSubmit}
              className={`rounded-lg py-3 ${
                selectedReasonId
                  ? "bg-secondary-orange"
                  : "bg-neutral-background"
              }`}
              disabled={!selectedReasonId || submitting}
            >
              {submitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text
                  className={`text-center text-base font-bold ${
                    selectedReasonId ? "text-white" : "text-neutral-text-muted"
                  }`}
                >
                  Submit
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
};

export default ReportScreen;
