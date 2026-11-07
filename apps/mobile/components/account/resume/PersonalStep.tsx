import DropdownField from "@/components/common/DropdownField";
import FloatingInput from "@/components/common/FloatingInput";
import { Colors } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Image, TouchableOpacity, View } from "react-native";
import Choice from "./Choice";
import { DobField } from "./DateSheet";
import type { PersonalDraft } from "./draft";
import LocationField from "./LocationPicker";
import { educationOptions, GENDERS, MARITAL_STATUSES } from "./options";
import PhoneRows from "./PhoneRows";

export interface PersonalErrors {
  firstName?: string;
  lastName?: string;
  phoneRows?: (string | undefined)[];
  phoneGroup?: string;
  email?: string;
  years?: string;
}

interface PersonalStepProps {
  draft: PersonalDraft;
  onChange: (patch: Partial<PersonalDraft>) => void;
  errors: PersonalErrors;
  photoUploading: boolean;
  onPickPhoto: () => void;
}

/** Step 1 — the reference's dark personal-details form. */
export default function PersonalStep({
  draft,
  onChange,
  errors,
  photoUploading,
  onPickPhoto,
}: PersonalStepProps) {
  return (
    <View className="gap-5">
      <View className="flex-row items-stretch gap-4">
        <TouchableOpacity
          onPress={onPickPhoto}
          activeOpacity={0.8}
          className="relative w-24 items-center justify-center overflow-hidden rounded-lg bg-[#F2F2F7] dark:bg-[#3A3A3C]"
          accessibilityRole="button"
          accessibilityLabel="Upload photo"
        >
          {draft.photoUrl ? (
            <Image
              source={{ uri: draft.photoUrl }}
              className="h-full w-full"
              resizeMode="cover"
            />
          ) : null}
          {photoUploading ? (
            <View className="absolute inset-0 items-center justify-center bg-black/40">
              <ActivityIndicator color="white" />
            </View>
          ) : null}
          <View
            className="absolute bottom-1.5 right-1.5 h-7 w-7 items-center justify-center rounded-full"
            style={{ backgroundColor: Colors.primary.DEFAULT }}
          >
            <Ionicons name="pencil" size={14} color="white" />
          </View>
        </TouchableOpacity>

        <View className="flex-1 gap-3">
          <FloatingInput
            label="First Name"
            value={draft.firstName}
            onChangeText={(firstName) => onChange({ firstName })}
            maxLength={50}
            required
            variant="filled"
            error={errors.firstName}
          />
          <FloatingInput
            label="Last Name"
            value={draft.lastName}
            onChangeText={(lastName) => onChange({ lastName })}
            maxLength={50}
            required
            variant="filled"
            error={errors.lastName}
          />
        </View>
      </View>

      <Choice
        label="Gender"
        options={GENDERS}
        value={draft.gender}
        onChange={(gender) => onChange({ gender })}
      />

      <DobField
        label="Date Of Birth"
        value={draft.dob}
        onChange={(dob) => onChange({ dob })}
      />

      <FloatingInput
        label="Nationality"
        value={draft.nationality}
        onChangeText={(nationality) => onChange({ nationality })}
        maxLength={50}
        variant="filled"
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

      <PhoneRows
        phones={draft.phones}
        onChange={(phones) => onChange({ phones })}
        errors={errors.phoneRows}
        groupError={errors.phoneGroup}
      />

      <LocationField
        value={draft.place}
        onChange={(place) => onChange({ place })}
      />

      <FloatingInput
        label="Address"
        value={draft.address}
        onChangeText={(address) => onChange({ address })}
        maxLength={200}
        variant="filled"
      />

      <DropdownField
        label="Education Level"
        value={draft.educationLevel ?? ""}
        options={educationOptions}
        onSelect={(option) => onChange({ educationLevel: option.id })}
        variant="filled"
        picker="actions"
      />

      <FloatingInput
        label="Current Position"
        value={draft.position}
        onChangeText={(position) => onChange({ position })}
        maxLength={100}
        variant="filled"
      />

      <FloatingInput
        label="Years of Experience"
        value={draft.yearsOfExperience}
        onChangeText={(yearsOfExperience) => onChange({ yearsOfExperience })}
        keyboardType="numeric"
        maxLength={3}
        variant="filled"
        error={errors.years}
      />

      <Choice
        label="Marital Status"
        options={MARITAL_STATUSES}
        value={draft.maritalStatus}
        onChange={(maritalStatus) => onChange({ maritalStatus })}
      />
    </View>
  );
}
