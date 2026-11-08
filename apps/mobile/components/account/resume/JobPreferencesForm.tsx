import BottomSheet from "@/components/common/BottomSheet";
import FloatingInput, {
  FloatingLabel,
} from "@/components/common/FloatingInput";
import { Colors } from "@/constants/Colors";
import {
  fetchAttributeSet,
  fetchCategory,
  fetchProvinces,
} from "@/lib/api/catalog";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useColorScheme } from "nativewind";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { JobPreferenceDraft } from "./draft";
import ResumeFooter from "./ResumeFooter";

const EMPLOYMENT_TYPE_SLUGS = new Set([
  "full-time",
  "part-time",
  "internships",
  "freelance",
  "contract",
  "volunteer",
  "other-jobs",
]);

interface MultiOption {
  id: string;
  name: string;
}

interface JobPreferencesFormProps {
  initial: JobPreferenceDraft | null;
  onSave: (value: JobPreferenceDraft) => Promise<boolean>;
  onClose: () => void;
}

function MultiSelectSheet({
  visible,
  title,
  options,
  selected,
  onToggle,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: MultiOption[];
  selected: string[];
  onToggle: (value: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      height={Math.round(windowHeight * 0.75)}
    >
      <View className="flex-1 bg-white dark:bg-[#1C1C1E]">
        <View className="flex-row items-center px-4 pb-1 pt-4">
          <TouchableOpacity
            onPress={onClose}
            className="h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-[#3A3A3C]"
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={20} color="#8E8E93" />
          </TouchableOpacity>
          <Text className="flex-1 text-center text-xl font-bold text-gray-900 dark:text-white">
            {title}
          </Text>
          <View className="h-10 w-10" />
        </View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 8 }}
        >
          {options.map((option) => {
            const checked = selected.includes(option.name);
            return (
              <TouchableOpacity
                key={option.id}
                onPress={() => onToggle(option.name)}
                activeOpacity={0.7}
                className="flex-row items-center border-b border-gray-100 px-4 py-4 dark:border-[#2C2C2E]"
              >
                <Text className="flex-1 text-lg text-gray-900 dark:text-white">
                  {option.name}
                </Text>
                <View
                  className={`ml-3 h-6 w-6 items-center justify-center rounded-full ${
                    checked
                      ? ""
                      : "border-2 border-gray-300 dark:border-gray-600"
                  }`}
                  style={
                    checked ? { backgroundColor: Colors.primary.DEFAULT } : null
                  }
                >
                  {checked ? (
                    <Ionicons name="checkmark" size={16} color="white" />
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View
          className="px-4 pt-3"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.85}
            className="h-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: Colors.primary.DEFAULT }}
            accessibilityRole="button"
            accessibilityLabel="Done"
          >
            <Text className="text-base font-bold text-white">Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheet>
  );
}

function MultiSelectField({
  label,
  values,
  options,
  onChange,
}: {
  label: string;
  values: string[];
  options: MultiOption[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const disabled = options.length === 0;

  const toggle = (value: string) => {
    onChange(
      values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value],
    );
  };

  return (
    <View>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        disabled={disabled}
        activeOpacity={0.8}
        className={`h-14 flex-row items-center rounded-lg bg-[#F2F2F7] px-4 dark:bg-[#3A3A3C] ${
          disabled ? "opacity-60" : ""
        }`}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <FloatingLabel label={label} active={values.length > 0} />
        {values.length > 0 ? (
          <Text
            className="text-base text-gray-900 dark:text-white"
            style={{ position: "absolute", left: 16, right: 44, top: 24 }}
            numberOfLines={1}
          >
            {values.join(", ")}
          </Text>
        ) : null}
        <View className="flex-1" />
        {values.length > 0 ? (
          <TouchableOpacity
            onPress={() => onChange([])}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label}`}
          >
            <Ionicons name="close-circle" size={20} color="#C7C7CC" />
          </TouchableOpacity>
        ) : (
          <Ionicons name="chevron-down" size={20} color={Colors.text.muted} />
        )}
      </TouchableOpacity>

      <MultiSelectSheet
        visible={open}
        title={label}
        options={options}
        selected={values}
        onToggle={toggle}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

/** The overview's Job Preferences form — the web's add/edit dialog. */
export default function JobPreferencesForm({
  initial,
  onSave,
  onClose,
}: JobPreferencesFormProps) {
  const { colorScheme } = useColorScheme();
  const trackOff = colorScheme === "dark" ? "#3A3A3C" : "#E5E7EB";
  const [openJob, setOpenJob] = useState(initial?.openJob ?? false);
  const [position, setPosition] = useState(initial?.position ?? "");
  const [categories, setCategories] = useState(initial?.category ?? []);
  const [locations, setLocations] = useState(initial?.location ?? []);
  const [jobTypes, setJobTypes] = useState(initial?.jobType ?? []);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);

  const categoriesQuery = useQuery({
    queryKey: ["resume-job-options", "categories"],
    queryFn: () => fetchCategory("jobs"),
    staleTime: 5 * 60 * 1000,
  });
  const jobTypesQuery = useQuery({
    queryKey: ["resume-job-options", "job-types"],
    queryFn: () => fetchAttributeSet("jobtypes"),
    staleTime: 5 * 60 * 1000,
  });
  const provincesQuery = useQuery({
    queryKey: ["resume-job-options", "provinces"],
    queryFn: fetchProvinces,
    staleTime: 5 * 60 * 1000,
  });

  const categoryOptions = useMemo<MultiOption[]>(
    () =>
      (categoriesQuery.data?.subcategories ?? []).map((subcategory) => ({
        id: subcategory.id,
        name: subcategory.name,
      })),
    [categoriesQuery.data],
  );
  const jobTypeOptions = useMemo<MultiOption[]>(
    () =>
      (jobTypesQuery.data ?? [])
        .filter((item) => EMPLOYMENT_TYPE_SLUGS.has(item.slug))
        .map((item) => ({ id: item.id, name: item.name })),
    [jobTypesQuery.data],
  );
  const locationOptions = useMemo<MultiOption[]>(
    () =>
      (provincesQuery.data ?? []).map((province) => ({
        id: province.id,
        name: province.name,
      })),
    [provincesQuery.data],
  );

  const optionsLoading =
    categoriesQuery.isLoading ||
    jobTypesQuery.isLoading ||
    provincesQuery.isLoading;
  const optionsError =
    categoriesQuery.isError || jobTypesQuery.isError || provincesQuery.isError;

  const retryOptions = () => {
    void categoriesQuery.refetch();
    void jobTypesQuery.refetch();
    void provincesQuery.refetch();
  };

  const positionMissing = openJob && position.trim() === "";

  const save = async () => {
    if (positionMissing) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    const ok = await onSave({
      openJob,
      position: position.trim(),
      category: categories,
      location: locations,
      jobType: jobTypes,
    });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-5">
          <View className="flex-row items-center justify-between rounded-lg bg-[#F2F2F7] px-4 py-3 dark:bg-[#3A3A3C]">
            <Text className="text-base text-gray-900 dark:text-white">
              Open Job
            </Text>
            <Switch
              value={openJob}
              onValueChange={setOpenJob}
              trackColor={{ false: trackOff, true: Colors.primary.DEFAULT }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={trackOff}
            />
          </View>

          <FloatingInput
            label="Preferred Position"
            value={position}
            onChangeText={setPosition}
            maxLength={100}
            required={openJob}
            variant="filled"
            error={
              showErrors && positionMissing
                ? "Please enter the preferred position."
                : undefined
            }
          />

          <MultiSelectField
            label="Categories"
            values={categories}
            options={categoryOptions}
            onChange={setCategories}
          />
          <MultiSelectField
            label="Locations"
            values={locations}
            options={locationOptions}
            onChange={setLocations}
          />
          <MultiSelectField
            label="Job Type"
            values={jobTypes}
            options={jobTypeOptions}
            onChange={setJobTypes}
          />

          {optionsLoading ? (
            <View className="flex-row items-center gap-2">
              <ActivityIndicator size="small" color={Colors.primary.DEFAULT} />
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                Loading options…
              </Text>
            </View>
          ) : optionsError ? (
            <View className="flex-row items-center gap-3">
              <Text className="flex-1 text-sm text-red-500">
                Could not load the picker options.
              </Text>
              <TouchableOpacity
                onPress={retryOptions}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Retry loading options"
              >
                <Text
                  className="text-sm font-semibold"
                  style={{ color: Colors.primary.DEFAULT }}
                >
                  Retry
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <ResumeFooter primaryLabel="Save" onPrimary={save} saving={saving} />
    </KeyboardAvoidingView>
  );
}
