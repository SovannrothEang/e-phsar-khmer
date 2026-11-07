import { Colors } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import React from "react";
import { Modal, Pressable, Text, TouchableOpacity, View } from "react-native";

interface ResumeReadyDialogProps {
  visible: boolean;
  onFinish: () => void;
  onFeedback: () => void;
}

/** The reference's completion card: green check, Finish, Feedback. */
export default function ResumeReadyDialog({
  visible,
  onFinish,
  onFeedback,
}: ResumeReadyDialogProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onFinish}
    >
      <View className="flex-1 items-center justify-center bg-black/60 px-6">
        <Pressable className="absolute inset-0" onPress={() => {}} />
        <View className="w-full max-w-sm rounded-3xl bg-white px-6 py-8 dark:bg-[#262628]">
          <View className="items-center">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-emerald-50 dark:bg-[#12351F]">
              <Ionicons
                name="checkmark"
                size={42}
                color={isDark ? "#4ADE80" : "#16A34A"}
              />
            </View>

            <Text className="mt-5 text-center text-2xl font-bold text-gray-900 dark:text-white">
              Your Resume Is Ready!
            </Text>
            <Text className="mt-2 text-center text-base text-gray-500 dark:text-gray-400">
              Your information has been saved.
            </Text>
          </View>

          <TouchableOpacity
            onPress={onFinish}
            activeOpacity={0.85}
            className="mt-6 h-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: Colors.primary.DEFAULT }}
            accessibilityRole="button"
            accessibilityLabel="Finish"
          >
            <Text className="text-base font-bold text-white">Finish</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onFeedback}
            activeOpacity={0.7}
            className="mt-4 flex-row items-center justify-center gap-2"
            accessibilityRole="button"
            accessibilityLabel="Feedback"
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={18}
              color={Colors.primary.DEFAULT}
            />
            <Text className="text-base font-semibold text-primary">
              Feedback
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
