import DropdownField from "@/components/common/DropdownField";
import FloatingInput from "@/components/common/FloatingInput";
import type { ResumeLanguage, ResumeSkill } from "@/lib/api/resume";
import * as Crypto from "expo-crypto";
import React, { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import ResumeFooter from "./ResumeFooter";
import { languageLevelOptions, skillLevelOptions } from "./options";

export interface LevelFormValue {
  id: string;
  title: string;
  level: string;
}

interface LevelFormProps {
  kind: "skill" | "language";
  initial: ResumeSkill | ResumeLanguage | null;
  onSave: (value: LevelFormValue) => Promise<boolean>;
  onClose: () => void;
}

/** Add/Edit Skill or Language — the two forms share everything but options. */
export default function LevelForm({
  kind,
  initial,
  onSave,
  onClose,
}: LevelFormProps) {
  const idRef = useRef(initial?.id ?? Crypto.randomUUID());
  const [title, setTitle] = useState(initial?.title ?? "");
  const [level, setLevel] = useState<string | null>(
    initial?.level ? initial.level : null,
  );
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);

  const titleMissing = title.trim() === "";
  const levelMissing = !level;
  const options = kind === "skill" ? skillLevelOptions : languageLevelOptions;

  const save = async () => {
    if (titleMissing || levelMissing) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    const ok = await onSave({
      id: idRef.current,
      title: title.trim(),
      level: level as string,
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
            label="Title"
            value={title}
            onChangeText={setTitle}
            maxLength={50}
            required
            variant="filled"
            error={
              showErrors && titleMissing
                ? "Please fill in this field."
                : undefined
            }
          />

          <DropdownField
            label="Level"
            value={level ?? ""}
            options={options}
            onSelect={(option) => setLevel(option.id)}
            required
            variant="filled"
            picker="actions"
            error={
              showErrors && levelMissing ? "Please select a level." : undefined
            }
          />
        </View>
      </ScrollView>

      <ResumeFooter primaryLabel="Save" onPrimary={save} saving={saving} />
    </KeyboardAvoidingView>
  );
}
