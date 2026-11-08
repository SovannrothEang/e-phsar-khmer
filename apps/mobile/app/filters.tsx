import SafeAreaView from "@/components/common/SafeAreaView";
import SelectionSheet from "@/components/common/SelectionSheet";
import {
  fetchBrands,
  fetchModels,
  fetchCommunes,
  fetchDistricts,
  fetchProvinces,
  fetchSubcategory,
} from "@/lib/api/catalog";
import {
  CONDITION_OPTIONS,
  SORT_OPTIONS,
  type FilterOption,
} from "@/lib/filter-options";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DATE_OPTIONS: FilterOption[] = [
  { id: "today", name: "Today" },
  { id: "week", name: "Last 7 days" },
  { id: "month", name: "Last 30 days" },
];

/** Labels for the schema keys that do not carry a `label` object. */
const FIELD_LABELS: Record<string, string> = {
  storage: "Storage",
  screenSize: "Screen Size",
  ram: "RAM",
  cpu: "CPU",
  vga: "VGA",
  type: "Type",
  bodyType: "Body Type",
  engineType: "Engine Type",
  transmission: "Transmission",
  taxType: "Tax Type",
  color: "Color",
  jobType: "Job Type",
  experience: "Experience",
  accessory: "Accessory",
  network: "Network",
  bedroom: "Bedroom",
  bathroom: "Bathroom",
  facing: "Facing",
  vehicleType: "Vehicle Type",
};

/**
 * One filter row in the reference's card style: a white rounded card with the
 * floating label above the chosen value, or just the placeholder when empty.
 * Disabled rows keep the card but dim it (the reference's grey Sangkat row).
 */
const FilterCard = ({
  label,
  value,
  placeholder,
  disabled = false,
  onPress,
}: {
  label: string;
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  onPress: () => void;
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      className={`mb-3 flex-row items-center justify-between rounded-lg px-4 py-3 ${
        disabled ? "bg-gray-200" : "bg-white"
      }`}
    >
      <View className="flex-1 pr-3">
        {value ? <Text className="text-xs text-gray-400">{label}</Text> : null}
        <Text
          className={`text-base ${
            value
              ? "text-gray-900"
              : disabled
                ? "text-gray-400"
                : "text-gray-500"
          }`}
          numberOfLines={1}
        >
          {value || placeholder || label}
        </Text>
      </View>
      <Ionicons
        name="chevron-down"
        size={18}
        color={disabled ? "#C0C4CC" : "#9CA3AF"}
      />
    </TouchableOpacity>
  );
};

/** Label + switch row used by the boolean attribute filters. */
const ToggleRow = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) => (
  <View className="mb-3 flex-row items-center justify-between rounded-lg bg-white px-4 py-3">
    <View className="flex-1 pr-3">
      <Text className="text-xs text-gray-400">{label}</Text>
      <Text className="text-base text-gray-900">{value ? "Yes" : "No"}</Text>
    </View>
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: "#D1D5DB", true: "#00A0E9" }}
      thumbColor="white"
    />
  </View>
);

/** "Any / A / B" segmented row used by the short enum attributes. */
const SegmentedRow = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (next: string) => void;
}) => (
  <View className="mb-3">
    <Text className="mb-2 text-base font-semibold text-gray-900">{label}</Text>
    <View className="flex-row gap-3">
      {options.map((option) => {
        const isSelected = value === option.id;
        return (
          <TouchableOpacity
            key={option.id || "any"}
            onPress={() => onChange(option.id)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            className={`h-[44px] flex-1 items-center justify-center rounded-[4px] border ${
              isSelected
                ? "border-primary bg-[#DCEEF8]"
                : "border-gray-200 bg-white"
            }`}
          >
            <Text className="text-base text-gray-900">{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
);

/** Sets or removes one attribute filter without touching the others. */
function withAttr(
  attrs: Record<string, string>,
  key: string,
  value: string,
): Record<string, string> {
  const next = { ...attrs };
  if (value.trim() === "") delete next[key];
  else next[key] = value;
  return next;
}

function firstParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw ?? "";
}

function parseAttrs(raw: string): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).map(
          ([key, value]) => [key, String(value)],
        ),
      );
    }
  } catch {
    /* malformed */
  }
  return {};
}

