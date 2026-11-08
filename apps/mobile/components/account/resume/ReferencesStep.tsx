import FloatingInput from "@/components/common/FloatingInput";
import React from "react";
import { View } from "react-native";
import type { ReferenceDraft } from "./draft";
import PhoneRows from "./PhoneRows";

export interface ReferenceErrors {
  name?: string;
  company?: string;
  position?: string;
  phoneRows?: (string | undefined)[];
  phoneGroup?: string;
  email?: string;
}

interface ReferencesStepProps {
  draft: ReferenceDraft;
  onChange: (patch: Partial<ReferenceDraft>) => void;
  errors: ReferenceErrors;
}

/** Step 8 — the single reference form. */
export default function ReferencesStep({
  draft,
  onChange,
  errors,
}: ReferencesStepProps) {
  return (
    <View className="gap-5">
      <FloatingInput
        label="Name"
        value={draft.name}
        onChangeText={(name) => onChange({ name })}
        maxLength={50}
        required
        variant="filled"
        error={errors.name}
      />

      <FloatingInput
        label="Company"
        value={draft.company}
        onChangeText={(company) => onChange({ company })}
        maxLength={100}
        required
        variant="filled"
        error={errors.company}
      />

      <FloatingInput
        label="Position"
        value={draft.position}
        onChangeText={(position) => onChange({ position })}
        maxLength={100}
        required
        variant="filled"
        error={errors.position}
      />

      <PhoneRows
        phones={draft.phones}
        onChange={(phones) => onChange({ phones })}
        errors={errors.phoneRows}
        groupError={errors.phoneGroup}
      />

      <FloatingInput
        label="Email"
        value={draft.email}
        onChangeText={(email) => onChange({ email })}
        keyboardType="email-address"
        autoCapitalize="none"
        maxLength={254}
        variant="filled"
        error={errors.email}
      />
    </View>
  );
}
