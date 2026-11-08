import DropdownField from "@/components/common/DropdownField";
import FloatingInput from "@/components/common/FloatingInput";
import { Colors } from "@/constants/Colors";
import {
  dateToMonthYear,
  monthYearToDate,
  type MonthYear,
  type ResumeEducation,
} from "@/lib/api/resume";
import * as Crypto from "expo-crypto";
import { useColorScheme } from "nativewind";
import React, { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { MonthYearField } from "./DateSheet";
import ResumeFooter from "./ResumeFooter";
import { educationOptions } from "./options";

export interface EducationFormValue {
  id: string;
  school: string;
  degree: string;
  major: string;
  startDate: string;
  endDate: string | null;
  current: boolean;
  description: string;
}

interface EducationFormProps {
  initial: ResumeEducation | null;
  onSave: (value: EducationFormValue) => Promise<boolean>;
  onClose: () => void;
}

const required = "Please fill in this field.";

/** Add/Edit education form — no step pill, full-width orange Save. */
export default function EducationForm({
  initial,
  onSave,
  onClose,
}: EducationFormProps) {
  const { colorScheme } = useColorScheme();
  const trackOff = colorScheme === "dark" ? "#3A3A3C" : "#E5E7EB";
  const idRef = useRef(initial?.id ?? Crypto.randomUUID());
  const [school, setSchool] = useState(initial?.school ?? "");
  const [degree, setDegree] = useState<string | null>(initial?.degree ?? null);
  const [major, setMajor] = useState(initial?.major ?? "");
  const [start, setStart] = useState<MonthYear | null>(
    dateToMonthYear(initial?.startDate ?? null),
  );
  const [end, setEnd] = useState<MonthYear | null>(
    dateToMonthYear(initial?.endDate ?? null),
  );
  const [current, setCurrent] = useState(initial?.current ?? false);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);

  const schoolMissing = school.trim() === "";
  const degreeMissing = !degree;
  const majorMissing = major.trim() === "";
  const startMissing = start === null;
  const endMissing = !current && end === null;
  const orderInvalid =
    !current &&
    start !== null &&
    end !== null &&
    end.year * 12 + end.month < start.year * 12 + start.month;

  const save = async () => {
    if (
      schoolMissing ||
      degreeMissing ||
      majorMissing ||
      startMissing ||
      endMissing ||
      orderInvalid
    ) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    const ok = await onSave({
      id: idRef.current,
      school: school.trim(),
      degree: degree as string,
      major: major.trim(),
      startDate: monthYearToDate(start) as string,
      endDate: current ? null : monthYearToDate(end),
      current,
      description,
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
          <FloatingInput
            label="School"
            value={school}
            onChangeText={setSchool}
            maxLength={100}
            required
            variant="filled"
            error={showErrors && schoolMissing ? required : undefined}
          />

          <DropdownField
            label="Degree"
            value={degree ?? ""}
            options={educationOptions}
            onSelect={(option) => setDegree(option.id)}
            required
            variant="filled"
            picker="actions"
            error={
              showErrors && degreeMissing
                ? "Please select a degree."
                : undefined
            }
          />

          <FloatingInput
            label="Major"
            value={major}
            onChangeText={setMajor}
            maxLength={100}
            required
            variant="filled"
            error={showErrors && majorMissing ? required : undefined}
          />

          <View>
            <Text className="mb-2 text-base font-bold text-gray-900 dark:text-white">
              I currently attend here : Year - Month
            </Text>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <MonthYearField
                  label="Start"
                  value={start}
                  onChange={setStart}
                  required
                  error={
                    showErrors && startMissing
                      ? "Please select a start date."
                      : undefined
                  }
                />
              </View>
              <View className="flex-1">
                <MonthYearField
                  label="End"
                  value={end}
                  onChange={setEnd}
                  disabled={current}
                  disabledText="Present"
                  error={
                    showErrors && (endMissing || orderInvalid)
                      ? endMissing
                        ? "Please select an end date."
                        : "End date must be after the start date."
                      : undefined
                  }
                />
              </View>
            </View>
          </View>

          <View className="flex-row items-center justify-between">
            <Text className="text-base font-bold text-gray-900 dark:text-white">
              I currently attend here
            </Text>
            <Switch
              value={current}
              onValueChange={(next) => {
                setCurrent(next);
                if (next) setEnd(null);
              }}
              trackColor={{ false: trackOff, true: Colors.primary.DEFAULT }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={trackOff}
            />
          </View>

          <FloatingInput
            label="Description"
            value={description}
            onChangeText={setDescription}
            multiline
            multilineHeight={220}
            maxLength={2000}
            variant="filled"
          />
        </View>
      </ScrollView>

      <ResumeFooter primaryLabel="Save" onPrimary={save} saving={saving} />
    </KeyboardAvoidingView>
  );
}