export default function FiltersScreen() {
  const params = useLocalSearchParams();
  const categoryId = firstParam(params.categoryId);
  const subCategoryId = firstParam(params.subCategoryId);
  // The public profile opens this screen for one seller's ads: only the
  // generic rows apply there (sort, date, location, price), never a
  // category's brands or spec attributes.
  const userId = firstParam(params.userId);
  const username = firstParam(params.username);
  // The profile's keyword is not shown here, but it must survive Apply.
  const keyword = firstParam(params.q);
  const isProfile = !!userId;
  const isJobs = !isProfile && categoryId === "jobs";
  const insets = useSafeAreaInsets();

  const [sort, setSort] = useState(firstParam(params.sort));
  const [postedWithin, setPostedWithin] = useState(
    firstParam(params.postedWithin),
  );
  const [provinceSlug, setProvinceSlug] = useState(
    firstParam(params.provinceSlug),
  );
  const [districtSlug, setDistrictSlug] = useState(
    firstParam(params.districtSlug),
  );
  const [communeSlug, setCommuneSlug] = useState(
    firstParam(params.communeSlug),
  );
  const [minPrice, setMinPrice] = useState(firstParam(params.minPrice));
  const [maxPrice, setMaxPrice] = useState(firstParam(params.maxPrice));
  const [yearMin, setYearMin] = useState(firstParam(params.yearMin));
  const [yearMax, setYearMax] = useState(firstParam(params.yearMax));
  const [view, setView] = useState(firstParam(params.view));
  const [condition, setCondition] = useState(firstParam(params.condition));
  const [brand, setBrand] = useState(firstParam(params.brand));
  const [attrs, setAttrs] = useState<Record<string, string>>(() =>
    parseAttrs(firstParam(params.attrs)),
  );
  // Which picker sheet is open. Attribute rows use `attr:<field key>`.
  const [sheet, setSheet] = useState<string | null>(null);

  const subQuery = useQuery({
    queryKey: ["subcategory", categoryId, subCategoryId],
    queryFn: () => fetchSubcategory(categoryId, subCategoryId),
    enabled: !!categoryId && !!subCategoryId,
  });
  const subcategory = subQuery.data;

  const brandsQuery = useQuery({
    queryKey: ["brands", subCategoryId],
    queryFn: () => fetchBrands(subCategoryId),
    enabled: !!subCategoryId,
  });
  const brands = brandsQuery.data ?? [];

  const brandId = brands.find((entry) => entry.name === brand)?.id;
  const modelsQuery = useQuery({
    queryKey: ["models", brandId, subCategoryId],
    queryFn: () => fetchModels(brandId!, subCategoryId),
    enabled: !!brandId,
  });
  const models = modelsQuery.data ?? [];

  const provincesQuery = useQuery({
    queryKey: ["provinces"],
    queryFn: fetchProvinces,
  });
  const provinces = provincesQuery.data ?? [];

  const districtsQuery = useQuery({
    queryKey: ["districts", provinceSlug],
    queryFn: () => fetchDistricts(provinceSlug),
    enabled: !!provinceSlug,
  });
  const districts = districtsQuery.data ?? [];

  const communesQuery = useQuery({
    queryKey: ["communes", provinceSlug, districtSlug],
    queryFn: () => fetchCommunes(provinceSlug, districtSlug),
    enabled: !!provinceSlug && !!districtSlug,
  });
  const communes = communesQuery.data ?? [];

  const selectFields = useMemo(() => {
    const fields = subcategory?.fieldSchema ?? [];
    return fields.filter(
      (field) =>
        field.type === "select" &&
        (field.options?.length ?? 0) > 0 &&
        !["brand", "model", "year", "condition"].includes(field.key),
    );
  }, [subcategory?.fieldSchema]);

  const yearOptions = useMemo(() => {
    const newest = new Date().getFullYear();
    return Array.from({ length: newest - 1990 + 1 }, (_, index) => {
      const value = String(newest - index);
      return { id: value, name: value };
    });
  }, []);

  const schemaKeys = useMemo(
    () => new Set((subcategory?.fieldSchema ?? []).map((field) => field.key)),
    [subcategory?.fieldSchema],
  );
  const hasSchema = !!subcategory?.fieldSchema;
  // Only a subcategory knows whether it has these attributes; the
  // category-level screen matches the reference and hides them.
  const showYear = !isProfile && hasSchema && schemaKeys.has("year");
  const showCondition = !isProfile && hasSchema && schemaKeys.has("condition");

  const sortLabel =
    SORT_OPTIONS.find((option) => option.id === (sort || "newest"))?.name ??
    "Latest Ads";
  const dateLabel =
    DATE_OPTIONS.find((option) => option.id === postedWithin)?.name ?? "";
  const provinceLabel =
    provinces.find((province) => province.slug === provinceSlug)?.name ??
    provinceSlug;
  const districtLabel =
    districts.find((district) => district.slug === districtSlug)?.name ??
    districtSlug;
  const communeLabel =
    communes.find((commune) => commune.slug === communeSlug)?.name ??
    communeSlug;

  const clearProvince = () => {
    setProvinceSlug("");
    setDistrictSlug("");
    setCommuneSlug("");
  };

  const clearDistrict = () => {
    setDistrictSlug("");
    setCommuneSlug("");
  };

  const handleApply = () => {
    const filterParams: Record<string, string> = {};
    if (sort) filterParams.sort = sort;
    if (postedWithin) filterParams.postedWithin = postedWithin;
    if (provinceSlug) filterParams.provinceSlug = provinceSlug;
    if (districtSlug) filterParams.districtSlug = districtSlug;
    if (communeSlug) filterParams.communeSlug = communeSlug;
    if (minPrice) filterParams.minPrice = minPrice.trim();
    if (maxPrice) filterParams.maxPrice = maxPrice.trim();
    if (keyword) filterParams.q = keyword;

    if (isProfile) {
      // Same hand-back as the browse screens: the profile reads these params
      // and rebuilds its feed query from them.
      if (username) {
        router.replace({
          pathname: "/user/[id]",
          params: { id: username, ...filterParams },
        } as never);
      } else {
        router.back();
      }
      return;
    }

    if (yearMin) filterParams.yearMin = yearMin.trim();
    if (yearMax) filterParams.yearMax = yearMax.trim();
    if (view) filterParams.view = view;
    if (condition) filterParams.condition = condition;
    if (brand) filterParams.brand = brand;

    const attrEntries = Object.entries(attrs).filter(
      ([, value]) => value.trim() !== "",
    );
    if (attrEntries.length > 0) {
      filterParams.attrs = JSON.stringify(Object.fromEntries(attrEntries));
    }

    router.replace({
      pathname: subCategoryId
        ? `/(categories)/${categoryId}/${subCategoryId}`
        : `/(categories)/${categoryId}`,
      params: filterParams,
    } as never);
  };

  return (
    <SafeAreaView statusBarColor="#0EA5E9" statusBarStyle="light-content">
      <View className="flex-row items-center bg-[#0EA5E9] px-4 py-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-9 w-9 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={26} color="white" />
        </TouchableOpacity>
        <Text className="ml-1 flex-1 text-xl font-semibold text-white">
          Filters
        </Text>
        <TouchableOpacity
          onPress={handleApply}
          className="px-1 py-1"
          accessibilityRole="button"
          accessibilityLabel="Apply filters"
        >
          <Text className="text-lg font-medium text-white">Apply</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <ScrollView
          className="flex-1 bg-neutral-background px-3 pt-3"
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <FilterCard
            label="Sort"
            value={sortLabel}
            onPress={() => setSheet("sort")}
          />

          <FilterCard
            label="Date"
            placeholder="Date"
            value={dateLabel}
            onPress={() => setSheet("date")}
          />

          <FilterCard
            label="Location"
            placeholder="Location"
            value={communeLabel || districtLabel || provinceLabel}
            onPress={() => setSheet("province")}
          />

          <Text className="mb-2 mt-1 text-base font-semibold text-gray-900">
            {isJobs ? "Salary" : "Price"}
          </Text>
          <View className="mb-3 flex-row gap-3">
            <TextInput
              placeholder="Min"
              placeholderTextColor="#6B7280"
              value={minPrice}
              onChangeText={setMinPrice}
              keyboardType="numeric"
              className="flex-1 rounded-lg bg-white px-4 py-3 text-base text-gray-900"
            />
            <TextInput
              placeholder="Max"
              placeholderTextColor="#6B7280"
              value={maxPrice}
              onChangeText={setMaxPrice}
              keyboardType="numeric"
              className="flex-1 rounded-lg bg-white px-4 py-3 text-base text-gray-900"
            />
          </View>

          {showYear ? (
            <>
              <Text className="mb-2 mt-1 text-base font-semibold text-gray-900">
                Year
              </Text>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <FilterCard
                    label="Min"
                    placeholder="Min"
                    value={yearMin}
                    onPress={() => setSheet("year-min")}
                  />
                </View>
                <View className="flex-1">
                  <FilterCard
                    label="Max"
                    placeholder="Max"
                    value={yearMax}
                    onPress={() => setSheet("year-max")}
                  />
                </View>
              </View>
            </>
          ) : null}

          {!isProfile && schemaKeys.has("discount") ? (
            <ToggleRow
              label="Discount"
              value={attrs.discount === "true"}
              onChange={(next) =>
                setAttrs((prev) =>
                  withAttr(prev, "discount", next ? "true" : ""),
                )
              }
            />
          ) : null}

          {!isProfile && schemaKeys.has("deliveryFree") ? (
            <ToggleRow
              label="Free Delivery"
              value={attrs.deliveryFree === "true"}
              onChange={(next) =>
                setAttrs((prev) =>
                  withAttr(prev, "deliveryFree", next ? "true" : ""),
                )
              }
            />
          ) : null}

          {showCondition ? (
            <SegmentedRow
              label="Condition"
              value={condition}
              options={[
                { id: "", label: "Any" },
                { id: "used", label: "Used" },
                { id: "new", label: "New" },
              ]}
              onChange={setCondition}
            />
          ) : null}

          {!isProfile && brands.length > 0 ? (
            <FilterCard
              label="Brand"
              placeholder="Brand"
              value={brand}
              onPress={() => setSheet("brand")}
            />
          ) : null}

          {!isProfile && brand ? (
            <FilterCard
              label="Model"
              placeholder="Model"
              value={attrs.model ?? ""}
              onPress={() => setSheet("model")}
            />
          ) : null}

          {selectFields.map((field) => {
            const label =
              field.label?.en || FIELD_LABELS[field.key] || field.key;
            const options = field.options ?? [];
            if (options.length > 0 && options.length <= 3) {
              return (
                <SegmentedRow
                  key={field.key}
                  label={label}
                  value={attrs[field.key] ?? ""}
                  options={[
                    { id: "", label: "Any" },
                    ...options.map((option) => ({ id: option, label: option })),
                  ]}
                  onChange={(next) =>
                    setAttrs((prev) => withAttr(prev, field.key, next))
                  }
                />
              );
            }
            return (
              <FilterCard
                key={field.key}
                label={label}
                placeholder={label}
                value={attrs[field.key] ?? ""}
                onPress={() => setSheet(`attr:${field.key}`)}
              />
            );
          })}

          <View className="mb-3 flex-row items-center justify-between rounded-lg bg-white px-4 py-3">
            <Text className="text-base text-gray-900">View</Text>
            <View className="flex-row gap-4">
              <TouchableOpacity
                onPress={() => setView("")}
                accessibilityRole="button"
                accessibilityLabel="List view"
                accessibilityState={{ selected: view !== "grid" }}
              >
                <Ionicons
                  name="list"
                  size={22}
                  color={view !== "grid" ? "#0EA5E9" : "#9CA3AF"}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setView("grid")}
                accessibilityRole="button"
                accessibilityLabel="Grid view"
                accessibilityState={{ selected: view === "grid" }}
              >
                <Ionicons
                  name="grid-outline"
                  size={22}
                  color={view === "grid" ? "#0EA5E9" : "#9CA3AF"}
                />
              </TouchableOpacity>
            </View>
          </View>

          {subQuery.isLoading ? <ActivityIndicator className="my-4" /> : null}
        </ScrollView>

        <View
          className="border-t border-gray-200 bg-white px-3 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <TouchableOpacity
            onPress={handleApply}
            className="items-center justify-center rounded-lg bg-secondary-orange py-3.5"
            accessibilityRole="button"
            accessibilityLabel="Apply filters"
          >
            <Text className="text-base font-semibold text-white">Apply</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <SelectionSheet
        visible={sheet === "sort"}
        title="Sort"
        options={SORT_OPTIONS}
        value={sort || "newest"}
        searchable={false}
        compact
        indicator="radio"
        onSelect={(option) => {
          setSort(option.id === "newest" ? "" : option.id);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />

      <SelectionSheet
        visible={sheet === "date"}
        title="Date"
        options={DATE_OPTIONS}
        value={postedWithin}
        searchable={false}
        compact
        onSelect={(option) => {
          setPostedWithin(option.id);
          setSheet(null);
        }}
        onClear={
          postedWithin
            ? () => {
                setPostedWithin("");
                setSheet(null);
              }
            : undefined
        }
        onClose={() => setSheet(null)}
      />

      <SelectionSheet
        visible={sheet === "year-min"}
        title="Min year"
        options={yearOptions}
        value={yearMin}
        searchable
        onSelect={(option) => {
          setYearMin(option.id);
          setSheet(null);
        }}
        onClear={
          yearMin
            ? () => {
                setYearMin("");
                setSheet(null);
              }
            : undefined
        }
        onClose={() => setSheet(null)}
      />

      <SelectionSheet
        visible={sheet === "year-max"}
        title="Max year"
        options={yearOptions}
        value={yearMax}
        searchable
        onSelect={(option) => {
          setYearMax(option.id);
          setSheet(null);
        }}
        onClear={
          yearMax
            ? () => {
                setYearMax("");
                setSheet(null);
              }
            : undefined
        }
        onClose={() => setSheet(null)}
      />

      <SelectionSheet
        visible={sheet === "province"}
        title="City/Province"
        options={provinces.map((province) => ({
          id: province.slug,
          name: province.name,
        }))}
        value={provinceSlug}
        loading={provincesQuery.isLoading}
        emptyLabel="No locations"
        onSelect={(option) => {
          setProvinceSlug(option.id);
          setDistrictSlug("");
          setCommuneSlug("");
          setSheet("district");
        }}
        onClear={
          provinceSlug
            ? () => {
                clearProvince();
                setSheet(null);
              }
            : undefined
        }
        onClose={() => setSheet(null)}
      />

      <SelectionSheet
        visible={sheet === "district"}
        title="Khan/District"
        options={districts.map((district) => ({
          id: district.slug,
          name: district.name,
        }))}
        value={districtSlug}
        loading={districtsQuery.isLoading}
        emptyLabel="No districts"
        onSelect={(option) => {
          setDistrictSlug(option.id);
          setCommuneSlug("");
          setSheet("commune");
        }}
        onBack={() => setSheet("province")}
        onClear={
          districtSlug
            ? () => {
                clearDistrict();
                setSheet(null);
              }
            : undefined
        }
        onClose={() => setSheet(null)}
      />

      <SelectionSheet
        visible={sheet === "commune"}
        title="Sangkat/Commune"
        options={communes.map((commune) => ({
          id: commune.slug,
          name: commune.name,
        }))}
        value={communeSlug}
        loading={communesQuery.isLoading}
        emptyLabel="No communes"
        searchable={false}
        onSelect={(option) => {
          setCommuneSlug(option.id);
          setSheet(null);
        }}
        onClear={
          communeSlug
            ? () => {
                setCommuneSlug("");
                setSheet(null);
              }
            : undefined
        }
        onClose={() => setSheet(null)}
      />

      <SelectionSheet
        visible={sheet === "condition"}
        title="Condition"
        options={CONDITION_OPTIONS}
        value={condition}
        searchable={false}
        compact
        onSelect={(option) => {
          setCondition(option.id);
          setSheet(null);
        }}
        onClear={
          condition
            ? () => {
                setCondition("");
                setSheet(null);
              }
            : undefined
        }
        onClose={() => setSheet(null)}
      />

      <SelectionSheet
        visible={sheet === "model"}
        title="Model"
        options={models.map((model) => ({ id: model.name, name: model.name }))}
        value={attrs.model ?? ""}
        loading={modelsQuery.isLoading}
        emptyLabel="No models"
        onSelect={(option) => {
          setAttrs((prev) => withAttr(prev, "model", option.name));
          setSheet(null);
        }}
        onClear={
          attrs.model
            ? () => {
                setAttrs((prev) => withAttr(prev, "model", ""));
                setSheet(null);
              }
            : undefined
        }
        onClose={() => setSheet(null)}
      />

      <SelectionSheet
        visible={sheet === "brand"}
        title="Brand"
        options={brands.map((entry) => ({
          id: entry.name,
          name: entry.name,
        }))}
        value={brand}
        loading={brandsQuery.isLoading}
        emptyLabel="No brands"
        onSelect={(option) => {
          setBrand(option.id);
          setSheet(null);
        }}
        onClear={
          brand
            ? () => {
                setBrand("");
                setSheet(null);
              }
            : undefined
        }
        onClose={() => setSheet(null)}
      />

      {selectFields.map((field) => {
        const label = field.label?.en || FIELD_LABELS[field.key] || field.key;
        return (
          <SelectionSheet
            key={field.key}
            visible={sheet === `attr:${field.key}`}
            title={label}
            options={(field.options ?? []).map((option) => ({
              id: option,
              name: option,
            }))}
            value={attrs[field.key] ?? ""}
            onSelect={(option) => {
              setAttrs((prev) => ({ ...prev, [field.key]: option.id }));
              setSheet(null);
            }}
            onClear={
              attrs[field.key]
                ? () => {
                    setAttrs((prev) => {
                      const next = { ...prev };
                      delete next[field.key];
                      return next;
                    });
                    setSheet(null);
                  }
                : undefined
            }
            onClose={() => setSheet(null)}
          />
        );
      })}
    </SafeAreaView>
  );
}
