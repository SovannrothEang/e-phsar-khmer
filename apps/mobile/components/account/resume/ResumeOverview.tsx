import { Colors } from "@/constants/Colors";
import {
  formatMonthYear,
  formatMonthYearValue,
  resumeLocationLabel,
  type ResumeEducation,
  type ResumeLanguage,
  type ResumeSkill,
} from "@/lib/api/resume";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  type ScrollViewInstance,
} from "react-native";
import type { ResumeDraft } from "./draft";
import { educationOptions } from "./options";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

interface ResumeOverviewProps {
  draft: ResumeDraft;
  scrollRef: React.RefObject<ScrollViewInstance | null>;
  onEditPersonal: () => void;
  onEditStep: (step: number) => void;
  onAddEducation: () => void;
  onEditEducation: (entry: ResumeEducation) => void;
  onDeleteEducation: (entry: ResumeEducation) => void;
  onAddSkill: () => void;
  onEditSkill: (entry: ResumeSkill) => void;
  onDeleteSkill: (entry: ResumeSkill) => void;
  onAddLanguage: () => void;
  onEditLanguage: (entry: ResumeLanguage) => void;
  onDeleteLanguage: (entry: ResumeLanguage) => void;
  onDeleteExperience: () => void;
  onDeleteReference: () => void;
  onEntryMenu: (
    title: string,
    onEdit: () => void,
    onDelete: () => void,
  ) => void;
  onEditJobPreferences: () => void;
  onAttachmentActions: () => void;
  cvUploading: boolean;
  onUploadCv: () => void;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const NOT_DEFINED = "Not define";

const sectionClass = "bg-white px-4 py-5 dark:bg-[#1C1C1E]";

function formatDob(value: string | null): string {
  if (!value) return "N/A";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "N/A";
  return `${MONTHS[month - 1]}, ${String(day).padStart(2, "0")} ${year}`;
}

/** The reference's compact CV size: 191.10KB. */
function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
  }
  return `${(bytes / 1024).toFixed(2)}KB`;
}

function formatRange(
  start: string | null,
  end: string | null,
  current: boolean,
): string {
  return `${formatMonthYear(start)} • ${
    current || !end ? "Present" : formatMonthYear(end)
  }`;
}

function Gap() {
  return <View className="h-4 bg-neutral-border dark:bg-black" />;
}

function SectionDivider() {
  return <View className="mt-3 h-px bg-gray-200 dark:bg-[#2C2C2E]" />;
}

