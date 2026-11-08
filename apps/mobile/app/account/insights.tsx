import AccountHeader from "@/components/account/AccountHeader";
import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { fetchMyInsights, type InsightSummary } from "@/lib/api/insights";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

const ROWS: { key: keyof InsightSummary; label: string; hint: string }[] = [
  {
    key: "impression",
    label: "Impression",
    hint: "The number of times your ad was shown.",
  },
  {
    key: "engagement",
    label: "Engagement",
    hint: "The total number of actions that people take involving your ads.",
  },
  {
    key: "view",
    label: "View",
    hint: "Number of times people view your ads details.",
  },
  { key: "chat", label: "Chat", hint: "Number of times people click chat." },
  { key: "call", label: "Call", hint: "Number of times people click call." },
  {
    key: "showContact",
    label: "Show Contact",
    hint: "Number of times people click show contact.",
  },
  {
    key: "applyJob",
    label: "Apply Job",
    hint: "Number of times people click apply job.",
  },
];

type InsightView = "overview" | "engagement";

const VIEW_LABELS: Record<InsightView, string> = {
  overview: "Overview",
  engagement: "Engagements",
};

export default function InsightsScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const [view, setView] = useState<InsightView>("overview");
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(
    null,
  );
  const triggerRef = useRef<React.ComponentRef<typeof View>>(null);

  const openViewMenu = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setMenuPos({
        top: y + height + 4,
        right: windowWidth - (x + width),
      });
    });
  };

  const insightsQuery = useQuery({
    queryKey: ["my-insights"],
    queryFn: fetchMyInsights,
  });
  const summary = insightsQuery.data;

  const series = useMemo(
    () =>
      view === "overview"
        ? [
            {
              label: "Impression",
              color: "#2F80ED",
              value: summary?.impression ?? 0,
            },
            {
              label: "Engagement",
              color: "#F2994A",
              value: summary?.engagement ?? 0,
            },
          ]
        : [
            { label: "View", color: "#2F80ED", value: summary?.view ?? 0 },
            { label: "Chat", color: "#F2994A", value: summary?.chat ?? 0 },
            { label: "Call", color: "#27AE60", value: summary?.call ?? 0 },
            {
              label: "Show Contact",
              color: "#EB5757",
              value: summary?.showContact ?? 0,
            },
            {
              label: "Apply Job",
              color: "#F2C94C",
              value: summary?.applyJob ?? 0,
            },
          ],
    [view, summary],
  );
  const axisMax = Math.max(4, ...series.map((entry) => entry.value));
  const ticks = [
    axisMax,
    Math.round(axisMax * 0.75),
    Math.round(axisMax * 0.5),
    Math.round(axisMax * 0.25),
    0,
  ];
  const dateLabels = useMemo(() => {
    const now = new Date();
    return [274, 182, 91, 0].map((daysAgo) => {
      const date = new Date(now);
      date.setDate(date.getDate() - daysAgo);
      return date.toLocaleString("en-US", { month: "short", day: "2-digit" });
    });
  }, []);

  return (
    <SafeAreaView
      statusBarColor={Colors.primary.DEFAULT}
      statusBarStyle="light-content"
      className="flex-1 bg-white"
    >
      <AccountHeader title="Insights" variant="blue" showHeadset={false} />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="px-4 py-4">
          <Text className="text-xl font-bold text-gray-900 dark:text-white">
            Overview
          </Text>
        </View>

        {insightsQuery.isLoading ? (
          <View className="items-center py-16">
            <ActivityIndicator color={Colors.primary.DEFAULT} />
          </View>
        ) : (
          <View className="px-4">
            {ROWS.map((row) => (
              <View
                key={row.key}
                className="border-b border-gray-100 py-4 dark:border-gray-800"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-lg text-gray-900 dark:text-white">
                    {row.label}
                  </Text>
                  <Text className="text-lg font-bold text-gray-900 dark:text-white">
                    {summary ? summary[row.key] : 0}
                  </Text>
                </View>
                <Text className="mt-1 text-base leading-5 text-gray-500">
                  {row.hint}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View className="h-2 bg-neutral-border" />

        <View className="flex-row items-center justify-between px-4 pb-2 pt-4">
          <Text className="text-lg font-bold text-gray-900 dark:text-white">
            Last 365 Days
          </Text>
          <View ref={triggerRef}>
            <TouchableOpacity
              onPress={openViewMenu}
              className="flex-row items-center gap-1"
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Choose view"
            >
              <Text className="text-base text-gray-600 dark:text-gray-300">
                {VIEW_LABELS[view]}
              </Text>
              <Ionicons name="caret-down" size={14} color="#4B5563" />
            </TouchableOpacity>
          </View>
        </View>

        <View className="px-4 pb-6">
          {/* Y axis + grid + flat series lines (the API exposes totals only) */}
          <View className="flex-row">
            <View className="w-7 justify-between" style={{ height: 190 }}>
              {ticks.map((tick, index) => (
                <Text
                  key={`${tick}-${index}`}
                  className="text-sm text-gray-800 dark:text-gray-200"
                >
                  {tick}
                </Text>
              ))}
            </View>
            <View className="flex-1" style={{ height: 190 }}>
              {ticks.map((tick, index) => (
                <View
                  key={`grid-${tick}-${index}`}
                  style={{
                    position: "absolute",
                    top: (index * 190) / (ticks.length - 1),
                    left: 0,
                    right: 0,
                    height: 1,
                    backgroundColor: "#E5E7EB",
                  }}
                />
              ))}
              {series.map((entry) => (
                <View
                  key={entry.label}
                  style={{
                    position: "absolute",
                    bottom: (entry.value / axisMax) * (190 - 2),
                    left: 0,
                    right: 0,
                    height: 2,
                    backgroundColor: entry.color,
                  }}
                />
              ))}
            </View>
          </View>

          <View className="ml-7 flex-row justify-between pt-2">
            {dateLabels.map((label) => (
              <Text key={label} className="text-sm text-gray-700">
                {label}
              </Text>
            ))}
          </View>

          {/* Range slider (visual only for now) */}
          <View className="mt-4 h-11 flex-row items-center">
            <View className="-mr-2 h-11 w-6 rounded-md bg-gray-500" />
            <View className="h-11 flex-1 bg-gray-100" />
            <View className="-ml-2 h-11 w-6 rounded-md bg-gray-500" />
          </View>

          {/* Legend */}
          <View className="mt-4 flex-row flex-wrap">
            {series.map((entry) => (
              <View
                key={entry.label}
                className="mb-3"
                style={{ width: series.length === 2 ? "50%" : "33.33%" }}
              >
                <View className="flex-row items-center">
                  <View
                    className="mr-2 h-1.5 w-6 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <Text className="text-base text-gray-900 dark:text-white">
                    {entry.label}
                  </Text>
                </View>
                <Text className="ml-8 mt-1 text-base font-bold text-gray-900 dark:text-white">
                  {entry.value}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Anchored view menu (Overview / Engagements) */}
      <Modal
        visible={menuPos !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuPos(null)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setMenuPos(null)}
          className="flex-1"
        >
          {menuPos ? (
            <View
              className="min-w-[180px] overflow-hidden rounded-lg bg-white shadow-lg dark:bg-gray-900"
              style={{
                position: "absolute",
                top: menuPos.top,
                right: menuPos.right,
              }}
            >
              {(["overview", "engagement"] as const).map((option) => (
                <TouchableOpacity
                  key={option}
                  onPress={() => {
                    setView(option);
                    setMenuPos(null);
                  }}
                  activeOpacity={0.7}
                  className={`px-5 py-4 ${
                    view === option
                      ? "bg-gray-200 dark:bg-gray-800"
                      : "bg-transparent"
                  }`}
                >
                  <Text className="text-base text-gray-900 dark:text-white">
                    {VIEW_LABELS[option]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
