import { AuthField } from "@/components/auth/AuthField";
import { AuthHeader } from "@/components/auth/AuthHeader";
import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/contexts/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, useRouter } from "expo-router";
import React, { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

/**
 * Signup step 2: the phone already received its code on the previous screen.
 * Name and password are collected here and carried to the OTP step, which is
 * where the account is actually created.
 */
const CreateAccountScreen = () => {
  const router = useRouter();
  const { pendingVerification, setRegistrationProfile } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");

  // Reachable only right after the phone step; otherwise start again.
  if (!pendingVerification) return <Redirect href="/(auth)/sign-up" />;

  const handleSubmit = () => {
    if (!firstName.trim()) {
      setError("Enter your first name.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    setError("");
    setRegistrationProfile({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      password,
    });
    router.push({
      pathname: "/(auth)/otp",
      params: { mode: "register" },
    } as never);
  };

  return (
    <SafeAreaView
      statusBarColor={Colors.primary.DEFAULT}
      statusBarStyle="light-content"
      className="bg-neutral-background dark:bg-gray-950 flex-1"
    >
      <AuthHeader title="Register" />

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingVertical: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center mb-6">
          <View
            className="items-center justify-center rounded-full"
            style={{
              width: 112,
              height: 112,
              borderRadius: 56,
              backgroundColor: Colors.neutral.border,
            }}
          >
            <Ionicons name="person" size={64} color="#9CA3AF" />
          </View>
        </View>

        <View className="gap-4">
          <AuthField
            label="First Name"
            value={firstName}
            onChangeText={(value) => {
              setFirstName(value);
              if (error) setError("");
            }}
            error={error}
            autoCapitalize="words"
            maxLength={100}
          />
          <AuthField
            label="Last Name"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            maxLength={100}
          />
          <AuthField
            label="Password"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              if (error) setError("");
            }}
            secure
            autoCapitalize="none"
            autoComplete="new-password"
          />
          <AuthField
            label="Confirm Password"
            value={confirmation}
            onChangeText={(value) => {
              setConfirmation(value);
              if (error) setError("");
            }}
            secure
            autoCapitalize="none"
            autoComplete="new-password"
          />

          <TouchableOpacity
            onPress={handleSubmit}
            activeOpacity={0.8}
            accessibilityRole="button"
            className="bg-secondary-orange h-[44px] rounded-[4px] items-center justify-center mt-[24px] shadow-xs"
          >
            <Text className="text-white font-bold text-base">Submit</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default CreateAccountScreen;
