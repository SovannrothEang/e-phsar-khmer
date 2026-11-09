import AccountHeader from "@/components/account/AccountHeader";
import BottomSheet from "@/components/common/BottomSheet";
import DropdownField, {
  type DropdownOption,
} from "@/components/common/DropdownField";
import FloatingInput, { FieldError } from "@/components/common/FloatingInput";
import SafeAreaView from "@/components/common/SafeAreaView";
import SelectionSheet, {
  type SheetOption,
} from "@/components/common/SelectionSheet";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { fetchMyPhones, fetchMyProfile, type MyPhone } from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";
import {
  fetchAttributeSet,
  fetchBrands,
  fetchCommunes,
  fetchDistricts,
  fetchLinkedAttributes,
  fetchModels,
  fetchProvinces,
  fetchSubcategory,
  type AttributeSummary,
  type FieldDef,
  type PlaceSummary,
} from "@/lib/api/catalog";
import {
  createListing,
  deleteListing,
  fetchEntitlements,
  fetchProducts,
  publishListing,
  signListingUpload,
  type CreateListingPayload,
} from "@/lib/api/listing-form";
import { fetchCategories } from "@/lib/api/listings";
import {
  FAMILY_BY_SUBCATEGORY,
  NON_ATTRIBUTE_KEYS,
  SET_FOR_KEY,
  fieldLabel,
  isFieldRequired,
  makeIdempotencyKey,
} from "@/lib/sell";
import { SITE_URL } from "@/lib/site";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface PhotoEntry {
  url: string;
  path: string;
  sort: number;
  localUri?: string;
}

const CONDITION_OPTIONS: DropdownOption[] = [
  { id: "used", name: "Used" },
  { id: "new", name: "New" },
];

const VEHICLE_KEYS = new Set(["brand", "model", "year", "color"]);

const MAP_PLACEHOLDER = require("@/assets/images/map_placeholder.png");
const MAX_PHONE_ROWS = 3;
const DETAIL_SKIP_KEYS = new Set([
  "photos",
  "title",
  "location",
  "address",
  "deliveryFree",
  "contactName",
  "contactPhones",
  "contactEmail",
]);

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Something went wrong. Please try again.";
}

function SectionBand() {
  return <View className="h-2 bg-neutral-border" />;
}

