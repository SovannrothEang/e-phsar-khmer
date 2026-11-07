import { Colors } from "@/constants/Colors";
import { ApiError } from "@/lib/api/client";
import { submitResumeFeedback } from "@/lib/api/resume";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const MOODS: { id: string; label: string; emoji: string }[] = [
  { id: "terrible", label: "Terrible", emoji: "😡" },
  { id: "bad", label: "Bad", emoji: "🙁" },
  { id: "okay", label: "Okay", emoji: "🙂" },
  { id: "good", label: "Good", emoji: "😄" },
  { id: "amazing", label: "Amazing", emoji: "😍" },
];

const SECTIONS: { id: string; label: string; icon: IoniconName }[] = [
  { id: "personal", label: "Personal Details", icon: "person-outline" },
  { id: "summary", label: "Summary", icon: "pencil-outline" },
  { id: "experience", label: "Experience", icon: "briefcase-outline" },
  { id: "educations", label: "Educations", icon: "school-outline" },
  { id: "skill", label: "Skill", icon: "star-outline" },
  { id: "languages", label: "Languages", icon: "globe-outline" },
  { id: "hobbies", label: "Hobbies & Interests", icon: "heart-outline" },
  { id: "references", label: "References", icon: "people-outline" },
];

interface ResumeFeedbackProps {
  name: string;
  phone: string;
  email: string;
  onDone: () => void;
}

/** The reference's post-resume feedback screen (reached from the ready card). */
export default function ResumeFeedback({
  name,
  phone,
  email,
  onDone,
}: ResumeFeedbackProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const chipIcon = isDark ? "#FFFFFF" : "#111827";

  const [mood, setMood] = useState<string | null>(null);
  const [sections, setSections] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [showMoodError, setShowMoodError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const toggleSection = (label: string) => {
    setSections((current) =>
      current.includes(label)
        ? current.filter((item) => item !== label)
        : [...current, label],
    );
  };

  const submit = async () => {
    const selectedMood = MOODS.find((item) => item.id === mood);
    if (!selectedMood) {
      setShowMoodError(true);
      return;
    }
    if (name.trim() === "" || phone.trim() === "") {
      Alert.alert(
        "Missing contact info",
        "Add your name and phone number in Personal Information first.",
      );
      return;
    }

    const parts = [`Feeling: ${selectedMood.label}`];
    if (sections.length > 0) {
      parts.push(`Would like to improve: ${sections.join(", ")}`);
    }
    if (note.trim() !== "") parts.push(note.trim());

    setSubmitting(true);
    try {
      await submitResumeFeedback({
        name,
        phone,
        email,
        description: parts.join("\n\n"),
      });
      Alert.alert(
        "Thank you",
        "Your feedback was sent.",
        [{ text: "OK", onPress: onDone }],
        { cancelable: false },
      );
    } catch (error) {
      Alert.alert(
        "Couldn't send feedback",
        error instanceof ApiError
          ? error.status === 429
            ? "Too many submissions — please try again later."
            : error.message
          : "Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white dark:bg-black"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text className="mt-2 text-center text-2xl font-bold text-gray-900 dark:text-white">
          How are you feeling?
        </Text>
        <Text className="mt-2 text-center text-base leading-6 text-gray-500 dark:text-gray-400">
          Your input is valuable in helping us better understand your needs and
          tailor our service accordingly.
        </Text>

        <View className="mt-6 flex-row items-start">
          {MOODS.map((item) => {
            const selected = mood === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => {
                  setMood(item.id);
                  setShowMoodError(false);
                }}
                activeOpacity={0.8}
                className="flex-1 items-center"
                accessibilityRole="button"
                accessibilityLabel={item.label}
                accessibilityState={{ selected }}
              >
                <View
                  className={`h-14 w-14 items-center justify-center rounded-full border-2 ${
                    selected
                      ? "border-primary bg-primary/10"
                      : "border-transparent bg-gray-100 dark:bg-[#2C2C2E]"
                  }`}
                >
                  <Text className="text-3xl">{item.emoji}</Text>
                </View>
                <Text
                  className={`mt-2 text-sm font-semibold ${
                    selected ? "text-primary" : "text-gray-900 dark:text-white"
                  }`}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {showMoodError ? (
          <Text className="mt-2 text-center text-sm text-red-500">
            Please choose how you are feeling.
          </Text>
        ) : null}

        <View className="mt-6 flex-row items-center gap-3">
          <View className="h-px flex-1 bg-gray-200 dark:bg-[#2C2C2E]" />
          <Ionicons name="heart" size={16} color="#8E8E93" />
          <View className="h-px flex-1 bg-gray-200 dark:bg-[#2C2C2E]" />
        </View>

        <View className="mt-6 flex-row items-center gap-2">
          <Ionicons name="pencil" size={18} color="#8E8E93" />
          <Text className="flex-1 text-lg font-bold text-gray-900 dark:text-white">
            Tell us what you would like us to improve.
          </Text>
        </View>

        <View className="mt-4 flex-row flex-wrap gap-2">
          {SECTIONS.map((section) => {
            const selected = sections.includes(section.label);
            return (
              <TouchableOpacity
                key={section.id}
                onPress={() => toggleSection(section.label)}
                activeOpacity={0.8}
                className={`flex-row items-center gap-2 rounded-full px-4 py-3 ${
                  selected ? "bg-primary" : "bg-gray-100 dark:bg-[#2C2C2E]"
                }`}
                accessibilityRole="button"
                accessibilityLabel={section.label}
                accessibilityState={{ selected }}
              >
                <Ionicons
                  name={section.icon}
                  size={16}
                  color={selected ? "#FFFFFF" : chipIcon}
                />
                <Text
                  className={`text-base font-semibold ${
                    selected ? "text-white" : "text-gray-900 dark:text-white"
                  }`}
                >
                  {section.label}
                </Text>
                <Ionicons
                  name={selected ? "checkmark" : "add"}
                  size={18}
                  color={selected ? "#FFFFFF" : chipIcon}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Share any additional feedback.."
          placeholderTextColor="#8E8E93"
          multiline
          maxLength={2000}
          textAlignVertical="top"
          className="mt-6 rounded-xl bg-[#F2F2F7] px-4 py-4 text-base text-gray-900 dark:bg-[#2C2C2E] dark:text-white"
          style={{ minHeight: 160 }}
          accessibilityLabel="Additional feedback"
        />
      </ScrollView>

      <View
        className="border-t border-gray-100 bg-white px-4 pt-3 dark:border-[#2C2C2E] dark:bg-[#171717]"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <TouchableOpacity
          onPress={submit}
          activeOpacity={0.85}
          disabled={submitting}
          className={`h-12 items-center justify-center rounded-lg ${
            submitting ? "opacity-60" : ""
          }`}
          style={{ backgroundColor: Colors.secondary.DEFAULT }}
          accessibilityRole="button"
          accessibilityLabel="Submit feedback"
        >
          {submitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-lg font-bold text-white">Submit</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
