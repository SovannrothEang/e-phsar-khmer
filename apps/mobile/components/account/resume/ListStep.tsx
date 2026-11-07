import {
  formatMonthYear,
  type ResumeEducation,
  type ResumeLanguage,
  type ResumeSkill,
} from "@/lib/api/resume";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import EntryRow from "./EntryRow";

type Entry = ResumeEducation | ResumeSkill | ResumeLanguage;

interface ListStepProps {
  section: "educations" | "skills" | "languages";
  educations: ResumeEducation[];
  skills: ResumeSkill[];
  languages: ResumeLanguage[];
  onAdd: () => void;
  onEdit: (entry: Entry) => void;
  onDelete: (entry: Entry) => void;
}

const ADD_LABELS = {
  educations: "Add Education",
  skills: "Add Skill",
  languages: "Add Language",
} as const;

const EMPTY_LABELS = {
  educations: "No education added yet.",
  skills: "No skills added yet.",
  languages: "No languages added yet.",
} as const;

/** Shared list step for Educations / Skills / Languages. */
export default function ListStep({
  section,
  educations,
  skills,
  languages,
  onAdd,
  onEdit,
  onDelete,
}: ListStepProps) {
  const entries: Entry[] =
    section === "educations"
      ? educations
      : section === "skills"
        ? skills
        : languages;

  return (
    <View>
      {entries.length === 0 ? (
        <Text className="py-3 text-sm text-gray-500 dark:text-gray-400">
          {EMPTY_LABELS[section]}
        </Text>
      ) : (
        entries.map((entry) => {
          if (section === "educations") {
            const education = entry as ResumeEducation;
            const range = `${formatMonthYear(education.startDate)} • ${
              education.current ? "Present" : formatMonthYear(education.endDate)
            }`;
            return (
              <EntryRow
                key={education.id}
                title={education.school}
                subtitle={range}
                detail={`${education.degree} in ${education.major}`}
                status={
                  !education.current && education.endDate
                    ? "Graduated"
                    : undefined
                }
                onEdit={() => onEdit(entry)}
                onDelete={() => onDelete(entry)}
              />
            );
          }

          const skill = entry as ResumeSkill | ResumeLanguage;
          const hasLevel = skill.level.trim() !== "";
          return (
            <EntryRow
              key={skill.id}
              title={hasLevel ? `${skill.title} • ${skill.level}` : skill.title}
              missing={!hasLevel}
              onEdit={() => onEdit(entry)}
              onDelete={() => onDelete(entry)}
            />
          );
        })
      )}

      <TouchableOpacity
        onPress={onAdd}
        activeOpacity={0.85}
        className="mt-4 flex-row items-center gap-2 self-start rounded-lg px-4 py-2.5"
        style={{ backgroundColor: "#0EA5E9" }}
        accessibilityRole="button"
        accessibilityLabel={ADD_LABELS[section]}
      >
        <Ionicons name="add-circle-outline" size={20} color="white" />
        <Text className="text-base font-semibold text-white">
          {ADD_LABELS[section]}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
