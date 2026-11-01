import DropdownField, {
  type DropdownOption,
} from "@/components/common/DropdownField";
import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/api/client";
import { fetchCategories } from "@/lib/api/listings";
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
import {
  FAMILY_BY_SUBCATEGORY,
  NON_ATTRIBUTE_KEYS,
  SET_FOR_KEY,
  fieldLabel,
  isFieldRequired,
  makeIdempotencyKey,
} from "@/lib/sell";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StatusBar,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

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

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Something went wrong. Please try again.";
}

const SellScreen = () => {
  const { isAuthenticated } = useAuth();

  const [categorySlug, setCategorySlug] = useState("");
  const [subcategorySlug, setSubcategorySlug] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [condition, setCondition] = useState<"new" | "used">("used");
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [province, setProvince] = useState<PlaceSummary | null>(null);
  const [district, setDistrict] = useState<PlaceSummary | null>(null);
  const [commune, setCommune] = useState<PlaceSummary | null>(null);

  const [contactPhones, setContactPhones] = useState<string[]>([""]);
  const [productModelId, setProductModelId] = useState("");

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime: 5 * 60_000,
  });
  const categories = categoriesQuery.data ?? [];
  const selectedCategory = categories.find(
    (category) => category.slug === categorySlug,
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
  const provinces = provincesQuery.data ?? [];

  const districtsQuery = useQuery({
    queryKey: ["districts", province?.slug],
    queryFn: () => fetchDistricts(province!.slug),
    enabled: !!province?.slug,
  });
  const districts = districtsQuery.data ?? [];

  const communesQuery = useQuery({
    queryKey: ["communes", province?.slug, district?.slug],
    queryFn: () => fetchCommunes(province!.slug, district!.slug),
    enabled: !!province?.slug && !!district?.slug,
  });
  const communes = communesQuery.data ?? [];

  const linkedGroups = useMemo(() => {
    const groups: Record<string, AttributeSummary[]> = {};
    for (const row of linkedQuery.data ?? []) {
      (groups[row.type] ??= []).push(row);
    }
    return groups;
  }, [linkedQuery.data]);

  const setValue = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const optionsFor = (field: FieldDef): DropdownOption[] => {
    if (field.options?.length) {
      return field.options.map((option) => ({ id: option, name: option }));
    }
    const set = SET_FOR_KEY[field.key];
    const rows = set ? linkedGroups[set] : undefined;
    if (rows?.length) {
      return rows.map((row) => ({ id: row.name, name: row.name }));
    }
    return [];
  };

  const photosField = schema.find((field) => field.key === "photos");
  const schemaPhotoMax = photosField?.max ?? 8;
  const photoCap = Math.min(
    schemaPhotoMax,
    entitlements?.limits.photos ?? schemaPhotoMax,
  );

  const resetForSubcategory = (slug: string) => {
    setSubcategorySlug(slug);
    setValues({});
    setCondition("used");
    setProductModelId("");
  };

  const resetAll = () => {
    setCategorySlug("");
    setSubcategorySlug("");
    setValues({});
    setCondition("used");
    setPhotos([]);
    setProductModelId("");
    setProvince(null);
    setDistrict(null);
    setCommune(null);
    setContactPhones([""]);
  };

  // ---- Photos (9d) ------------------------------------------------------
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

  // ---- Validation + submit (9e) ----------------------------------------
  const handleSubmit = async () => {
    if (!isAuthenticated) {
      router.push("/(auth)/sign-in");
      return;
    }
    if (!subcategory || !selectedCategory) {
      Alert.alert("Required", "Choose a category and subcategory first.");
      return;
    }

    const missing: string[] = [];
    for (const field of schema) {
      if (!isFieldRequired(field.key, subcategorySlug, schemaKeys)) continue;
      const label = fieldLabel(field.key, field.label?.en);

      if (field.key === "price") {
        const amount = Number(values.price ?? "");
        if (!values.price?.trim() || !Number.isFinite(amount) || amount <= 0) {
          missing.push(label);
        }
      } else if (field.key === "location") {
        if (!province || !district || !commune) missing.push(label);
      } else if (field.key === "contactPhones") {
        if (!contactPhones[0]?.trim()) missing.push("Phone Number");
      } else if (field.key === "productSpec") {
        if (!productModelId) missing.push(label);
      } else if (field.key === "condition") {
        if (!condition) missing.push(label);
      } else if (field.key === "contactName") {
        if (!values.contactName?.trim()) missing.push(label);
      } else if (field.key === "photos") {
        /* photos are optional */
      } else if (!(values[field.key] ?? "").trim()) {
        missing.push(label);
      }
    }

    if (missing.length > 0) {
      Alert.alert("Required", `Please fill: ${missing.join(", ")}.`);
      return;
    }

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
      ...(declares("condition") ? { condition } : {}),
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

  // ---- Field renderers --------------------------------------------------
  const renderPhotos = () => (
    <View key="photos" className="mb-2 bg-white p-4">
      <View className="mb-3 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Ionicons name="camera" size={20} color={Colors.primary.DEFAULT} />
          <Text className="ml-2 text-base font-bold text-neutral-text-main">
            Upload Photos
          </Text>
        </View>
        <Text className="text-xs font-medium text-neutral-text-sub">
          {photos.length}/{photoCap} Photos
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-3 py-1">
          <TouchableOpacity
            onPress={() => void pickPhotos()}
            disabled={uploading || photos.length >= photoCap}
            className="h-24 w-24 items-center justify-center rounded-xl border-2 border-dashed border-primary/50 bg-primary/5"
          >
            {uploading ? (
              <ActivityIndicator color={Colors.primary.DEFAULT} />
            ) : (
              <>
                <Ionicons
                  name="add-circle"
                  size={32}
                  color={Colors.primary.DEFAULT}
                />
                <Text className="mt-1 text-[11px] font-semibold text-primary">
                  Add Photo
                </Text>
              </>
            )}
          </TouchableOpacity>

          {photos.map((photo, index) => (
            <View key={`${photo.path}-${index}`} className="relative">
              <Image
                source={{ uri: photo.localUri ?? photo.url }}
                className="h-24 w-24 rounded-xl bg-neutral-background"
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
        </View>
      </ScrollView>

      <Text className="mt-3 text-[11px] text-neutral-text-muted">
        JPEG, PNG or WebP, up to 5 MB each.
      </Text>
    </View>
  );

  const renderTextInput = (
    field: FieldDef,
    multiline = false,
    numeric = false,
  ) => {
    const label = fieldLabel(field.key, field.label?.en);
    const required = isFieldRequired(field.key, subcategorySlug, schemaKeys);
    return (
      <View key={field.key} className="mb-3">
        <Text className="mb-1 text-xs font-medium text-neutral-text-sub">
          {label}
          {required ? <Text className="text-red-500"> *</Text> : null}
        </Text>
        <TextInput
          value={values[field.key] ?? ""}
          onChangeText={(text) => setValue(field.key, text)}
          multiline={multiline}
          keyboardType={numeric ? "numeric" : "default"}
          placeholder={label}
          placeholderTextColor={Colors.text.muted}
          className={`rounded-lg border border-neutral-border bg-white px-4 text-base text-neutral-text-main ${
            multiline ? "min-h-[96px] py-3" : "py-3"
          }`}
          textAlignVertical={multiline ? "top" : "center"}
        />
      </View>
    );
  };

  const renderSelect = (field: FieldDef) => {
    const label = fieldLabel(field.key, field.label?.en);
    const required = isFieldRequired(field.key, subcategorySlug, schemaKeys);
    const options = optionsFor(field);

    if (options.length === 0) {
      return renderTextInput(field);
    }

    return (
      <View key={field.key} className="mb-3">
        <DropdownField
          label={label}
          value={values[field.key]}
          options={options}
          onSelect={(option) => setValue(field.key, option.id)}
          required={required}
          searchable={options.length > 8}
        />
      </View>
    );
  };

  const renderCondition = () => (
    <View key="condition" className="mb-3">
      <Text className="mb-1 text-xs font-medium text-neutral-text-sub">
        Condition<Text className="text-red-500"> *</Text>
      </Text>
      <View className="flex-row gap-2">
        {CONDITION_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.id}
            onPress={() => setCondition(option.id as "new" | "used")}
            className={`flex-1 items-center rounded-lg border py-3 ${
              condition === option.id
                ? "border-primary bg-primary/10"
                : "border-neutral-border bg-white"
            }`}
          >
            <Text
              className={`font-semibold ${
                condition === option.id
                  ? "text-primary"
                  : "text-neutral-text-sub"
              }`}
            >
              {option.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderPrice = (field: FieldDef) => (
    <View key={field.key} className="mb-3">
      <Text className="mb-1 text-xs font-medium text-neutral-text-sub">
        Price<Text className="text-red-500"> *</Text>
      </Text>
      <View className="flex-row items-center gap-2">
        <View className="flex-1 flex-row items-center rounded-lg border border-neutral-border bg-white px-4">
          <Text className="mr-1 text-base font-bold text-neutral-text-muted">
            $
          </Text>
          <TextInput
            value={values.price ?? ""}
            onChangeText={(text) => setValue("price", text)}
            keyboardType="numeric"
            placeholder="0.00"
            placeholderTextColor={Colors.text.muted}
            className="flex-1 py-3 text-base text-neutral-text-main"
          />
        </View>
      </View>

      {declares("discount") && (
        <View className="mt-3">
          <Text className="mb-1 text-xs font-medium text-neutral-text-sub">
            Discount (optional)
          </Text>
          <View className="flex-row items-center gap-2">
            <TextInput
              value={values.discount ?? ""}
              onChangeText={(text) => setValue("discount", text)}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={Colors.text.muted}
              className="flex-1 rounded-lg border border-neutral-border bg-white px-4 py-3 text-base text-neutral-text-main"
            />
            <View className="flex-row rounded-lg border border-neutral-border bg-white p-1">
              {(["percent", "amount"] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setValue("discountType", type)}
                  className={`rounded-md px-3 py-2 ${
                    (values.discountType ?? "percent") === type
                      ? "bg-primary/10"
                      : ""
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      (values.discountType ?? "percent") === type
                        ? "text-primary"
                        : "text-neutral-text-sub"
                    }`}
                  >
                    {type === "percent" ? "%" : "$"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}
    </View>
  );

  const renderLocation = () => (
    <View key="location" className="mb-3">
      <DropdownField
        label="Province"
        value={province?.slug}
        options={provinces.map((place) => ({
          id: place.slug,
          name: place.name,
        }))}
        onSelect={(option) => {
          const place = provinces.find((item) => item.slug === option.id);
          setProvince(place ?? null);
          setDistrict(null);
          setCommune(null);
        }}
        required
        searchable
      />
      {province && (
        <View className="mt-3">
          <DropdownField
            label="District"
            value={district?.slug}
            options={districts.map((place) => ({
              id: place.slug,
              name: place.name,
            }))}
            onSelect={(option) => {
              const place = districts.find((item) => item.slug === option.id);
              setDistrict(place ?? null);
              setCommune(null);
            }}
            required
            searchable
          />
        </View>
      )}
      {district && (
        <View className="mt-3">
          <DropdownField
            label="Commune"
            value={commune?.slug}
            options={communes.map((place) => ({
              id: place.slug,
              name: place.name,
            }))}
            onSelect={(option) => {
              const place = communes.find((item) => item.slug === option.id);
              setCommune(place ?? null);
            }}
            required
            searchable
          />
        </View>
      )}
    </View>
  );

  const renderContact = () => (
    <View key="contact" className="mb-3">
      <Text className="mb-1 text-xs font-medium text-neutral-text-sub">
        Contact Name<Text className="text-red-500"> *</Text>
      </Text>
      <TextInput
        value={values.contactName ?? ""}
        onChangeText={(text) => setValue("contactName", text)}
        placeholder="Your name"
        placeholderTextColor={Colors.text.muted}
        className="mb-3 rounded-lg border border-neutral-border bg-white px-4 py-3 text-base text-neutral-text-main"
      />

      <Text className="mb-1 text-xs font-medium text-neutral-text-sub">
        Phone Numbers<Text className="text-red-500"> *</Text>
      </Text>
      {contactPhones.map((phone, index) => (
        <View key={`phone-${index}`} className="mb-2 flex-row items-center">
          <TextInput
            value={phone}
            onChangeText={(text) =>
              setContactPhones((current) =>
                current.map((item, itemIndex) =>
                  itemIndex === index ? text : item,
                ),
              )
            }
            keyboardType="phone-pad"
            placeholder="Phone number"
            placeholderTextColor={Colors.text.muted}
            className="flex-1 rounded-lg border border-neutral-border bg-white px-4 py-3 text-base text-neutral-text-main"
          />
          {contactPhones.length < 3 && index === contactPhones.length - 1 && (
            <TouchableOpacity
              onPress={() => setContactPhones((current) => [...current, ""])}
              className="ml-2 h-10 w-10 items-center justify-center rounded-full bg-primary"
            >
              <Ionicons name="add" size={20} color="white" />
            </TouchableOpacity>
          )}
          {contactPhones.length > 1 && (
            <TouchableOpacity
              onPress={() =>
                setContactPhones((current) =>
                  current.filter((_, itemIndex) => itemIndex !== index),
                )
              }
              className="ml-2 h-10 w-10 items-center justify-center rounded-full border border-red-400"
            >
              <Ionicons name="remove" size={20} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
      ))}

      <Text className="mb-1 mt-2 text-xs font-medium text-neutral-text-sub">
        Email (optional)
      </Text>
      <TextInput
        value={values.contactEmail ?? ""}
        onChangeText={(text) => setValue("contactEmail", text)}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholder="you@example.com"
        placeholderTextColor={Colors.text.muted}
        className="rounded-lg border border-neutral-border bg-white px-4 py-3 text-base text-neutral-text-main"
      />
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
        }))}
        onSelect={(option) => setProductModelId(option.id)}
        required
        searchable
      />
    </View>
  );

  const renderField = (field: FieldDef) => {
    switch (field.key) {
      case "photos":
        return renderPhotos();
      case "price":
        return renderPrice(field);
      case "discount":
        return null;
      case "condition":
        return renderCondition();
      case "location":
        return renderLocation();
      case "contactName":
        return renderContact();
      case "contactPhones":
      case "contactEmail":
        return null;
      case "productSpec":
        return renderProductSpec();
      case "brand":
        return (
          <View key="brand" className="mb-3">
            <DropdownField
              label="Brand"
              value={values.brand}
              options={brands.map((brand) => ({
                id: brand.name,
                name: brand.name,
              }))}
              onSelect={(option) => {
                setValue("brand", option.id);
                setValue("model", "");
              }}
              required
              searchable
            />
          </View>
        );
      case "model":
        return (
          <View key="model" className="mb-3">
            <DropdownField
              label="Model"
              value={values.model}
              options={models.map((model) => ({
                id: model.name,
                name: model.name,
              }))}
              onSelect={(option) => setValue("model", option.id)}
              disabled={!values.brand}
              searchable
            />
          </View>
        );
      case "year":
        return (
          <View key="year" className="mb-3">
            <DropdownField
              label="Year"
              value={values.year}
              options={(yearsQuery.data ?? []).map((year) => ({
                id: year.name,
                name: year.name,
              }))}
              onSelect={(option) => setValue("year", option.id)}
              required
              searchable
            />
          </View>
        );
      case "deliveryFree":
        return (
          <View
            key="deliveryFree"
            className="mb-3 flex-row items-center justify-between rounded-lg border border-neutral-border bg-white px-4 py-3"
          >
            <Text className="text-base text-neutral-text-main">
              Free Delivery
            </Text>
            <Switch
              value={values.deliveryFree === "true"}
              onValueChange={(next) =>
                setValue("deliveryFree", next ? "true" : "false")
              }
            />
          </View>
        );
      default:
        if (field.type === "select") return renderSelect(field);
        if (field.type === "number") return renderTextInput(field, false, true);
        if (field.type === "boolean") {
          return (
            <View
              key={field.key}
              className="mb-3 flex-row items-center justify-between rounded-lg border border-neutral-border bg-white px-4 py-3"
            >
              <Text className="text-base text-neutral-text-main">
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
      <SafeAreaView className="flex-1 bg-neutral-surface">
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

  return (
    <SafeAreaView className="flex-1 bg-neutral-surface">
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View className="flex-row items-center justify-between border-b border-neutral-border bg-white px-4 py-3 shadow-sm">
        <TouchableOpacity onPress={resetAll}>
          <Text className="text-sm font-medium text-neutral-text-sub">
            Clear
          </Text>
        </TouchableOpacity>

        <Text className="text-base font-bold text-neutral-text-main">
          Post Ad (លក់ទំនិញ)
        </Text>

        <TouchableOpacity
          onPress={() => void handleSubmit()}
          disabled={submitting}
          className="rounded-full bg-primary px-4 py-1.5"
        >
          {submitting ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text className="text-xs font-bold text-white">Post Ad</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1 bg-neutral-background"
        contentContainerStyle={{ paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Category */}
        <View className="mb-2 bg-white p-4">
          <Text className="mb-3 text-base font-bold text-neutral-text-main">
            Category
          </Text>
          <DropdownField
            label="Main Category"
            value={categorySlug}
            options={categories.map((category) => ({
              id: category.slug,
              name: category.name,
            }))}
            onSelect={(option) => {
              setCategorySlug(option.id);
              setSubcategorySlug("");
              setValues({});
              setCondition("used");
              setProductModelId("");
            }}
            required
            searchable
          />

          {selectedCategory && (
            <View className="mt-3">
              <DropdownField
                label="Subcategory"
                value={subcategorySlug}
                options={(selectedCategory.subcategories ?? []).map(
                  (entry) => ({
                    id: entry.slug,
                    name: entry.name,
                  }),
                )}
                onSelect={(option) => resetForSubcategory(option.id)}
                required
                searchable
              />
            </View>
          )}
        </View>

        {subQuery.isLoading ? (
          <View className="items-center py-8">
            <ActivityIndicator color={Colors.primary.DEFAULT} />
          </View>
        ) : subcategory ? (
          <>
            {schema.map(renderField)}

            {submitting && (
              <View className="items-center py-4">
                <ActivityIndicator color={Colors.primary.DEFAULT} />
                <Text className="mt-2 text-xs text-neutral-text-sub">
                  Publishing…
                </Text>
              </View>
            )}
          </>
        ) : (
          <View className="items-center px-6 py-10">
            <Ionicons name="pricetags-outline" size={36} color="#9CA3AF" />
            <Text className="mt-2 text-center text-sm text-neutral-text-sub">
              Choose a category and subcategory to load the form.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default SellScreen;