function SectionHeader({
  title,
  action,
  onAction,
  label,
  noticed = false,
}: {
  title: string;
  action?: "add" | "edit";
  onAction?: () => void;
  label?: string;
  noticed?: boolean;
}) {
  return (
    <View className="flex-row items-center">
      <Text
        className={`flex-1 text-xl font-bold ${
          noticed ? "text-amber-500" : "text-gray-900 dark:text-white"
        }`}
      >
        {title}
      </Text>
      {action && onAction ? (
        <TouchableOpacity
          onPress={onAction}
          activeOpacity={0.7}
          className="h-8 w-8 items-center justify-center rounded-full border"
          style={{ borderColor: Colors.primary.DEFAULT }}
          accessibilityRole="button"
          accessibilityLabel={label ?? title}
        >
          <Ionicons
            name={action === "add" ? "add" : "pencil"}
            size={17}
            color={Colors.primary.DEFAULT}
          />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function LinkRow({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: "add" | "edit";
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="mt-4 flex-row items-center gap-2 self-start"
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons
        name={icon === "add" ? "add-circle-outline" : "pencil"}
        size={20}
        color={Colors.primary.DEFAULT}
      />
      <Text
        className="text-base font-medium"
        style={{ color: Colors.primary.DEFAULT }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function EntryMenu({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="h-8 w-8 items-center justify-center"
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Entry actions"
    >
      <Ionicons name="ellipsis-vertical" size={18} color="#8E8E93" />
    </TouchableOpacity>
  );
}

function MissingPill() {
  return (
    <View className="rounded-full bg-orange-500/15 px-3 py-1">
      <Text className="text-sm font-semibold text-orange-500">
        Missing info
      </Text>
    </View>
  );
}

type CompletionAction =
  | { kind: "field" }
  | { kind: "step"; step: number }
  | { kind: "addEducation" }
  | { kind: "addSkill" }
  | { kind: "addLanguage" }
  | { kind: "attachment" };

interface CompletionItem {
  id: string;
  label: string;
  filled: boolean;
  action: CompletionAction;
}

/**
 * The finished-resume view from the reference: flat sections on the themed
 * background, the completion meter, and every section editable in place.
 */
export default function ResumeOverview({
  draft,
  scrollRef,
  onEditPersonal,
  onEditStep,
  onAddEducation,
  onEditEducation,
  onDeleteEducation,
  onAddSkill,
  onEditSkill,
  onDeleteSkill,
  onAddLanguage,
  onEditLanguage,
  onDeleteLanguage,
  onDeleteExperience,
  onDeleteReference,
  onEntryMenu,
  onEditJobPreferences,
  onAttachmentActions,
  cvUploading,
  onUploadCv,
}: ResumeOverviewProps) {
  const cvY = useRef(0);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cvNoticed, setCvNoticed] = useState(false);

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  const personal = draft.personal;
  const name =
    [personal.firstName, personal.lastName].filter(Boolean).join(" ").trim() ||
    "Your Name";
  const phone = personal.phones.find((value) => value.trim() !== "") ?? "";
  const education = personal.educationLevel
    ? (educationOptions.find((option) => option.id === personal.educationLevel)
        ?.name ?? personal.educationLevel)
    : "N/A";

  const summaryFilled = draft.summary.trim() !== "";
  const hobbiesFilled = draft.hobbies.trim() !== "";
  const experience = draft.experience;
  const reference = draft.reference;

  const items: CompletionItem[] = [
    {
      id: "photo",
      label: "Photo",
      filled: !!personal.photoUrl,
      action: { kind: "field" },
    },
    {
      id: "gender",
      label: "Gender",
      filled: !!personal.gender,
      action: { kind: "field" },
    },
    {
      id: "dob",
      label: "Date Of Birth",
      filled: !!personal.dob,
      action: { kind: "field" },
    },
    {
      id: "nationality",
      label: "Nationality",
      filled: personal.nationality.trim() !== "",
      action: { kind: "field" },
    },
    {
      id: "email",
      label: "Email",
      filled: personal.email.trim() !== "",
      action: { kind: "field" },
    },
    {
      id: "location",
      label: "Location",
      filled: !!personal.place.province,
      action: { kind: "field" },
    },
    {
      id: "address",
      label: "Address",
      filled: personal.address.trim() !== "",
      action: { kind: "field" },
    },
    {
      id: "phone",
      label: "Phone",
      filled: phone !== "",
      action: { kind: "field" },
    },
    {
      id: "marital",
      label: "Marital Status",
      filled: !!personal.maritalStatus,
      action: { kind: "field" },
    },
    {
      id: "education",
      label: "Education Level",
      filled: !!personal.educationLevel,
      action: { kind: "field" },
    },
    {
      id: "position",
      label: "Position",
      filled: personal.position.trim() !== "",
      action: { kind: "field" },
    },
    {
      id: "years",
      label: "Years of Experience",
      filled: personal.yearsOfExperience.trim() !== "",
      action: { kind: "field" },
    },
    {
      id: "summary",
      label: "Summary",
      filled: summaryFilled,
      action: { kind: "step", step: 2 },
    },
    {
      id: "educations",
      label: "Educations",
      filled: draft.educations.length > 0,
      action: { kind: "addEducation" },
    },
    {
      id: "experience",
      label: "Experience",
      filled: !!experience,
      action: { kind: "step", step: 3 },
    },
    {
      id: "skills",
      label: "Skills",
      filled: draft.skills.length > 0,
      action: { kind: "addSkill" },
    },
    {
      id: "hobbies",
      label: "Hobbies & Interests",
      filled: hobbiesFilled,
      action: { kind: "step", step: 7 },
    },
    {
      id: "languages",
      label: "Languages",
      filled: draft.languages.length > 0,
      action: { kind: "addLanguage" },
    },
    {
      id: "references",
      label: "References",
      filled: !!reference,
      action: { kind: "step", step: 8 },
    },
    {
      id: "attachment",
      label: "Attachment",
      filled: !!draft.attachment,
      action: { kind: "attachment" },
    },
  ];

  const missing = items.filter((item) => !item.filled);
  const percent = Math.round(
    ((items.length - missing.length) / items.length) * 100,
  );

  const scrollToCv = () => {
    scrollRef.current?.scrollTo({
      y: Math.max(0, cvY.current - 12),
      animated: true,
    });
    setCvNoticed(true);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setCvNoticed(false), 2000);
  };

  const handleMissing = (action: CompletionAction) => {
    if (action.kind === "field") {
      onEditPersonal();
      return;
    }
    if (action.kind === "step") {
      onEditStep(action.step);
      return;
    }
    if (action.kind === "addEducation") {
      onAddEducation();
      return;
    }
    if (action.kind === "addSkill") {
      onAddSkill();
      return;
    }
    if (action.kind === "addLanguage") {
      onAddLanguage();
      return;
    }
    scrollToCv();
  };

  const sortedEducations = [...draft.educations].sort((a, b) =>
    b.startDate.localeCompare(a.startDate),
  );

  const jobPreference = draft.jobPreference;
  const jobRows = [
    {
      label: "Open Job",
      value: jobPreference?.openJob ? "Enable" : "Disable",
    },
    {
      label: "Categories",
      value: jobPreference?.category.length
        ? jobPreference.category.join(" , ")
        : NOT_DEFINED,
    },
    {
      label: "Location",
      value: jobPreference?.location.length
        ? jobPreference.location.join(" , ")
        : NOT_DEFINED,
    },
    {
      label: "Preferred Position",
      value: jobPreference?.position.trim() || NOT_DEFINED,
    },
    {
      label: "Job Type",
      value: jobPreference?.jobType.length
        ? jobPreference.jobType.join(" , ")
        : NOT_DEFINED,
    },
  ];

  const infoRow = (
    icon: IoniconName,
    value: string,
    options?: {
      label?: string;
      onPress?: () => void;
      gray?: boolean;
      valueGray?: boolean;
    },
  ) => {
    const line = (
      <View className="mt-3 flex-row items-center gap-3">
        <Ionicons name={icon} size={18} color="#8E8E93" />
        {options?.label ? (
          <Text className="flex-1 text-base font-semibold text-gray-900 dark:text-white">
            {options.label}:{" "}
            <Text
              className={`font-normal ${
                options.valueGray
                  ? "text-gray-500 dark:text-gray-400"
                  : "text-gray-900 dark:text-white"
              }`}
              style={
                options.onPress ? { color: Colors.primary.DEFAULT } : undefined
              }
            >
              {value}
            </Text>
          </Text>
        ) : (
          <Text
            className={`flex-1 text-base ${
              options?.gray
                ? "text-gray-500 dark:text-gray-400"
                : "text-gray-900 dark:text-white"
            }`}
            style={
              options?.onPress ? { color: Colors.primary.DEFAULT } : undefined
            }
          >
            {value}
          </Text>
        )}
      </View>
    );
    if (!options?.onPress) return line;
    return (
      <TouchableOpacity
        onPress={options.onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
      >
        {line}
      </TouchableOpacity>
    );
  };

  return (
    <View>
      {/* Personal information */}
      <View className={sectionClass}>
        <View className="flex-row items-start">
          <View className="min-w-0 flex-1">
            <Text className="text-2xl font-bold text-gray-900 dark:text-white">
              {name}
            </Text>

            {infoRow("male-female-outline", personal.gender ?? "N/A", {
              gray: !personal.gender,
            })}
            {infoRow("calendar-outline", formatDob(personal.dob), {
              gray: !personal.dob,
            })}
            {infoRow("globe-outline", personal.nationality.trim() || "N/A", {
              gray: personal.nationality.trim() === "",
            })}
            {infoRow("call-outline", phone || "N/A", {
              gray: phone === "",
              onPress:
                phone !== ""
                  ? () => {
                      void Linking.openURL(`tel:${phone}`);
                    }
                  : undefined,
            })}
            {infoRow("mail-outline", personal.email.trim() || "N/A", {
              gray: personal.email.trim() === "",
              onPress:
                personal.email.trim() !== ""
                  ? () => {
                      void Linking.openURL(`mailto:${personal.email.trim()}`);
                    }
                  : undefined,
            })}
            {infoRow("school-outline", education, {
              label: "Education Level",
              valueGray: !personal.educationLevel,
            })}
            {infoRow("heart-outline", personal.maritalStatus ?? "N/A", {
              label: "Marital Status",
              valueGray: !personal.maritalStatus,
            })}

            <Text
              className={`mt-3 pl-[30px] text-base ${
                personal.address.trim()
                  ? "text-gray-900 dark:text-white"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              {personal.address.trim() || "N/A"}
            </Text>
          </View>

          <TouchableOpacity
            onPress={onEditPersonal}
            activeOpacity={0.8}
            className="ml-4 w-24 overflow-hidden rounded-lg border border-gray-400 dark:border-gray-300"
            style={{ aspectRatio: 3 / 4 }}
            accessibilityRole="button"
            accessibilityLabel="Edit profile photo"
          >
            {personal.photoUrl ? (
              <Image
                source={{ uri: personal.photoUrl }}
                className="h-full w-full"
                resizeMode="cover"
              />
            ) : null}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={onEditPersonal}
          activeOpacity={0.8}
          className="mt-5 h-12 items-center justify-center rounded-lg"
          style={{ backgroundColor: "rgba(14,165,233,0.12)" }}
          accessibilityRole="button"
          accessibilityLabel="Edit Personal Information"
        >
          <Text
            className="text-base font-semibold"
            style={{ color: Colors.primary.DEFAULT }}
          >
            Edit Personal Information
          </Text>
        </TouchableOpacity>
      </View>

      <Gap />

      {/* Completed profile */}
      <View className={sectionClass}>
        <Text className="text-xl font-bold text-gray-900 dark:text-white">
          Completed Profile
        </Text>
        <Text className="mt-3 text-base text-gray-500 dark:text-gray-400">
          {percent}% completed
        </Text>
        <View className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-black">
          <View
            className="h-full rounded-full"
            style={{
              width: `${percent}%`,
              backgroundColor: Colors.secondary.DEFAULT,
            }}
          />
        </View>
        {missing.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-4"
            contentContainerStyle={{ gap: 8 }}
          >
            {missing.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => handleMissing(item.action)}
                activeOpacity={0.8}
                className="flex-row items-center gap-2 rounded-full px-3 py-2"
                style={{ backgroundColor: "rgba(14,165,233,0.12)" }}
                accessibilityRole="button"
                accessibilityLabel={`Add ${item.label}`}
              >
                <Ionicons
                  name="add-circle"
                  size={18}
                  color={Colors.primary.DEFAULT}
                />
                <Text
                  className="text-sm font-medium"
                  style={{ color: Colors.primary.DEFAULT }}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}
      </View>

      <Gap />

      {/* Summary */}
      <View className={sectionClass}>
        <SectionHeader
          title="Summary"
          action={summaryFilled ? "edit" : "add"}
          onAction={() => onEditStep(2)}
          label={summaryFilled ? "Edit Summary" : "Add Summary"}
        />
        <SectionDivider />
        {summaryFilled ? (
          <>
            <Text className="mt-4 text-base leading-6 text-gray-900 dark:text-white">
              {draft.summary}
            </Text>
            <LinkRow
              label="Edit Summary"
              icon="edit"
              onPress={() => onEditStep(2)}
            />
          </>
        ) : (
          <>
            <Text className="mt-4 text-base text-gray-500 dark:text-gray-400">
              Write 2–4 concise, energetic sentences that highlight your role,
              experience, key achievements, and strongest qualities.
            </Text>
            <LinkRow
              label="Add Summary"
              icon="add"
              onPress={() => onEditStep(2)}
            />
          </>
        )}
      </View>

      <Gap />

      {/* Experience */}
      <View className={sectionClass}>
        <SectionHeader
          title="Experience"
          action={experience ? "edit" : "add"}
          onAction={() => onEditStep(3)}
          label={experience ? "Edit Experience" : "Add Experience"}
        />
        <SectionDivider />
        {experience ? (
          <>
            <View className="flex-row items-start gap-2 pt-2">
              <View className="min-w-0 flex-1">
                <Text className="mt-2 text-base font-bold text-gray-900 dark:text-white">
                  {experience.company}
                </Text>
                <Text className="mt-0.5 text-sm italic text-gray-500 dark:text-gray-400">
                  {`${formatMonthYearValue(experience.start)} • ${
                    experience.current || !experience.end
                      ? "Present"
                      : formatMonthYearValue(experience.end)
                  }`}
                </Text>
                <Text className="mt-1 text-base text-gray-900 dark:text-white">
                  {experience.position}
                  {experience.place.province
                    ? ` · ${resumeLocationLabel(experience.place)}`
                    : ""}
                </Text>
                {experience.description.trim() ? (
                  <Text
                    className="mt-1 text-sm text-gray-500 dark:text-gray-400"
                    numberOfLines={2}
                  >
                    {experience.description}
                  </Text>
                ) : null}
              </View>
              <EntryMenu
                onPress={() =>
                  onEntryMenu(
                    experience.company || "Experience",
                    () => onEditStep(3),
                    onDeleteExperience,
                  )
                }
              />
            </View>
            <LinkRow
              label="Edit Experience"
              icon="edit"
              onPress={() => onEditStep(3)}
            />
          </>
        ) : (
          <>
            <Text className="mt-4 text-base text-gray-500 dark:text-gray-400">
              Show your relevant experience (last 10 years).
            </Text>
            <LinkRow
              label="Add Experience"
              icon="add"
              onPress={() => onEditStep(3)}
            />
          </>
        )}
      </View>

      <Gap />

      {/* Educations */}
      <View className={sectionClass}>
        <SectionHeader
          title="Educations"
          action="add"
          onAction={onAddEducation}
          label="Add Education"
        />
        <SectionDivider />
        {sortedEducations.length > 0 ? (
          <>
            {sortedEducations.map((entry, index) => (
              <View
                key={entry.id}
                className={`flex-row items-start gap-2 py-4 ${
                  index < sortedEducations.length - 1
                    ? "border-b border-gray-100 dark:border-[#2C2C2E]"
                    : ""
                }`}
              >
                <View className="min-w-0 flex-1">
                  <Text className="text-base font-bold text-gray-900 dark:text-white">
                    {entry.school}
                  </Text>
                  <Text className="mt-0.5 text-sm italic text-gray-500 dark:text-gray-400">
                    {formatRange(entry.startDate, entry.endDate, entry.current)}
                  </Text>
                  <Text className="mt-1 text-base text-gray-900 dark:text-white">
                    {entry.degree}
                    {entry.major.trim() ? ` in ${entry.major}` : ""}
                  </Text>
                  {entry.description.trim() ? (
                    <Text
                      className="mt-1 text-sm text-gray-500 dark:text-gray-400"
                      numberOfLines={2}
                    >
                      {entry.description}
                    </Text>
                  ) : null}
                  {!entry.current && entry.endDate ? (
                    <Text className="mt-2 text-base text-gray-900 dark:text-white">
                      Graduated
                    </Text>
                  ) : null}
                </View>
                <EntryMenu
                  onPress={() =>
                    onEntryMenu(
                      entry.school,
                      () => onEditEducation(entry),
                      () => onDeleteEducation(entry),
                    )
                  }
                />
              </View>
            ))}
            <LinkRow
              label="Add Education"
              icon="add"
              onPress={onAddEducation}
            />
          </>
        ) : (
          <>
            <Text className="mt-4 text-base text-gray-500 dark:text-gray-400">
              Present your educational background to demonstrate the knowledge
              and value you bring to the role.
            </Text>
            <LinkRow
              label="Add Education"
              icon="add"
              onPress={onAddEducation}
            />
          </>
        )}
      </View>

      <Gap />

      {/* Skills */}
      <View className={sectionClass}>
        <SectionHeader
          title="Skills"
          action="add"
          onAction={onAddSkill}
          label="Add Skill"
        />
        <SectionDivider />
        {draft.skills.length > 0 ? (
          <>
            {draft.skills.map((skill, index) => (
              <View
                key={skill.id}
                className={`flex-row items-center gap-3 py-3.5 ${
                  index < draft.skills.length - 1
                    ? "border-b border-gray-100 dark:border-[#2C2C2E]"
                    : ""
                }`}
              >
                <Text className="min-w-0 flex-1 text-base text-gray-900 dark:text-white">
                  <Text className="font-bold">{skill.title}</Text>
                  {skill.level.trim() ? ` • ${skill.level}` : ""}
                </Text>
                {skill.level.trim() ? null : <MissingPill />}
                <EntryMenu
                  onPress={() =>
                    onEntryMenu(
                      skill.title,
                      () => onEditSkill(skill),
                      () => onDeleteSkill(skill),
                    )
                  }
                />
              </View>
            ))}
            <LinkRow label="Add Skill" icon="add" onPress={onAddSkill} />
          </>
        ) : (
          <>
            <Text className="mt-4 text-base text-gray-500 dark:text-gray-400">
              List the skills that best represent your strengths and help you
              stand out from other candidates.
            </Text>
            <LinkRow label="Add Skill" icon="add" onPress={onAddSkill} />
          </>
        )}
      </View>

      <Gap />

      {/* Languages */}
      <View className={sectionClass}>
        <SectionHeader
          title="Languages"
          action="add"
          onAction={onAddLanguage}
          label="Add Language"
        />
        <SectionDivider />
        {draft.languages.length > 0 ? (
          <>
            {draft.languages.map((language, index) => (
              <View
                key={language.id}
                className={`flex-row items-center gap-3 py-3.5 ${
                  index < draft.languages.length - 1
                    ? "border-b border-gray-100 dark:border-[#2C2C2E]"
                    : ""
                }`}
              >
                <Text className="min-w-0 flex-1 text-base text-gray-900 dark:text-white">
                  <Text className="font-bold">{language.title}</Text>
                  {language.level.trim() ? ` • ${language.level}` : ""}
                </Text>
                {language.level.trim() ? null : <MissingPill />}
                <EntryMenu
                  onPress={() =>
                    onEntryMenu(
                      language.title,
                      () => onEditLanguage(language),
                      () => onDeleteLanguage(language),
                    )
                  }
                />
              </View>
            ))}
            <LinkRow label="Add Language" icon="add" onPress={onAddLanguage} />
          </>
        ) : (
          <>
            <Text className="mt-4 text-base text-gray-500 dark:text-gray-400">
              Add the languages you speak to increase your opportunities with
              more companies and employers.
            </Text>
            <LinkRow label="Add Language" icon="add" onPress={onAddLanguage} />
          </>
        )}
      </View>

      <Gap />

      {/* Hobbies & Interests */}
      <View className={sectionClass}>
        <SectionHeader
          title="Hobbies & Interests"
          action={hobbiesFilled ? "edit" : "add"}
          onAction={() => onEditStep(7)}
          label={hobbiesFilled ? "Edit Hobbies & Interests" : "Add Hobbies"}
        />
        <SectionDivider />
        {hobbiesFilled ? (
          <>
            <Text className="mt-4 text-base leading-6 text-gray-900 dark:text-white">
              {draft.hobbies}
            </Text>
            <LinkRow
              label="Edit Hobbies & Interests"
              icon="edit"
              onPress={() => onEditStep(7)}
            />
          </>
        ) : (
          <>
            <Text className="mt-4 text-base text-gray-500 dark:text-gray-400">
              A sentence or two on what you do outside work. It gives employers
              a sense of who you are.
            </Text>
            <LinkRow
              label="Add Hobbies & Interests"
              icon="add"
              onPress={() => onEditStep(7)}
            />
          </>
        )}
      </View>

      <Gap />

      {/* References */}
      <View className={sectionClass}>
        <SectionHeader
          title="References"
          action={reference ? "edit" : "add"}
          onAction={() => onEditStep(8)}
          label={reference ? "Edit Reference" : "Add Reference"}
        />
        <SectionDivider />
        {reference ? (
          <>
            <View className="flex-row items-start gap-2 pt-2">
              <View className="min-w-0 flex-1">
                <Text className="mt-2 text-base font-bold text-gray-900 dark:text-white">
                  {reference.name}
                </Text>
                <Text className="mt-0.5 text-base text-gray-900 dark:text-white">
                  {[reference.position, reference.company]
                    .filter(Boolean)
                    .join(", ")}
                </Text>
                <Text className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {[
                    reference.phones
                      .filter((value) => value.trim() !== "")
                      .join(" · "),
                    reference.email.trim(),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
              <EntryMenu
                onPress={() =>
                  onEntryMenu(
                    reference.name || "Reference",
                    () => onEditStep(8),
                    onDeleteReference,
                  )
                }
              />
            </View>
            <LinkRow
              label="Edit Reference"
              icon="edit"
              onPress={() => onEditStep(8)}
            />
          </>
        ) : (
          <>
            <Text className="mt-4 text-base text-gray-500 dark:text-gray-400">
              Increase your credibility with trustworthy reference.
            </Text>
            <LinkRow
              label="Add Reference"
              icon="add"
              onPress={() => onEditStep(8)}
            />
          </>
        )}
      </View>

      <Gap />

      {/* CV / Resume */}
      <View
        className={sectionClass}
        onLayout={(event) => {
          cvY.current = event.nativeEvent.layout.y;
        }}
      >
        <SectionHeader title="CV / Resume" noticed={cvNoticed} />
        <Text className="mt-4 text-base text-gray-900 dark:text-white">
          Uploading a new file will replace your current resume details.
          You&apos;ll get to review everything before it&apos;s saved.
        </Text>
        <Text className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Supported file types: doc, DOCX, PDF, txt. (Max size: 5MB)
        </Text>
        {draft.attachment ? (
          <View className="mt-4 flex-row items-center gap-3">
            <View
              className="h-10 w-10 items-center justify-center rounded-md"
              style={{ backgroundColor: "#EF4444" }}
            >
              <Ionicons name="document-text" size={22} color="white" />
            </View>
            <View className="min-w-0 flex-1">
              <Text
                className="text-base text-gray-900 dark:text-white"
                numberOfLines={1}
              >
                {draft.attachment.fileName}
              </Text>
              <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                {formatFileSize(draft.attachment.size)}
              </Text>
            </View>
            <EntryMenu onPress={onAttachmentActions} />
          </View>
        ) : null}
        <TouchableOpacity
          onPress={onUploadCv}
          disabled={cvUploading}
          activeOpacity={0.8}
          className={`mt-4 h-12 flex-row items-center justify-center gap-2 rounded-lg border ${
            cvUploading ? "opacity-60" : ""
          }`}
          style={{
            backgroundColor: "rgba(14,165,233,0.08)",
            borderColor: "rgba(14,165,233,0.35)",
          }}
          accessibilityRole="button"
          accessibilityLabel={draft.attachment ? "Replace CV" : "Upload CV"}
        >
          {cvUploading ? (
            <ActivityIndicator size="small" color={Colors.primary.DEFAULT} />
          ) : (
            <Ionicons name="attach" size={20} color={Colors.primary.DEFAULT} />
          )}
          <Text
            className="text-base font-semibold"
            style={{ color: Colors.primary.DEFAULT }}
          >
            {cvUploading
              ? "Uploading…"
              : draft.attachment
                ? "Replace file (CV)"
                : "Upload file (CV)"}
          </Text>
        </TouchableOpacity>
      </View>

      <Gap />

      {/* Job Preferences */}
      <View className={sectionClass}>
        <SectionHeader
          title="Job Preferences"
          action={jobPreference ? "edit" : "add"}
          onAction={onEditJobPreferences}
          label="Edit Job Preferences"
        />
        <SectionDivider />
        {jobRows.map((row) => (
          <View
            key={row.label}
            className="border-b border-gray-100 py-3.5 last:border-0 dark:border-[#2C2C2E]"
          >
            <Text className="text-sm text-gray-500 dark:text-gray-400">
              {row.label}
            </Text>
            <Text className="mt-1 text-base text-gray-900 dark:text-white">
              {row.value}
            </Text>
          </View>
        ))}
        <LinkRow
          label={jobPreference ? "Edit Job Preferences" : "Add Preference"}
          icon={jobPreference ? "edit" : "add"}
          onPress={onEditJobPreferences}
        />
      </View>
    </View>
  );
}
