import AccountHeader from "@/components/account/AccountHeader";
import DropdownField from "@/components/common/DropdownField";
import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/contexts/AuthContext";
import {
  addMyPhone,
  fetchMyPhones,
  fetchMyProfile,
  updateMyPhone,
  updateMyProfile,
  uploadMyPhoto,
  type ProfilePatch,
} from "@/lib/api/account";
import {
  fetchCommunes,
  fetchDistricts,
  fetchProvinces,
  type PlaceSummary,
} from "@/lib/api/catalog";
import { ApiError } from "@/lib/api/client";
import { normalizePhone } from "@/lib/phone";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useColorScheme } from "nativewind";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface PhoneRow {
  id?: string;
  phone: string;
  originalPhone?: string;
}

type Gender = "male" | "female" | null;

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1900 + 1 }, (_, index) => {
  const year = CURRENT_YEAR - index;
  return { id: String(year), name: String(year) };
});
const MAX_PHONES = 3;
const MAP_PLACEHOLDER = require("@/assets/images/map_placeholder.png");

function Field({
  label,
  ...inputProps
}: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View className="mb-3 rounded-lg bg-white px-4 py-3 dark:bg-gray-900">
      <Text className="text-xs text-gray-500 dark:text-gray-400">{label}</Text>
      <TextInput
        {...inputProps}
        placeholderTextColor="#9CA3AF"
        className="mt-1 p-0 text-base text-gray-900 dark:text-white"
      />
    </View>
  );
}

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["my-profile"],
    queryFn: fetchMyProfile,
  });
  const phonesQuery = useQuery({
    queryKey: ["my-phones"],
    queryFn: fetchMyPhones,
  });
  const provincesQuery = useQuery({
    queryKey: ["provinces"],
    queryFn: fetchProvinces,
    staleTime: 10 * 60_000,
  });

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState<Gender>(null);
  const [yearOfBirth, setYearOfBirth] = useState<number | null>(null);
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [updateAdsContact, setUpdateAdsContact] = useState(false);
  const [phoneRows, setPhoneRows] = useState<PhoneRow[]>([{ phone: "" }]);
  const [avatar, setAvatar] = useState(user.avatar || "");
  const [coverPhoto, setCoverPhoto] = useState(user.coverPhoto || "");
  const [uploadingPhoto, setUploadingPhoto] = useState<
    "avatar" | "cover" | null
  >(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const [province, setProvince] = useState<PlaceSummary | null>(null);
  const [district, setDistrict] = useState<PlaceSummary | null>(null);
  const [commune, setCommune] = useState<PlaceSummary | null>(null);

  const districtsQuery = useQuery({
    queryKey: ["districts", province?.slug],
    queryFn: () => fetchDistricts(province!.slug),
    enabled: !!province,
    staleTime: 10 * 60_000,
  });
  const communesQuery = useQuery({
    queryKey: ["communes", province?.slug, district?.slug],
    queryFn: () => fetchCommunes(province!.slug, district!.slug),
    enabled: !!province && !!district,
    staleTime: 10 * 60_000,
  });

  const hydrated = useRef(false);
  useEffect(() => {
    const profile = profileQuery.data;
    const phones = phonesQuery.data;
    if (!profile || !phones || hydrated.current) return;
    hydrated.current = true;

    const storedGender = (profile.gender ?? "").toLowerCase();
    setFirstName(profile.firstName ?? "");
    setLastName(profile.lastName ?? "");
    setGender(
      storedGender === "male" || storedGender === "female"
        ? storedGender
        : null,
    );
    setYearOfBirth(
      typeof profile.yearOfBirth === "number" ? profile.yearOfBirth : null,
    );
    setCompany(profile.company ?? "");
    setEmail(profile.email ?? "");
    setAddress(profile.address ?? "");
    setAvatar(profile.profilePhotoUrl ?? user.avatar ?? "");
    setCoverPhoto(profile.coverPhotoUrl ?? user.coverPhoto ?? "");
    setPhoneRows(
      phones.length
        ? phones.map((row) => ({
            id: row.id,
            phone: row.phone,
            originalPhone: row.phone,
          }))
        : [{ phone: profile.primaryPhone ?? "" }],
    );
  }, [profileQuery.data, phonesQuery.data, user.avatar, user.coverPhoto]);

  // Resolve the saved province/district/commune once each list arrives. This is
  // state that can be derived from the query data, so it is adjusted during
  // render (guarded by the current selection) instead of in an effect.
  const profileData = profileQuery.data;
  if (!province && profileData?.provinceId && provincesQuery.data) {
    const match = provincesQuery.data.find(
      (row) => row.id === profileData.provinceId,
    );
    if (match) setProvince(match);
  }
  if (!district && profileData?.districtId && districtsQuery.data) {
    const match = districtsQuery.data.find(
      (row) => row.id === profileData.districtId,
    );
    if (match) setDistrict(match);
  }
  if (!commune && profileData?.communeId && communesQuery.data) {
    const match = communesQuery.data.find(
      (row) => row.id === profileData.communeId,
    );
    if (match) setCommune(match);
  }

  const locationLabel =
    [province?.name, district?.name, commune?.name]
      .filter(Boolean)
      .join(", ") || "Select location";

  const pickAndUpload = async (kind: "avatar" | "cover") => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Photo permission",
        "Allow photo access to change this image.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: kind === "avatar" ? [1, 1] : [16, 9],
      quality: 0.8,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];
    const mime = asset.mimeType ?? "image/jpeg";
    if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) {
      Alert.alert("Unsupported photo", "Use a JPEG, PNG or WebP image.");
      return;
    }
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      Alert.alert("Photo too large", "Each photo must be 5 MB or smaller.");
      return;
    }

    setUploadingPhoto(kind);
    try {
      const updated = await uploadMyPhoto(kind, {
        uri: asset.uri,
        name: asset.fileName ?? `${kind}-${Date.now()}.${mime.split("/")[1]}`,
        type: mime,
      });
      if (kind === "avatar") {
        setAvatar(updated.profilePhotoUrl ?? avatar);
      } else {
        setCoverPhoto(updated.coverPhotoUrl ?? coverPhoto);
      }
      await refreshUser();
    } catch (error) {
      Alert.alert(
        "Upload failed",
        error instanceof ApiError ? error.message : "Please try again.",
      );
    } finally {
      setUploadingPhoto(null);
    }
  };

  const openMap = () => {
    const profile = profileQuery.data;
    const latitude = profile?.latitude;
    const longitude = profile?.longitude;
    const target =
      latitude != null &&
      longitude != null &&
      String(latitude).length > 0 &&
      String(longitude).length > 0
        ? `${latitude},${longitude}`
        : [province?.name, district?.name, commune?.name, address.trim()]
            .filter(Boolean)
            .join(", ");

    if (!target) {
      Alert.alert("Location", "Choose a location or enter an address first.");
      return;
    }
    void Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        target,
      )}`,
    );
  };

  const handleSubmit = async () => {
    if (!profileQuery.data) return;

    const cleanFirstName = firstName.trim();
    if (!cleanFirstName) {
      Alert.alert("Missing name", "Please enter your first name.");
      return;
    }

    const cleanEmail = email.trim();
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }

    const preparedPhones: { row: PhoneRow; normalized: string }[] = [];
    for (const row of phoneRows) {
      const raw = row.phone.trim();
      if (!raw) continue;
      const normalized = normalizePhone(raw);
      if (!normalized) {
        Alert.alert("Invalid phone", `Check the phone number "${raw}".`);
        return;
      }
      preparedPhones.push({ row, normalized });
    }

    if (updateAdsContact) {
      const missing: string[] = [];
      if (preparedPhones.length === 0) missing.push("a phone number");
      if (!province) missing.push("a location");
      if (!address.trim()) missing.push("an address");
      if (missing.length > 0) {
        Alert.alert(
          "Contact details needed",
          `Add ${missing.join(", ")} before updating your ads' contact.`,
        );
        return;
      }
    }

    setIsSaving(true);
    try {
      for (const { row, normalized } of preparedPhones) {
        if (row.id) {
          if (normalized !== row.originalPhone) {
            await updateMyPhone(row.id, normalized);
          }
        } else {
          await addMyPhone(normalized);
        }
      }

      const patch: ProfilePatch = {
        firstName: cleanFirstName,
        lastName: lastName.trim(),
        gender,
        yearOfBirth,
        company: company.trim() || null,
        email: cleanEmail || null,
        address: address.trim() || null,
        provinceId: province?.id ?? null,
        districtId: district?.id ?? null,
        communeId: commune?.id ?? null,
        updateAdsContact,
      };
      await updateMyProfile(patch);
      await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      await queryClient.invalidateQueries({ queryKey: ["my-phones"] });
      await refreshUser();
      router.back();
    } catch (error) {
      Alert.alert(
        "Could not save",
        error instanceof ApiError
          ? error.message
          : "Please check your connection and try again.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const isLoading = profileQuery.isLoading || phonesQuery.isLoading;
  const hasError = profileQuery.isError || phonesQuery.isError;

  return (
    <SafeAreaView
      statusBarColor={Colors.primary.DEFAULT}
      statusBarStyle="light-content"
      className="flex-1 bg-neutral-background dark:bg-black"
    >
      <AccountHeader title="Edit Profile" variant="blue" showHeadset={false} />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Cover */}
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => pickAndUpload("cover")}
            className="h-44 items-center justify-center bg-primary"
            accessibilityRole="button"
            accessibilityLabel={
              coverPhoto ? "Change cover photo" : "Add cover photo"
            }
          >
            {coverPhoto ? (
              <>
                <Image
                  source={{ uri: coverPhoto }}
                  className="absolute h-full w-full"
                  resizeMode="cover"
                />
                <View className="absolute h-full w-full bg-black/30" />
                <View className="flex-row items-center gap-2 rounded-full bg-black/40 px-4 py-2">
                  <Ionicons name="camera-outline" size={18} color="white" />
                  <Text className="text-sm font-semibold text-white">
                    Change cover photo
                  </Text>
                </View>
              </>
            ) : (
              <View className="flex-row items-center gap-2">
                <Ionicons name="camera-outline" size={20} color="white" />
                <Text className="text-base font-semibold text-white">
                  Add cover photo
                </Text>
              </View>
            )}
            {uploadingPhoto === "cover" ? (
              <ActivityIndicator className="absolute" color="white" />
            ) : null}
          </TouchableOpacity>

          {/* Avatar overlapping the cover boundary */}
          <View className="items-center" style={{ marginTop: -56 }}>
            <View className="relative">
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => pickAndUpload("avatar")}
                className="h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-white dark:border-gray-900 dark:bg-gray-900"
                accessibilityRole="button"
                accessibilityLabel="Change profile photo"
              >
                {avatar ? (
                  <Image
                    source={{ uri: avatar }}
                    className="h-full w-full"
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons name="person" size={64} color="#9CA3AF" />
                )}
                {uploadingPhoto === "avatar" ? (
                  <ActivityIndicator
                    className="absolute"
                    color={Colors.primary.DEFAULT}
                  />
                ) : null}
              </TouchableOpacity>
              <View className="absolute -bottom-1 -right-1 h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-gray-100 dark:border-gray-900 dark:bg-gray-800">
                <Ionicons name="camera" size={16} color="#6B7280" />
              </View>
            </View>
          </View>

          <View className="px-4 pt-4">
            {hasError ? (
              <View className="items-center py-10">
                <Text className="text-center text-sm text-gray-500 dark:text-gray-400">
                  Could not load your profile. Go back and try again.
                </Text>
              </View>
            ) : isLoading ? (
              <View className="items-center py-10">
                <ActivityIndicator color={Colors.primary.DEFAULT} />
              </View>
            ) : (
              <>
                <Field
                  label="First Name"
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First name"
                />
                <Field
                  label="Last Name"
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last name"
                />

                <Text className="mb-2 mt-2 text-base font-bold text-neutral-text-main dark:text-white">
                  Gender
                </Text>
                <View className="mb-3 flex-row gap-3">
                  {(["male", "female"] as const).map((value) => {
                    const selected = gender === value;
                    return (
                      <TouchableOpacity
                        key={value}
                        onPress={() => setGender(value)}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        className={`h-12 flex-1 items-center justify-center rounded-lg border ${
                          selected
                            ? "border-primary bg-sky-50 dark:bg-sky-950/40"
                            : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                        }`}
                      >
                        <Text
                          className={`text-base font-medium ${
                            selected
                              ? "text-primary"
                              : "text-gray-900 dark:text-gray-100"
                          }`}
                        >
                          {value === "male" ? "Male" : "Female"}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View className="mb-3">
                  <DropdownField
                    label="Year of birth"
                    value={yearOfBirth ? String(yearOfBirth) : ""}
                    placeholder="Select year"
                    options={YEARS}
                    onSelect={(option) => setYearOfBirth(Number(option.id))}
                    searchable
                  />
                </View>

                <Field
                  label="Company"
                  value={company}
                  onChangeText={setCompany}
                  placeholder="Company"
                />
                <Field
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                {phoneRows.map((row, index) => (
                  <View
                    key={row.id ?? `new-${index}`}
                    className="mb-3 flex-row items-center"
                  >
                    <View className="flex-1 rounded-lg bg-white px-4 py-3 dark:bg-gray-900">
                      <Text className="text-xs text-gray-500 dark:text-gray-400">
                        Phone Number {index + 1}
                      </Text>
                      <TextInput
                        value={row.phone}
                        onChangeText={(value) =>
                          setPhoneRows((rows) =>
                            rows.map((entry, rowIndex) =>
                              rowIndex === index
                                ? { ...entry, phone: value }
                                : entry,
                            ),
                          )
                        }
                        placeholder="0xx xxx xxx"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="phone-pad"
                        className="mt-1 p-0 text-base text-gray-900 dark:text-white"
                      />
                    </View>
                    {index === phoneRows.length - 1 &&
                    phoneRows.length < MAX_PHONES ? (
                      <TouchableOpacity
                        onPress={() =>
                          setPhoneRows((rows) => [...rows, { phone: "" }])
                        }
                        className="ml-2 h-10 w-10 items-center justify-center rounded-full bg-primary"
                        accessibilityRole="button"
                        accessibilityLabel="Add phone number"
                      >
                        <Ionicons name="add" size={22} color="white" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}

                <TouchableOpacity
                  onPress={() => setShowLocationPicker(true)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  className="mb-3 flex-row items-center rounded-lg bg-white px-4 py-3 dark:bg-gray-900"
                >
                  <View className="flex-1">
                    <Text className="text-xs text-gray-500 dark:text-gray-400">
                      Location
                    </Text>
                    <Text
                      className="mt-1 text-base text-gray-900 dark:text-white"
                      numberOfLines={1}
                    >
                      {locationLabel}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </TouchableOpacity>

                <Field
                  label="Address"
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Address"
                />

                {/* Static map preview; opens Google Maps at the saved pin or address */}
                <TouchableOpacity
                  onPress={openMap}
                  activeOpacity={0.9}
                  accessibilityRole="button"
                  accessibilityLabel="Set location on Google Maps"
                  className="mt-1 h-40 overflow-hidden rounded-lg"
                >
                  <Image
                    source={MAP_PLACEHOLDER}
                    className="absolute h-full w-full"
                    resizeMode="cover"
                  />
                  <View className="flex-1 items-center justify-center">
                    <View className="flex-row items-center gap-2 rounded-lg bg-white px-4 py-2.5 shadow-sm">
                      <Ionicons
                        name="location-sharp"
                        size={18}
                        color="#EA4335"
                      />
                      <Text className="text-sm font-semibold text-gray-900">
                        Set location on Google Maps
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setUpdateAdsContact((value) => !value)}
                  activeOpacity={0.8}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: updateAdsContact }}
                  className="mt-5 flex-row items-center"
                >
                  <Ionicons
                    name={updateAdsContact ? "checkbox" : "square-outline"}
                    size={24}
                    color={
                      updateAdsContact ? Colors.primary.DEFAULT : "#9CA3AF"
                    }
                  />
                  <Text className="ml-2 text-sm text-neutral-text-main dark:text-gray-200">
                    Update this contact to your Ads
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={isSaving}
                  activeOpacity={0.9}
                  accessibilityRole="button"
                  className="mt-6 h-12 items-center justify-center rounded-md bg-secondary-orange"
                >
                  {isSaving ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-base font-bold text-white">
                      Submit
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Province / district / commune picker */}
      <Modal
        visible={showLocationPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLocationPicker(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="rounded-t-3xl bg-white px-4 pb-8 pt-4 dark:bg-gray-900">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-gray-900 dark:text-white">
                Location
              </Text>
              <TouchableOpacity
                onPress={() => setShowLocationPicker(false)}
                accessibilityRole="button"
                accessibilityLabel="Close location picker"
              >
                <Ionicons
                  name="close"
                  size={22}
                  color={isDark ? "#E5E7EB" : "#374151"}
                />
              </TouchableOpacity>
            </View>

            <DropdownField
              label="Province"
              value={province?.slug ?? ""}
              placeholder="Select province"
              options={(provincesQuery.data ?? []).map((row) => ({
                id: row.slug,
                name: row.name,
              }))}
              onSelect={(option) => {
                const match =
                  provincesQuery.data?.find((row) => row.slug === option.id) ??
                  null;
                setProvince(match);
                setDistrict(null);
                setCommune(null);
              }}
              searchable
            />
            <View className="h-3" />
            <DropdownField
              label="District"
              value={district?.slug ?? ""}
              placeholder="Select district"
              options={(districtsQuery.data ?? []).map((row) => ({
                id: row.slug,
                name: row.name,
              }))}
              onSelect={(option) => {
                const match =
                  districtsQuery.data?.find((row) => row.slug === option.id) ??
                  null;
                setDistrict(match);
                setCommune(null);
              }}
              disabled={!province}
              searchable
            />
            <View className="h-3" />
            <DropdownField
              label="Commune"
              value={commune?.slug ?? ""}
              placeholder="Select commune"
              options={(communesQuery.data ?? []).map((row) => ({
                id: row.slug,
                name: row.name,
              }))}
              onSelect={(option) => {
                const match =
                  communesQuery.data?.find((row) => row.slug === option.id) ??
                  null;
                setCommune(match);
              }}
              disabled={!district}
              searchable
            />

            <TouchableOpacity
              onPress={() => setShowLocationPicker(false)}
              activeOpacity={0.9}
              className="mt-5 h-12 items-center justify-center rounded-md bg-primary"
            >
              <Text className="text-base font-bold text-white">Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