const NewAdScreen = () => {
  const { isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    category?: string | string[];
    subcategory?: string | string[];
  }>();
  const categorySlug =
    (Array.isArray(params.category) ? params.category[0] : params.category) ??
    "";
  const subcategorySlug =
    (Array.isArray(params.subcategory)
      ? params.subcategory[0]
      : params.subcategory) ?? "";

  const [values, setValues] = useState<Record<string, string>>({});
  // Start unselected: a tile lights up only after the user taps it, never on
  // load (captain, 2026-11-03). The web form's condition state starts empty
  // for the same reason, and submit validation already treats "" as missing.
  const [condition, setCondition] = useState<"" | "new" | "used">("");
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Submit flags are inline (captain, 2026-11-04): no required asterisks; the
  // empty field gets a red border and "Please enter the “X”." underneath.
  const [errors, setErrors] = useState<Record<string, string>>({});
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const [province, setProvince] = useState<PlaceSummary | null>(null);
  const [district, setDistrict] = useState<PlaceSummary | null>(null);
  const [commune, setCommune] = useState<PlaceSummary | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  // Optional pin, separate from the mandatory province/district/commune picker.
  const [locationPin, setLocationPin] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [pinPending, setPinPending] = useState(false);
  const {
    request: requestLocationPermission,
    openSettings: openLocationSettings,
  } = useCurrentLocation();

  const [contactPhones, setContactPhones] = useState<string[]>([""]);
  const [productModelId, setProductModelId] = useState("");
  // Brand → Model → Year → Color run as one wizard. The step index survives a
  // close so the panel keeps its content through the close animation.
  const [vehicleSheetOpen, setVehicleSheetOpen] = useState(false);
  const [vehicleStepIndex, setVehicleStepIndex] = useState(0);

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime: 5 * 60_000,
  });
  const categories = categoriesQuery.data ?? [];
  const selectedCategory = categories.find(
    (category) => category.slug === categorySlug,
  );
  const selectedSubcategory = selectedCategory?.subcategories?.find(
    (entry) => entry.slug === subcategorySlug,
  );

  const subQuery = useQuery({
    queryKey: ["subcategory", categorySlug, subcategorySlug],
    queryFn: () => fetchSubcategory(categorySlug, subcategorySlug),
    enabled: !!categorySlug && !!subcategorySlug,
  });
  const subcategory = subQuery.data;
  const schema = useMemo(
    () => subcategory?.fieldSchema ?? [],
    [subcategory?.fieldSchema],
  );
  const schemaKeys = useMemo(
    () => new Set(schema.map((field) => field.key)),
    [schema],
  );
  const declares = (key: string) => schemaKeys.has(key);

  const brandsQuery = useQuery({
    queryKey: ["brands", subcategorySlug],
    queryFn: () => fetchBrands(subcategorySlug),
    enabled: !!subcategorySlug && declares("brand"),
  });
  const brands = brandsQuery.data ?? [];

  const selectedBrand = brands.find((brand) => brand.name === values.brand);
  const modelsQuery = useQuery({
    queryKey: ["models", selectedBrand?.id, subcategorySlug],
    queryFn: () => fetchModels(selectedBrand!.id, subcategorySlug),
    enabled: !!selectedBrand && declares("model"),
  });
  const models = modelsQuery.data ?? [];

  const yearsQuery = useQuery({
    queryKey: ["attributes", "years"],
    queryFn: () => fetchAttributeSet("years"),
    enabled: declares("year"),
    staleTime: 10 * 60_000,
  });

  const linkedQuery = useQuery({
    queryKey: ["linked-attributes", subcategory?.id],
    queryFn: () => fetchLinkedAttributes(subcategory!.id),
    enabled: !!subcategory?.id,
  });

  const family = FAMILY_BY_SUBCATEGORY[subcategorySlug];
  const productsQuery = useQuery({
    queryKey: ["products", family],
    queryFn: () => fetchProducts(family),
    enabled: !!family && declares("productSpec"),
  });
  const products = productsQuery.data ?? [];

  const entitlementsQuery = useQuery({
    queryKey: ["entitlements", subcategory?.id],
    queryFn: () => fetchEntitlements(subcategory!.id),
    enabled: !!subcategory?.id,
  });
  const entitlements = entitlementsQuery.data ?? null;

  const provincesQuery = useQuery({
    queryKey: ["provinces"],
    queryFn: fetchProvinces,
    enabled: declares("location"),
  });
  const provinces = useMemo(
    () => provincesQuery.data ?? [],
    [provincesQuery.data],
  );

  const districtsQuery = useQuery({
    queryKey: ["districts", province?.slug],
    queryFn: () => fetchDistricts(province!.slug),
    enabled: !!province?.slug,
  });
  const districts = useMemo(
    () => districtsQuery.data ?? [],
    [districtsQuery.data],
  );

  const communesQuery = useQuery({
    queryKey: ["communes", province?.slug, district?.slug],
    queryFn: () => fetchCommunes(province!.slug, district!.slug),
    enabled: !!province?.slug && !!district?.slug,
  });
  const communes = useMemo(
    () => communesQuery.data ?? [],
    [communesQuery.data],
  );

  const profileQuery = useQuery({
    queryKey: ["my-profile"],
    queryFn: fetchMyProfile,
  });
  const phonesQuery = useQuery({
    queryKey: ["my-phones"],
    queryFn: fetchMyPhones,
  });

  const linkedGroups = useMemo(() => {
    const groups: Record<string, AttributeSummary[]> = {};
    for (const row of linkedQuery.data ?? []) {
      (groups[row.type] ??= []).push(row);
    }
    return groups;
  }, [linkedQuery.data]);

  const clearError = (key: string) => {
    setErrors((current) => {
      const keys = VEHICLE_KEYS.has(key) ? [key, "vehicle"] : [key];
      if (!keys.some((entry) => entry in current)) return current;
      const next = { ...current };
      for (const entry of keys) delete next[entry];
      return next;
    });
  };

  const setValue = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (value.trim()) clearError(key);
  };

  const optionsFor = (field: FieldDef): DropdownOption[] => {
    // Managed attribute sets come first: they are what the web form uses and
    // they carry the option images (body types, colours, …). The schema's
    // static option list is only the fallback for sets with no rows.
    const set = SET_FOR_KEY[field.key];
    const rows = set ? linkedGroups[set] : undefined;
    if (rows?.length) {
      return rows.map((row) => ({
        id: row.name,
        name: row.name,
        image: row.image,
      }));
    }
    if (field.options?.length) {
      return field.options.map((option) => ({ id: option, name: option }));
    }
    return [];
  };

  // Prefill the ad contact (and address) from the user's profile once.
  const prefilled = useRef(false);
  useEffect(() => {
    const profile = profileQuery.data;
    const phones = phonesQuery.data;
    if (!profile || !phones || prefilled.current) return;
    prefilled.current = true;

    const name =
      [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
      profile.username ||
      "";
    setValues((current) => ({
      ...current,
      contactName: current.contactName || name,
      contactEmail: current.contactEmail || profile.email || "",
      address: current.address || profile.address || "",
    }));

    const list: string[] = phones.length
      ? phones.map((row: MyPhone) => row.phone)
      : profile.primaryPhone
        ? [profile.primaryPhone]
        : [];
    setContactPhones((current) =>
      list.length > 0 ? list.slice(0, MAX_PHONE_ROWS) : current,
    );
  }, [profileQuery.data, phonesQuery.data]);

  // Resolve the profile's saved province/district/commune into the picker once
  // each list arrives (derived during render rather than synced by an effect).
  const profileData = profileQuery.data;
  if (!province && profileData?.provinceId && provinces.length > 0) {
    const match = provinces.find((row) => row.id === profileData.provinceId);
    if (match) setProvince(match);
  }
  if (!district && profileData?.districtId && districts.length > 0) {
    const match = districts.find((row) => row.id === profileData.districtId);
    if (match) setDistrict(match);
  }
  if (!commune && profileData?.communeId && communes.length > 0) {
    const match = communes.find((row) => row.id === profileData.communeId);
    if (match) setCommune(match);
  }

  const photosField = schema.find((field) => field.key === "photos");
  const schemaPhotoMax = photosField?.max ?? 8;
  const photoCap = Math.min(
    schemaPhotoMax,
    entitlements?.limits.photos ?? schemaPhotoMax,
  );

  const pickPhotos = async () => {
    const remaining = photoCap - photos.length;
    if (remaining <= 0) {
      Alert.alert("Limit reached", `This category allows ${photoCap} photos.`);
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Photo permission",
        "Allow photo access to upload images for your ad.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
      // iOS: hand back JPEG rather than HEIC — the storage bucket rejects
      // HEIC and this avoids a separate re-encoder dependency.
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (result.canceled || result.assets.length === 0) return;

    setUploading(true);
    try {
      for (const asset of result.assets.slice(0, remaining)) {
        const mime = asset.mimeType ?? "image/jpeg";
        if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) {
          Alert.alert(
            "Unsupported photo",
            "Use a JPEG, PNG or WebP image — the storage bucket rejects other formats.",
          );
          continue;
        }
        if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
          Alert.alert("Photo too large", "Each photo must be 5 MB or smaller.");
          continue;
        }

        const filename =
          asset.fileName ?? `photo-${Date.now()}.${mime.split("/")[1]}`;
        const signed = await signListingUpload(filename);
        const fileResponse = await fetch(asset.uri);
        const blob = await fileResponse.blob();
        const put = await fetch(signed.signedUrl, {
          method: "PUT",
          headers: { "Content-Type": mime },
          body: blob,
        });
        if (!put.ok) throw new Error("The photo upload was refused.");

        setPhotos((current) => [
          ...current,
          {
            url: signed.publicUrl,
            path: signed.path,
            sort: current.length,
            localUri: asset.uri,
          },
        ]);
      }
    } catch (error) {
      Alert.alert("Upload failed", errorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      router.push("/(auth)/sign-in");
      return;
    }
    if (!subcategory || !selectedCategory) {
      Alert.alert("Required", "Choose a category and subcategory first.");
      return;
    }

    const missing: Record<string, string> = {};
    const message = (label: string) => `Please enter the “${label}”.`;
    for (const field of schema) {
      if (!isFieldRequired(field.key, subcategorySlug, schemaKeys)) continue;
      const label = fieldLabel(field.key, field.label?.en);

      if (field.key === "price") {
        const amount = Number(values.price ?? "");
        if (!values.price?.trim() || !Number.isFinite(amount) || amount <= 0) {
          missing[field.key] = message(label);
        }
      } else if (field.key === "location") {
        if (!province || !district || !commune) {
          missing[field.key] = message(label);
        }
      } else if (field.key === "contactPhones") {
        if (!contactPhones[0]?.trim()) {
          missing[field.key] = message("Phone Number");
        }
      } else if (field.key === "condition") {
        if (!condition) missing[field.key] = message(label);
      } else if (field.key === "contactName") {
        if (!values.contactName?.trim()) missing[field.key] = message(label);
      } else if (field.key === "photos") {
        /* photos are optional */
      } else if (!(values[field.key] ?? "").trim()) {
        missing[field.key] = message(label);
      }
    }

    // Brand / Model / Year / Color share one summary card, so they get one flag.
    if (["brand", "model", "year", "color"].some((key) => missing[key])) {
      missing.vehicle = message("Make, Model & Year");
      for (const key of ["brand", "model", "year", "color"]) {
        delete missing[key];
      }
    }

    if (Object.keys(missing).length > 0) {
      setErrors(missing);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setErrors({});

    if (declares("price") && Number(values.price) > 0) {
      const discount = Number(values.discount ?? "");
      if (
        values.discount?.trim() &&
        (!Number.isFinite(discount) || discount <= 0)
      ) {
        Alert.alert("Discount", "Enter a positive discount or leave it empty.");
        return;
      }
    }

    if (entitlements && entitlements.usage.ads >= entitlements.limits.ads) {
      Alert.alert(
        "Ad limit reached",
        `Your ${entitlements.bucket?.name ?? entitlements.plan} allows ${entitlements.limits.ads} active ads and you have ${entitlements.usage.ads}. Remove an ad or upgrade to post another.`,
      );
      return;
    }

    const attributes: Record<string, string> = {};
    for (const [key, value] of Object.entries(values)) {
      if (NON_ATTRIBUTE_KEYS.has(key)) continue;
      if (!value.trim()) continue;
      attributes[key] = value.trim();
    }

    const location = [province?.name, district?.name, commune?.name]
      .filter(Boolean)
      .join(", ");

    const payload: CreateListingPayload = {
      categoryId: selectedCategory.id,
      subcategoryId: subcategory.id,
      title: (values.title ?? "").trim(),
      ...((values.description ?? "").trim()
        ? { description: values.description.trim() }
        : {}),
      ...(declares("price") ? { price: Number(values.price) } : {}),
      ...(declares("discount") && Number(values.discount) > 0
        ? {
            discountValue: Number(values.discount),
            discountType:
              values.discountType === "amount" ? "amount" : "percent",
          }
        : {}),
      ...(declares("condition") && condition ? { condition } : {}),
      ...(photos.length > 0
        ? {
            photos: photos.map((photo, index) => ({
              url: photo.url,
              path: photo.path,
              sort: index,
            })),
          }
        : {}),
      attributes,
      ...(declares("location") && location ? { location } : {}),
      ...((values.address ?? "").trim()
        ? { address: values.address.trim() }
        : {}),
      ...(declares("location") && province ? { provinceId: province.id } : {}),
      ...(declares("location") && district ? { districtId: district.id } : {}),
      ...(declares("location") && commune ? { communeId: commune.id } : {}),
      ...(declares("location") && locationPin
        ? { latitude: locationPin.lat, longitude: locationPin.lng }
        : {}),
      ...(declares("deliveryFree")
        ? { deliveryFree: values.deliveryFree === "true" }
        : {}),
      ...((values.contactName ?? "").trim()
        ? { contactName: values.contactName.trim() }
        : {}),
      ...(contactPhones.some((phone) => phone.trim())
        ? {
            contactPhones: contactPhones
              .map((phone) => phone.trim())
              .filter(Boolean),
          }
        : {}),
      ...((values.contactEmail ?? "").trim()
        ? { contactEmail: values.contactEmail.trim() }
        : {}),
      ...(productModelId ? { productModelId } : {}),
    };

    setSubmitting(true);
    const idempotencyKey = makeIdempotencyKey();
    try {
      const created = await createListing(payload, idempotencyKey);
      try {
        await publishListing(created.id);
      } catch (error) {
        await deleteListing(created.id).catch(() => undefined);
        Alert.alert("Could not publish", errorMessage(error));
        return;
      }
      Alert.alert("Ad published", "Your ad is now live on PhsarKhmer.", [
        {
          text: "View ad",
          onPress: () => router.replace(`/product/${created.id}` as never),
        },
      ]);
    } catch (error) {
      Alert.alert("Could not post the ad", errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const locationLabel =
    [province?.name, district?.name, commune?.name]
      .filter(Boolean)
      .join(", ") || "Select location";
  const hasLocation = Boolean(province || district || commune);

  const handleUseMyLocation = async () => {
    if (locationPin || pinPending) return;
    setPinPending(true);
    const result = await requestLocationPermission();
    setPinPending(false);
    if (result.permission === "granted" && result.fix) {
      setLocationPin(result.fix);
      return;
    }
    if (result.permission === "blocked") {
      Alert.alert(
        "Location",
        "Location is blocked. Enable it in Settings to pin your ad.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Open Settings", onPress: openLocationSettings },
        ],
      );
    } else {
      Alert.alert(
        "Location",
        result.permission === "denied"
          ? "Location permission was denied. You can still post without a pin."
          : "Could not get your location. You can still post without a pin.",
      );
    }
  };

  const openMap = () => {
    const target = locationPin
      ? `${locationPin.lat},${locationPin.lng}`
      : locationLabel !== "Select location"
        ? [locationLabel, values.address?.trim()].filter(Boolean).join(", ")
        : values.address?.trim() || "";
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

  const renderPhotos = () => (
    <View className="bg-white px-4 pb-4 pt-3">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-lg font-bold text-gray-900">Photos</Text>
        <Text className="text-sm font-semibold text-gray-500">
          {photos.length}/{photoCap}
        </Text>
      </View>

      {photos.length === 0 ? (
        <TouchableOpacity
          onPress={() => void pickPhotos()}
          disabled={uploading}
          activeOpacity={0.85}
          className="h-44 items-center justify-center rounded-lg border border-gray-200 bg-white"
        >
          {uploading ? (
            <ActivityIndicator color={Colors.primary.DEFAULT} />
          ) : (
            <View className="flex-row items-center gap-3">
              <Ionicons name="images-outline" size={30} color="#9CA3AF" />
              <Text className="text-base font-medium text-gray-600">
                Upload Photo
              </Text>
            </View>
          )}
        </TouchableOpacity>
      ) : (
        <View className="flex-row flex-wrap gap-2">
          {photos.map((photo, index) => (
            <View key={`${photo.path}-${index}`} className="relative">
              <Image
                source={{ uri: photo.localUri ?? photo.url }}
                className="h-24 w-24 rounded-lg bg-neutral-background"
                resizeMode="cover"
              />
              <TouchableOpacity
                onPress={() =>
                  setPhotos((current) =>
                    current
                      .filter((_, itemIndex) => itemIndex !== index)
                      .map((item, itemIndex) => ({
                        ...item,
                        sort: itemIndex,
                      })),
                  )
                }
                className="absolute -right-1.5 -top-1.5 h-6 w-6 items-center justify-center rounded-full bg-black/70"
              >
                <Ionicons name="close" size={14} color="white" />
              </TouchableOpacity>
            </View>
          ))}
          {photos.length < photoCap ? (
            <TouchableOpacity
              onPress={() => void pickPhotos()}
              disabled={uploading}
              className="h-24 w-24 items-center justify-center rounded-lg border border-dashed border-gray-300"
            >
              {uploading ? (
                <ActivityIndicator color={Colors.primary.DEFAULT} />
              ) : (
                <Ionicons name="add" size={28} color="#9CA3AF" />
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </View>
  );

  const renderTextInput = (
    field: FieldDef,
    multiline = false,
    numeric = false,
  ) => {
    const label = fieldLabel(field.key, field.label?.en);
    return (
      <View key={field.key} className="mb-3">
        <FloatingInput
          label={label}
          value={values[field.key] ?? ""}
          onChangeText={(text) => setValue(field.key, text)}
          multiline={multiline}
          keyboardType={numeric ? "numeric" : "default"}
          error={errors[field.key]}
        />
      </View>
    );
  };

  const renderSelect = (field: FieldDef) => {
    const label = fieldLabel(field.key, field.label?.en);
    const options = optionsFor(field);

    if (options.length === 0) {
      return renderTextInput(field);
    }

    if (options.length === 2) {
      return (
        <View key={field.key} className="mb-3">
          <Text className="mb-2 text-base font-bold text-gray-900">
            {label}
          </Text>
          <View className="flex-row gap-3">
            {options.map((option) => {
              const selected = values[field.key] === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  onPress={() => setValue(field.key, option.id)}
                  activeOpacity={0.85}
                  className={`h-12 flex-1 items-center justify-center rounded-lg border ${
                    selected
                      ? "border-primary bg-sky-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <Text
                    className={`text-base font-medium ${
                      selected ? "text-primary" : "text-gray-900"
                    }`}
                  >
                    {option.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {errors[field.key] ? (
            <FieldError message={errors[field.key]} />
          ) : null}
        </View>
      );
    }

    return (
      <View key={field.key} className="mb-3">
        <DropdownField
          label={label}
          value={values[field.key]}
          options={options}
          onSelect={(option) => setValue(field.key, option.id)}
          onClear={() => setValue(field.key, "")}
          error={errors[field.key]}
        />
      </View>
    );
  };

  const renderCondition = () => (
    <View key="condition" className="mb-3">
      <Text className="mb-2 text-base font-bold text-gray-900">Condition</Text>
      <View className="flex-row gap-3">
        {CONDITION_OPTIONS.map((option) => {
          const selected = condition === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              onPress={() => {
                setCondition(option.id as "new" | "used");
                clearError("condition");
              }}
              activeOpacity={0.85}
              className={`h-12 flex-1 items-center justify-center rounded-lg border ${
                selected
                  ? "border-primary bg-sky-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <Text
                className={`text-base font-medium ${
                  selected ? "text-primary" : "text-gray-900"
                }`}
              >
                {option.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {errors.condition ? <FieldError message={errors.condition} /> : null}
    </View>
  );

  const renderPrice = (field: FieldDef) => (
    <View key={field.key} className="mb-3">
      <FloatingInput
        label="Price"
        value={values.price ?? ""}
        onChangeText={(text) => setValue("price", text)}
        keyboardType="numeric"
        error={errors.price}
      />

      {declares("discount") && (
        <View className="mt-3 flex-row items-center gap-2">
          <View className="flex-1">
            <FloatingInput
              label="Discount"
              value={values.discount ?? ""}
              onChangeText={(text) => setValue("discount", text)}
              keyboardType="numeric"
            />
          </View>
          <View className="flex-row rounded-lg border border-gray-200 bg-white p-1">
            {(["percent", "amount"] as const).map((type) => {
              const selected = (values.discountType ?? "percent") === type;
              return (
                <TouchableOpacity
                  key={type}
                  onPress={() => setValue("discountType", type)}
                  className={`h-10 w-11 items-center justify-center rounded-md ${
                    selected ? "bg-gray-100" : ""
                  }`}
                >
                  <Text
                    className={`text-base font-semibold ${
                      selected ? "text-gray-900" : "text-gray-400"
                    }`}
                  >
                    {type === "percent" ? "%" : "$"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );

  const renderProductSpec = () => (
    <View key="productSpec" className="mb-3">
      <DropdownField
        label="Product Specification"
        value={
          products.find((product) => product.modelId === productModelId)
            ?.modelId
        }
        options={products.map((product) => ({
          id: product.modelId,
          name: `${product.brandName} ${product.modelName}`,
          image: product.image,
        }))}
        onSelect={(option) => {
          setProductModelId(option.id);
          clearError("productSpec");
        }}
        onClear={() => setProductModelId("")}
        error={errors.productSpec}
        chevron="forward"
      />
    </View>
  );

  const vehicleKeys = ["brand", "model", "year", "color"].filter((key) =>
    declares(key),
  );

  const vehicleStep = vehicleKeys[vehicleStepIndex] ?? vehicleKeys[0] ?? null;

  const vehicleStepOptions = (): SheetOption[] => {
    if (vehicleStep === "brand") {
      return brands.map((brand) => ({
        id: brand.name,
        name: brand.name,
        image: brand.icon,
      }));
    }
    if (vehicleStep === "model") {
      return models.map((model) => ({ id: model.name, name: model.name }));
    }
    if (vehicleStep === "year") {
      return (yearsQuery.data ?? []).map((year) => ({
        id: year.name,
        name: year.name,
      }));
    }
    if (vehicleStep === "color") {
      const colorField = schema.find((field) => field.key === "color");
      return colorField ? optionsFor(colorField) : [];
    }
    return [];
  };

  const vehicleStepLoading =
    (vehicleStep === "brand" && brandsQuery.isLoading) ||
    (vehicleStep === "model" && modelsQuery.isLoading) ||
    (vehicleStep === "year" && yearsQuery.isLoading);

  const handleVehicleSelect = (option: SheetOption) => {
    if (!vehicleStep) return;
    setValue(vehicleStep, option.id);
    if (vehicleStep === "brand") setValue("model", "");
    const next = vehicleStepIndex + 1;
    if (next < vehicleKeys.length) {
      setVehicleStepIndex(next);
    } else {
      setVehicleSheetOpen(false);
    }
  };

  const handleVehicleClear = () => {
    if (!vehicleStep) return;
    setValue(vehicleStep, "");
    if (vehicleStep === "brand") setValue("model", "");
  };

  const renderVehicleSummary = () => {
    if (!declares("brand")) return null;
    const lines = vehicleKeys
      .map((key) => {
        const value = values[key];
        if (!value) return null;
        const field = schema.find((entry) => entry.key === key);
        return `- ${fieldLabel(key, field?.label?.en)}: ${value}`;
      })
      .filter(Boolean) as string[];
    return (
      <View key="vehicle-summary" className="mb-3">
        <TouchableOpacity
          onPress={() => {
            setVehicleStepIndex(0);
            setVehicleSheetOpen(true);
          }}
          activeOpacity={0.85}
          className={`flex-row items-center rounded-lg border bg-white px-4 ${
            errors.vehicle ? "border-red-400" : "border-gray-200"
          } ${lines.length > 0 ? "py-3" : "h-14"}`}
        >
          <View className="flex-1">
            {lines.length > 0 ? (
              <>
                <Text className="text-xs text-gray-500">
                  Make, Model & Year
                </Text>
                {lines.map((line) => (
                  <Text
                    key={line}
                    className="mt-1 text-base font-semibold text-gray-900"
                  >
                    {line}
                  </Text>
                ))}
              </>
            ) : (
              <Text className="text-base text-gray-400">
                Make, Model & Year
              </Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>
        {errors.vehicle ? <FieldError message={errors.vehicle} /> : null}
      </View>
    );
  };

  const renderDelivery = () => (
    <View className="mb-3 flex-row items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
      <View>
        <Text className="text-base text-gray-900">Free Delivery</Text>
        <Text className="mt-0.5 text-sm text-gray-500">
          {values.deliveryFree === "true" ? "Yes" : "No"}
        </Text>
      </View>
      <Switch
        value={values.deliveryFree === "true"}
        onValueChange={(next) =>
          setValue("deliveryFree", next ? "true" : "false")
        }
        trackColor={{ false: "#E5E7EB", true: "#93C5FD" }}
        thumbColor={
          values.deliveryFree === "true" ? Colors.primary.DEFAULT : "#FFFFFF"
        }
      />
    </View>
  );

  const renderContact = () => (
    <View>
      <View className="mb-3">
        <FloatingInput
          label="Name"
          value={values.contactName ?? ""}
          onChangeText={(text) => setValue("contactName", text)}
          error={errors.contactName}
        />
      </View>

      {contactPhones.map((phone, index) => {
        const canRemove = index > 0;
        const canAdd =
          contactPhones.length < MAX_PHONE_ROWS &&
          index === contactPhones.length - 1;
        return (
          <View key={`phone-${index}`} className="mb-3 flex-row items-center">
            <View className="flex-1">
              <FloatingInput
                label={`Phone Number ${index + 1}`}
                value={phone}
                onChangeText={(text) => {
                  setContactPhones((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? text : item,
                    ),
                  );
                  if (text.trim()) clearError("contactPhones");
                }}
                keyboardType="phone-pad"
                error={index === 0 ? errors.contactPhones : undefined}
                rightAccessory={
                  canRemove ? (
                    <TouchableOpacity
                      onPress={() =>
                        setContactPhones((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                      className="h-8 w-8 items-center justify-center rounded-full bg-red-500"
                      accessibilityRole="button"
                      accessibilityLabel="Remove phone number"
                    >
                      <Ionicons name="remove" size={18} color="white" />
                    </TouchableOpacity>
                  ) : undefined
                }
              />
            </View>
            {canAdd ? (
              <TouchableOpacity
                onPress={() => setContactPhones((current) => [...current, ""])}
                className="ml-2 h-9 w-9 items-center justify-center rounded-full bg-primary"
                accessibilityRole="button"
                accessibilityLabel="Add phone number"
              >
                <Ionicons name="add" size={20} color="white" />
              </TouchableOpacity>
            ) : null}
          </View>
        );
      })}

      <View>
        <FloatingInput
          label="Email"
          value={values.contactEmail ?? ""}
          onChangeText={(text) => setValue("contactEmail", text)}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>
    </View>
  );

  const renderField = (field: FieldDef) => {
    switch (field.key) {
      case "price":
        return renderPrice(field);
      case "discount":
        return null;
      case "condition":
        return renderCondition();
      case "productSpec":
        return renderProductSpec();
      case "brand":
        return renderVehicleSummary();
      case "model":
      case "year":
      case "color":
        return null;
      case "deliveryFree":
      case "contactName":
      case "contactPhones":
      case "contactEmail":
      case "photos":
      case "location":
      case "address":
      case "title":
        return null;
      default:
        if (field.type === "select") return renderSelect(field);
        if (field.type === "number") return renderTextInput(field, false, true);
        if (field.type === "boolean") {
          return (
            <View
              key={field.key}
              className="mb-3 flex-row items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
            >
              <Text className="text-base text-gray-900">
                {fieldLabel(field.key, field.label?.en)}
              </Text>
              <Switch
                value={values[field.key] === "true"}
                onValueChange={(next) =>
                  setValue(field.key, next ? "true" : "false")
                }
              />
            </View>
          );
        }
        if (field.type === "contact") return renderTextInput(field);
        return renderTextInput(field, field.key === "description", false);
    }
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="lock-closed-outline" size={44} color="#9CA3AF" />
          <Text className="mt-3 text-center text-neutral-text-sub">
            Sign in to post an ad.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/(auth)/sign-in")}
            className="mt-4 rounded-lg bg-secondary-orange px-8 py-3"
          >
            <Text className="font-bold text-white">Sign in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const detailFields = schema.filter(
    (field) => !DETAIL_SKIP_KEYS.has(field.key),
  );
  const subcategoryName =
    selectedSubcategory?.name ?? subcategory?.name ?? subcategorySlug;
  const hasContactFields =
    declares("contactName") ||
    declares("contactPhones") ||
    declares("contactEmail");

  return (
    <SafeAreaView
      statusBarColor={Colors.primary.DEFAULT}
      statusBarStyle="light-content"
      className="flex-1 bg-white"
    >
      <AccountHeader title="New Ad" variant="blue" showHeadset={false} />

      <ScrollView
        ref={scrollRef}
        className="flex-1 bg-white"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!categorySlug || !subcategorySlug ? (
          <View className="items-center px-6 py-16">
            <Ionicons name="pricetags-outline" size={40} color="#9CA3AF" />
            <Text className="mt-3 text-center text-sm text-gray-500">
              Choose a category and subcategory first.
            </Text>
            <TouchableOpacity
              onPress={() => router.back()}
              className="mt-4 rounded-lg bg-primary px-6 py-2.5"
            >
              <Text className="font-bold text-white">Choose again</Text>
            </TouchableOpacity>
          </View>
        ) : subQuery.isLoading ? (
          <View className="items-center py-16">
            <ActivityIndicator color={Colors.primary.DEFAULT} />
          </View>
        ) : !subcategory ? (
          <View className="items-center px-6 py-16">
            <Text className="text-center text-sm text-gray-500">
              Could not load this form. Go back and choose the category again.
            </Text>
          </View>
        ) : (
          <>
            {renderPhotos()}
            <SectionBand />

            <View className="bg-white px-4 pb-4 pt-3">
              <Text className="mb-3 text-lg font-bold text-gray-900">
                Ads Detail
              </Text>

              <TouchableOpacity
                onPress={() => router.back()}
                activeOpacity={0.85}
                className="mb-3 flex-row items-center rounded-lg border border-gray-200 bg-white px-4 py-3"
              >
                <View className="flex-1">
                  <Text className="text-xs text-gray-500">
                    Categories: {selectedCategory?.name ?? categorySlug}
                  </Text>
                  <Text
                    className="mt-1 text-base text-gray-900"
                    numberOfLines={1}
                  >
                    {subcategoryName}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>

              <View className="mb-3">
                <FloatingInput
                  label="Title"
                  value={values.title ?? ""}
                  onChangeText={(text) => setValue("title", text)}
                  error={errors.title}
                />
              </View>

              {detailFields.map(renderField)}

              {declares("location") ? (
                <>
                  <View className="mb-3">
                    <TouchableOpacity
                      onPress={() => setShowLocationPicker(true)}
                      activeOpacity={0.85}
                      className={`flex-row items-center rounded-lg border bg-white px-4 ${
                        errors.location ? "border-red-400" : "border-gray-200"
                      } ${hasLocation ? "py-3" : "h-14"}`}
                    >
                      <View className="flex-1">
                        {hasLocation ? (
                          <>
                            <Text className="text-xs text-gray-500">
                              Location
                            </Text>
                            <Text
                              className="mt-1 text-base text-gray-900"
                              numberOfLines={1}
                            >
                              {locationLabel}
                            </Text>
                          </>
                        ) : (
                          <Text className="text-base text-gray-400">
                            Location
                          </Text>
                        )}
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color="#9CA3AF"
                      />
                    </TouchableOpacity>
                    {errors.location ? (
                      <FieldError message={errors.location} />
                    ) : null}
                  </View>

                  <View className="mb-3">
                    <FloatingInput
                      label="Address"
                      value={values.address ?? ""}
                      onChangeText={(text) => setValue("address", text)}
                      multiline
                      error={errors.address}
                    />
                  </View>

                  <TouchableOpacity
                    onPress={() => void handleUseMyLocation()}
                    activeOpacity={locationPin ? 1 : 0.85}
                    disabled={!!locationPin || pinPending}
                    className="mb-3 flex-row items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
                  >
                    <View className="flex-1 flex-row items-center gap-3">
                      <Ionicons
                        name="navigate"
                        size={20}
                        color={locationPin ? Colors.primary.DEFAULT : "#9CA3AF"}
                      />
                      <View className="flex-1">
                        <Text className="text-base font-medium text-gray-900">
                          {locationPin
                            ? "Location pin set"
                            : "Use my current location"}
                        </Text>
                        {locationPin ? (
                          <Text className="mt-0.5 text-xs text-gray-500">
                            {locationPin.lat.toFixed(5)},{" "}
                            {locationPin.lng.toFixed(5)}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    {pinPending ? (
                      <ActivityIndicator color={Colors.primary.DEFAULT} />
                    ) : locationPin ? (
                      <TouchableOpacity
                        onPress={() => setLocationPin(null)}
                        accessibilityRole="button"
                        accessibilityLabel="Clear location pin"
                      >
                        <Text className="text-sm font-semibold text-red-500">
                          Clear
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color="#9CA3AF"
                      />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={openMap}
                    activeOpacity={0.9}
                    className="mb-3 h-40 overflow-hidden rounded-lg"
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
                          {locationPin
                            ? "View pin on Google Maps"
                            : "Set location on Google Maps"}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </>
              ) : null}
            </View>

            {declares("deliveryFree") ? (
              <>
                <SectionBand />
                <View className="bg-white px-4 pb-4 pt-3">
                  <Text className="mb-3 text-lg font-bold text-gray-900">
                    Deliveries
                  </Text>
                  {renderDelivery()}
                </View>
              </>
            ) : null}

            {hasContactFields ? (
              <>
                <SectionBand />
                <View className="bg-white px-4 pb-4 pt-3">
                  <Text className="mb-3 text-lg font-bold text-gray-900">
                    Ads Contact
                  </Text>
                  {renderContact()}
                </View>
              </>
            ) : null}

            <View className="items-center bg-neutral-border px-6 py-6">
              <Text className="text-center text-sm text-gray-700">
                By submitting, I agree to the Advertising rule of PhsarKhmer
              </Text>
              <TouchableOpacity
                onPress={() => void Linking.openURL(`${SITE_URL}/posting-rule`)}
                className="mt-2"
              >
                <Text className="text-sm font-semibold text-primary">
                  Read Advertising Rule
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      <View
        className="bg-white px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <TouchableOpacity
          onPress={() => void handleSubmit()}
          disabled={submitting || pinPending || !subcategory}
          activeOpacity={0.9}
          className={`h-12 items-center justify-center rounded-md ${
            subcategory && !pinPending ? "bg-secondary-orange" : "bg-gray-300"
          }`}
        >
          {submitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-base font-bold text-white">Submit</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Province / district / commune picker */}
      <BottomSheet
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
      >
        <View
          className="px-4 pt-4"
          style={{ paddingBottom: insets.bottom + 24 }}
        >
          <View className="mb-3 flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => setShowLocationPicker(false)}
              className="h-10 w-10 items-center justify-center rounded-full bg-gray-100"
              accessibilityRole="button"
              accessibilityLabel="Close location picker"
            >
              <Ionicons name="close" size={20} color="#4B5563" />
            </TouchableOpacity>
            <View
              pointerEvents="none"
              className="absolute bottom-0 left-0 right-0 top-0 items-center justify-center"
            >
              <Text className="text-xl font-bold text-gray-900">Location</Text>
            </View>
            <View className="h-10 w-10" />
          </View>

          <DropdownField
            label="Province"
            value={province?.slug ?? ""}
            placeholder="Select province"
            options={provinces.map((row) => ({
              id: row.slug,
              name: row.name,
            }))}
            onSelect={(option) => {
              const match =
                provinces.find((row) => row.slug === option.id) ?? null;
              setProvince(match);
              setDistrict(null);
              setCommune(null);
              clearError("location");
            }}
            onClear={() => {
              setProvince(null);
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
            options={districts.map((row) => ({
              id: row.slug,
              name: row.name,
            }))}
            onSelect={(option) => {
              const match =
                districts.find((row) => row.slug === option.id) ?? null;
              setDistrict(match);
              setCommune(null);
              clearError("location");
            }}
            onClear={() => {
              setDistrict(null);
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
            options={communes.map((row) => ({
              id: row.slug,
              name: row.name,
            }))}
            onSelect={(option) => {
              const match =
                communes.find((row) => row.slug === option.id) ?? null;
              setCommune(match);
              clearError("location");
            }}
            onClear={() => setCommune(null)}
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
      </BottomSheet>

      {/* Brand → Model → Year → Color wizard */}
      <SelectionSheet
        visible={vehicleSheetOpen}
        title={vehicleStep ? fieldLabel(vehicleStep) : ""}
        options={vehicleStepOptions()}
        value={vehicleStep ? (values[vehicleStep] ?? "") : ""}
        loading={vehicleStepLoading}
        onSelect={handleVehicleSelect}
        onClear={handleVehicleClear}
        onBack={
          vehicleStepIndex > 0
            ? () => setVehicleStepIndex(vehicleStepIndex - 1)
            : undefined
        }
        onClose={() => setVehicleSheetOpen(false)}
        emptyLabel="No options"
      />
    </SafeAreaView>
  );
};

export default NewAdScreen;
