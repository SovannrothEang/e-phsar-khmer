import SafeAreaView from "@/components/common/SafeAreaView";
import SelectionSheet from "@/components/common/SelectionSheet";
import { Colors } from "@/constants/Colors";
import {
  fetchAppliedJobs,
  fetchReceivedApplications,
  type JobApplicationStatus,
} from "@/lib/api/applications";
import { formatListingDate } from "@/lib/listings";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type TabKey = "applications" | "applied";
type SheetKind = "status" | "sort" | null;

const TABS: { key: TabKey; label: string }[] = [
  { key: "applications", label: "Applications" },
  { key: "applied", label: "Applied" },
];

/** Status options differ per tab, per the reference sheets. */
function statusOptionsFor(tab: TabKey): { id: string; name: string }[] {
  if (tab === "applications") {
    return [
      { id: "all", name: "All" },
      { id: "pending", name: "New" },
      { id: "viewed", name: "Viewed" },
    ];
  }
  return [
    { id: "all", name: "All" },
    { id: "pending", name: "Pending" },
    { id: "viewed", name: "Viewed" },
    { id: "hired", name: "Hired" },
    { id: "rejected", name: "Reject" },
  ];
}

interface JobRow {
  id: string;
  status: JobApplicationStatus;
  createdAt: string;
  title: string;
  person: string;
}

export default function JobsScreen() {
  const [tab, setTab] = useState<TabKey>("applications");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [sheet, setSheet] = useState<SheetKind>(null);

  const receivedQuery = useQuery({
    queryKey: ["received-applications"],
    queryFn: () => fetchReceivedApplications(),
    enabled: tab === "applications",
  });
  const appliedQuery = useQuery({
    queryKey: ["applied-jobs"],
    queryFn: () => fetchAppliedJobs(),
    enabled: tab === "applied",
  });
  const activeQuery = tab === "applications" ? receivedQuery : appliedQuery;

  const rows = useMemo<JobRow[]>(() => {
    if (tab === "applications") {
      return (receivedQuery.data ?? []).map((item) => ({
        id: item.id,
        status: item.status,
        createdAt: item.createdAt,
        title: item.listing.title,
        person: item.applicant.username ?? "Applicant",
      }));
    }
    return (appliedQuery.data ?? []).map((item) => ({
      id: item.id,
      status: item.status,
      createdAt: item.createdAt,
      title: item.listing.title,
      person: item.poster.username ?? "Poster",
    }));
  }, [tab, receivedQuery.data, appliedQuery.data]);

  const filtered = useMemo(
    () =>
      rows
        .filter((row) => statusFilter === "all" || row.status === statusFilter)
        .sort((a, b) =>
          sort === "newest"
            ? b.createdAt.localeCompare(a.createdAt)
            : a.createdAt.localeCompare(b.createdAt),
        ),
    [rows, statusFilter, sort],
  );

  const statusLabel =
    statusOptionsFor(tab).find((option) => option.id === statusFilter)?.name ??
    "All";

  return (
    <SafeAreaView
      statusBarColor={Colors.primary.DEFAULT}
      statusBarStyle="light-content"
      className="flex-1 bg-neutral-background"
    >
      {/* Header with the two tabs */}
      <View className="bg-primary">
        <View className="flex-row items-center px-4 py-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="p-1"
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="flex-1 text-center text-lg font-bold text-white">
            Jobs
          </Text>
          <View className="w-8" />
        </View>
        <View className="flex-row">
          {TABS.map((entry) => {
            const active = tab === entry.key;
            return (
              <TouchableOpacity
                key={entry.key}
                onPress={() => {
                  setTab(entry.key);
                  setStatusFilter("all");
                }}
                activeOpacity={0.8}
                className="flex-1 items-center"
              >
                <Text
                  className={`pb-2 pt-3 text-base font-semibold ${
                    active ? "text-white" : "text-white/80"
                  }`}
                >
                  {entry.label}
                </Text>
                <View
                  className={`h-1 w-full ${
                    active ? "bg-sky-200" : "bg-transparent"
                  }`}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Status + Sort toolbar */}
      <View className="flex-row items-center gap-8 border-b border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
        <TouchableOpacity
          onPress={() => setSheet("status")}
          className="flex-row items-center gap-1"
          activeOpacity={0.7}
        >
          <Text className="text-base font-semibold text-gray-900 dark:text-white">
            Status: {statusLabel}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#111827" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSheet("sort")}
          className="flex-row items-center gap-1"
          activeOpacity={0.7}
        >
          <Text className="text-base font-semibold text-gray-900 dark:text-white">
            Sort: {sort === "newest" ? "Newest" : "Oldest"}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#111827" />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {activeQuery.isLoading ? (
          <View className="items-center py-16">
            <ActivityIndicator color={Colors.primary.DEFAULT} />
          </View>
        ) : filtered.length === 0 ? (
          <Text className="py-16 text-center text-base text-gray-400">
            No Result!
          </Text>
        ) : (
          filtered.map((row) => (
            <View
              key={row.id}
              className="mx-4 mb-2 rounded-lg bg-white p-4 dark:bg-gray-900"
            >
              <View className="flex-row items-center justify-between gap-2">
                <Text
                  className="flex-1 text-base font-semibold text-gray-900 dark:text-white"
                  numberOfLines={1}
                >
                  {row.title}
                </Text>
                <View className="rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-800">
                  <Text className="text-xs font-medium capitalize text-gray-500">
                    {row.status}
                  </Text>
                </View>
              </View>
              <Text className="mt-1 text-sm text-gray-500">
                @{row.person} · {formatListingDate(row.createdAt)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      <SelectionSheet
        visible={sheet === "status"}
        title="Status"
        options={statusOptionsFor(tab)}
        value={statusFilter}
        onSelect={(option) => {
          setStatusFilter(option.id);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
        searchable={false}
        compact
      />
      <SelectionSheet
        visible={sheet === "sort"}
        title="Sort"
        options={[
          { id: "newest", name: "Newest" },
          { id: "oldest", name: "Oldest" },
        ]}
        value={sort}
        onSelect={(option) => {
          setSort(option.id);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
        searchable={false}
        compact
      />
    </SafeAreaView>
  );
}
