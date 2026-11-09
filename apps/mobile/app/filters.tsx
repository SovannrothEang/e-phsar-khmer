import SafeAreaView from "@/components/common/SafeAreaView";
import SelectionSheet, {
  type SheetOption,
} from "@/components/common/SelectionSheet";
import {
  fetchBrands,
  fetchModels,
  fetchCommunes,
  fetchDistricts,
  fetchLinkedAttributes,
  fetchProvinces,
  fetchCategory,
  fetchSubcategory,
  type AttributeSummary,
} from "@/lib/api/catalog";
import {
  normalizePriceRange,
  normalizeSizeRange,
  normalizeYearRange,
  parseAttrsInput,
} from "@/lib/feed-params";
import { filterReturnHref, type FilterScope } from "@/lib/filter-route";
import {
  SORT_OPTIONS,
  NO_PRICE_CATEGORIES,
  TYPE_IN_FILTERS_ONLY_SUBCATEGORIES,
  type FilterOption,
} from "@/lib/filter-options";
import { SET_FOR_KEY } from "@/lib/sell";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
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

/** Small fixed option sets use the reference's compact, searchless sheet. */
const COMPACT_ATTR_SHEETS = new Set([
  "screenSize",
  "storage",
  "vga",
  "bedroom",
  "bathroom",
  "facing",
]);

/** Categories whose Type row is short enough to skip the search field. */
const COMPACT_TYPE_CATEGORIES = new Set([
  "home-and-land",
  "fashion-and-beauty",
]);

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
  onClear,
}: {
  label: string;
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  onPress: () => void;
  /** Filled rows show a clear ✕ instead of the caret. */
  onClear?: () => void;
}) => {
  return (
    <View
      className={`mb-3 flex-row items-center justify-between rounded-[4px] px-4 ${
        disabled ? "bg-gray-200" : "bg-white"
      }`}
      style={{ minHeight: 44 }}
    >
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.7}
        className="flex-1 py-1 pr-3"
      >
        {value ? (
          <Text className="text-[11px] text-gray-400">{label}</Text>
        ) : null}
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
      </TouchableOpacity>
      {value && onClear ? (
        <TouchableOpacity
          onPress={onClear}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Clear ${label}`}
        >
          <Ionicons name="close" size={18} color="#6B7280" />
        </TouchableOpacity>
      ) : (
        <Ionicons
          name="chevron-down"
          size={18}
          color={disabled ? "#C0C4CC" : "#9CA3AF"}
        />
      )}
    </View>
  );
};

/** Price input with the reference's floating label, at button height. */
const RangeField = ({
  label,
  value,
  onChangeText,
  prefix = "$",
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  /** Empty for unitless fields such as Size. */
  prefix?: string;
}) => (
  <View className="mb-3 h-[44px] flex-1 justify-center rounded-[4px] bg-white px-4">
    {value ? <Text className="text-[11px] text-gray-500">{label}</Text> : null}
    <View className="flex-row items-center">
      {value && prefix ? (
        <Text className="text-base text-gray-900">{prefix}</Text>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor="#6B7280"
        keyboardType="numeric"
        className="flex-1 p-0 text-base text-gray-900"
        style={{ paddingVertical: 0 }}
      />
    </View>
  </View>
);

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
  <View
    className="mb-3 flex-row items-center justify-between rounded-[4px] bg-white px-4"
    style={{ minHeight: 44 }}
  >
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

/** URL flags use web's `1`; `true` is accepted defensively. */
function isFlag(value: string): boolean {
  return value === "1" || value.toLowerCase() === "true";
}

export default function FiltersScreen() {
  const params = useLocalSearchParams();
  const categoryId = firstParam(params.categoryId);
  const subCategoryId = firstParam(params.subCategoryId);
  // The public profile opens this screen for one seller's ads: only the
  // generic rows apply there (sort, date, location, price), never a
  // category's brands or spec attributes.
  const userId = firstParam(params.userId);
  // The profile's keyword is not shown here, but it must survive Apply.
  const keyword = firstParam(params.q);
  const isProfile = !!userId;
  const isJobs = !isProfile && categoryId === "jobs";
  // Services listings have no price at all, so the row and its params are out.
  const isPriceless = !isProfile && NO_PRICE_CATEGORIES.has(categoryId);
  const returnTo = firstParam(params.returnTo);
  const scope: FilterScope = {
    categoryId: firstParam(params.categoryId) || undefined,
    subCategoryId: firstParam(params.subCategoryId) || undefined,
    brandId: firstParam(params.brandId) || undefined,
    typeId: firstParam(params.typeId) || undefined,
    brand: firstParam(params.brand) || undefined,
    attrKey: firstParam(params.attrKey) || undefined,
    attrValue: firstParam(params.attrValue) || undefined,
    brandScope: firstParam(params.brandScope) || undefined,
    userId: firstParam(params.userId) || undefined,
    username: firstParam(params.username) || undefined,
  };
  // A brand reached through the path is drill-down scope, not an editable
  // filter — the same split web makes between ad_field and filter params.
  const brandLocked =
    returnTo === "brand" ||
    returnTo === "brandType" ||
    returnTo === "typeBrand" ||
    (returnTo === "type" && scope.brandScope === "1") ||
    (!returnTo && !!scope.brandId);
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
  const [sizeMin, setSizeMin] = useState(firstParam(params.sizeMin));
  const [sizeMax, setSizeMax] = useState(firstParam(params.sizeMax));
  const [yearMin, setYearMin] = useState(firstParam(params.yearMin));
  const [yearMax, setYearMax] = useState(firstParam(params.yearMax));
  const [view, setView] = useState(firstParam(params.view));
  const [discount, setDiscount] = useState(isFlag(firstParam(params.discount)));
  const [deliveryFree, setDeliveryFree] = useState(
    isFlag(firstParam(params.delivery)),
  );
  const [condition, setCondition] = useState(firstParam(params.condition));
  const [brand, setBrand] = useState(firstParam(params.brand));
  // Jobs only: the Category row switches the job subcategory.
  const [jobCategory, setJobCategory] = useState(
    firstParam(params.subCategoryId),
  );
  const [attrs, setAttrs] = useState<Record<string, string>>(() => {
    const initial = parseAttrsInput(firstParam(params.attrs));
    // A type tile (body type, network, …) lives in the route, not in attrs;
    // seed it so the filter row shows the current selection and can clear it.
    const scopeKey = firstParam(params.attrKey);
    const scopeValue = firstParam(params.attrValue);
    if (scopeKey && scopeValue && initial[scopeKey] === undefined) {
      initial[scopeKey] = scopeValue;
    }
    return initial;
  });
  // Which picker sheet is open. Attribute rows use `attr:<field key>`.
  const [sheet, setSheet] = useState<string | null>(null);

  const subQuery = useQuery({
    queryKey: ["subcategory", categoryId, subCategoryId],
    queryFn: () => fetchSubcategory(categoryId, subCategoryId),
    enabled: !!categoryId && !!subCategoryId,
  });
  const subcategory = subQuery.data;
  // Cached from the browse screen's own request; a category-level screen
  // borrows its subcategories to learn what the category supports.
  const categoryQuery = useQuery({
    queryKey: ["category", categoryId],
    queryFn: () => fetchCategory(categoryId),
    enabled: !!categoryId,
  });
  const jobCategories = isJobs ? (categoryQuery.data?.subcategories ?? []) : [];
  const jobCategoryName =
    jobCategories.find((entry) => entry.slug === jobCategory)?.name ??
    jobCategory;
  // The Jobs category page has no subcategory schema of its own; borrow the
  // first job subcategory so Job Type and Experience stay filterable there.
  const defaultJobSubcategory =
    isJobs && !subCategoryId ? jobCategories[0]?.slug : undefined;
  const jobSchemaQuery = useQuery({
    queryKey: ["subcategory", "jobs", defaultJobSubcategory],
    queryFn: () => fetchSubcategory("jobs", defaultJobSubcategory!),
    enabled: !!defaultJobSubcategory,
  });
  const activeSubcategory = subcategory ?? jobSchemaQuery.data;
  const linkedQuery = useQuery({
    queryKey: ["linked-attributes", activeSubcategory?.id],
    queryFn: () => fetchLinkedAttributes(activeSubcategory!.id),
    enabled: !!activeSubcategory?.id,
  });

  const brandsQuery = useQuery({
    queryKey: ["brands", subCategoryId],
    queryFn: () => fetchBrands(subCategoryId),
    enabled: !!subCategoryId,
  });
  const brands = brandsQuery.data ?? [];
  // A brand path is scope even before its display name reaches this screen.
  const scopeBrandId = brandLocked ? scope.brandId : undefined;
  const scopeBrandName =
    brands.find((entry) => entry.id === scopeBrandId)?.name ?? "";

  const brandId =
    brands.find((entry) => entry.name === brand)?.id ?? scopeBrandId;
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

  const linkedGroups = useMemo(() => {
    const groups: Record<string, AttributeSummary[]> = {};
    for (const row of linkedQuery.data ?? []) {
      (groups[row.type] ??= []).push(row);
    }
    return groups;
  }, [linkedQuery.data]);

  /** Managed sets first, like the post form; inline schema is the fallback. */
  const optionsFor = useCallback(
    (field: { key: string; options?: string[] | null }): SheetOption[] => {
      const set = SET_FOR_KEY[field.key];
      const rows = set ? linkedGroups[set] : undefined;
      if (rows?.length) {
        return rows.map((row) => ({
          id: row.name,
          name: row.name,
          image: row.image,
        }));
      }
      return (field.options ?? []).map((option) => ({
        id: option,
        name: option,
      }));
    },
    [linkedGroups],
  );

  const selectFields = useMemo(() => {
    const fields = activeSubcategory?.fieldSchema ?? [];
    return fields.filter(
      (field) =>
        ((field.key === "size" && field.type === "number") ||
          (field.type === "select" && optionsFor(field).length > 0)) &&
        !["brand", "model", "year", "condition"].includes(field.key),
    );
  }, [activeSubcategory?.fieldSchema, optionsFor]);

  const yearOptions = useMemo(() => {
    const newest = new Date().getFullYear();
    return Array.from({ length: newest - 1990 + 1 }, (_, index) => {
      const value = String(newest - index);
      return { id: value, name: value };
    });
  }, []);

  const schemaKeys = useMemo(
    () =>
      new Set((activeSubcategory?.fieldSchema ?? []).map((field) => field.key)),
    [activeSubcategory?.fieldSchema],
  );
  /** What a category's own subcategories can carry (no subcategory screen). */
  const categorySchemaKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const entry of categoryQuery.data?.subcategories ?? []) {
      for (const field of entry.fieldSchema ?? []) keys.add(field.key);
    }
    return keys;
  }, [categoryQuery.data]);
  const hasSchema = !!activeSubcategory?.fieldSchema;
  /** Laptops and several other categories carry a brand but no model. */
  const supportsModel = schemaKeys.has("model");
  // Only a subcategory knows whether it has these attributes; the
  // category-level screen matches the reference and hides them.
  const showYear = !isProfile && hasSchema && schemaKeys.has("year");
  const showCondition = !isProfile && hasSchema && schemaKeys.has("condition");
  // Follow the subcategory schema: Home & Land declares neither field, while
  // phones/cars/fashion do. A category-level screen has no schema of its own,
  // so it borrows the union of its subcategories — Home & Land and Services
  // hide both there, phones and Fashion & Beauty show them.
  const supportsToggle = (key: string) =>
    schemaKeys.has(key) || (!activeSubcategory && categorySchemaKeys.has(key));
  const showDiscount = !isProfile && supportsToggle("discount");
  const showDeliveryFree = !isProfile && supportsToggle("deliveryFree");

  const sortLabel =
    SORT_OPTIONS.find((option) => option.id === (sort || "newest"))?.name ??
    "Latest Ads";
  const dateLabel =
    DATE_OPTIONS.find((option) => option.id === postedWithin)?.name ?? "";
  const provinceLabel = provinceSlug
    ? (provinces.find((province) => province.slug === provinceSlug)?.name ??
      provinceSlug)
    : "";
  const districtLabel = districtSlug
    ? (districts.find((district) => district.slug === districtSlug)?.name ??
      districtSlug)
    : "";
  const communeLabel = communeSlug
    ? (communes.find((commune) => commune.slug === communeSlug)?.name ??
      communeSlug)
    : "";

  /** Deepest level last, like the reference: "Sangkat, Khan, Province". */
  const locationLabel = [communeLabel, districtLabel, provinceLabel]
    .filter(Boolean)
    .join(", ");

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
    const categoryChanged = isJobs && jobCategory !== subCategoryId;
    // Jobs: the Category row picks the job subcategory, and a chosen Job Type
    // becomes the route's type scope — the same page a Job Type tile opens —
    // so the title and the badge name it. Without a managed row there is no
    // slug to route with, so the value stays a plain attrs filter.
    const jobSubcategory = isJobs ? jobCategory || subCategoryId : "";
    const jobTypeRow =
      jobSubcategory && attrs.jobType
        ? linkedGroups.jobtypes?.find((row) => row.name === attrs.jobType)
        : undefined;
    if (sort) filterParams.sort = sort;
    if (postedWithin) filterParams.postedWithin = postedWithin;
    if (provinceSlug) filterParams.provinceSlug = provinceSlug;
    if (districtSlug) filterParams.districtSlug = districtSlug;
    if (communeSlug) filterParams.communeSlug = communeSlug;
    const price = normalizePriceRange(minPrice, maxPrice);
    if (!isPriceless) {
      if (price.min) filterParams.minPrice = price.min;
      if (price.max) filterParams.maxPrice = price.max;
    }
    const size = normalizeSizeRange(sizeMin, sizeMax);
    if (size.min) filterParams.sizeMin = size.min;
    if (size.max) filterParams.sizeMax = size.max;
    if ((isProfile || returnTo === "searchPosts") && keyword) {
      filterParams.q = keyword;
    }

    if (!isProfile) {
      const years = normalizeYearRange(yearMin, yearMax);
      if (years.min) filterParams.yearMin = years.min;
      if (years.max) filterParams.yearMax = years.max;
      if (condition) filterParams.condition = condition;
      if (brand) filterParams.brand = brand;
      if (discount) filterParams.discount = "1";
      if (deliveryFree) filterParams.delivery = "1";
      if (view) filterParams.view = view;

      const attrEntries = Object.entries(attrs).filter(
        ([key, value]) =>
          value.trim() !== "" &&
          (key !== scope.attrKey || categoryChanged) &&
          // A routed Job Type lives in attrKey/attrValue, not in attrs.
          !(jobTypeRow && key === "jobType") &&
          (key !== "model" || (supportsModel && (!!brand || !!scopeBrandId))),
      );
      if (attrEntries.length > 0) {
        filterParams.attrs = JSON.stringify(Object.fromEntries(attrEntries));
      }
    }

    // A changed type tile updates the route's attrValue; clearing it drops
    // the type scope and returns to the plain subcategory.
    const scopeAttrValue = scope.attrKey ? attrs[scope.attrKey] : undefined;
    const clearedScopeAttr = !!scope.attrKey && !scopeAttrValue;
    let targetScope = clearedScopeAttr
      ? {
          ...scope,
          typeId: undefined,
          attrKey: undefined,
          attrValue: undefined,
        }
      : scope.attrKey
        ? { ...scope, attrValue: scopeAttrValue ?? scope.attrValue }
        : scope;
    let targetReturnTo = clearedScopeAttr ? "subcategory" : returnTo;

    // Jobs: Category switches the job subcategory; clearing it returns to the
    // whole Jobs category feed. A chosen Job Type becomes the type route.
    if (isJobs) {
      if (jobCategory && categoryChanged) {
        targetReturnTo = "subcategory";
        targetScope = { ...targetScope, subCategoryId: jobCategory };
      } else if (!jobCategory && subCategoryId) {
        targetReturnTo = "category";
        targetScope = {
          ...targetScope,
          subCategoryId: undefined,
          typeId: undefined,
          attrKey: undefined,
          attrValue: undefined,
        };
      }
      if (jobTypeRow) {
        targetReturnTo = "type";
        targetScope = {
          ...targetScope,
          subCategoryId: jobSubcategory,
          typeId: jobTypeRow.slug,
          attrKey: "jobType",
          attrValue: jobTypeRow.name,
        };
      }
    }

    // dismissTo replaces the target's params, so the scope travels with the
    // filters; a deep link with no route context falls back to replace.
    const target = filterReturnHref(targetReturnTo, targetScope, filterParams);
    if (target) {
      router.dismissTo(target);
      return;
    }

    const fallback = filterReturnHref(
      subCategoryId ? "subcategory" : categoryId ? "category" : undefined,
      scope,
      filterParams,
    );
    if (fallback) router.replace(fallback);
    // A cold-start link to /filters has no route to return to; land on the
    // home tab instead of exiting the app.
    else router.replace("/");
  };

  /** True as soon as any filter differs from its default (the Clean button). */
  const hasActiveFilters =
    !!sort ||
    !!postedWithin ||
    !!provinceSlug ||
    !!districtSlug ||
    !!communeSlug ||
    (!isPriceless && minPrice.trim() !== "") ||
    (!isPriceless && maxPrice.trim() !== "") ||
    sizeMin.trim() !== "" ||
    sizeMax.trim() !== "" ||
    yearMin.trim() !== "" ||
    yearMax.trim() !== "" ||
    !!condition ||
    (!brandLocked && !!brand) ||
    discount ||
    deliveryFree ||
    // The Jobs Category row counts as an active filter, like its badge does.
    (isJobs && !!jobCategory) ||
    Object.values(attrs).some((value) => value.trim() !== "");

  /** Resets the form without leaving the screen; Apply commits it. */
  const handleClear = () => {
    setSort("");
    setPostedWithin("");
    setProvinceSlug("");
    setDistrictSlug("");
    setCommuneSlug("");
    setMinPrice("");
    setMaxPrice("");
    setSizeMin("");
    setSizeMax("");
    setYearMin("");
    setYearMax("");
    setCondition("");
    // Clearing the Job Category returns the Jobs feed to all subcategories.
    setJobCategory("");
    if (!brandLocked) setBrand("");
    setDiscount(false);
    setDeliveryFree(false);
    setAttrs({});
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
            onClear={() => setPostedWithin("")}
          />

          <FilterCard
            label="Location"
            placeholder="Location"
            value={locationLabel}
            onPress={() => setSheet("province")}
            onClear={() => {
              setProvinceSlug("");
              setDistrictSlug("");
              setCommuneSlug("");
            }}
          />

          {!isPriceless ? (
            <>
              <Text className="mb-2 mt-1 text-base font-semibold text-gray-900">
                {isJobs ? "Salary" : "Price"}
              </Text>
              <View className="flex-row gap-3">
                <RangeField
                  label="Min"
                  value={minPrice}
                  onChangeText={setMinPrice}
                />
                <RangeField
                  label="Max"
                  value={maxPrice}
                  onChangeText={setMaxPrice}
                />
              </View>
            </>
          ) : null}

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

          {showDiscount ? (
            <ToggleRow
              label="Discount"
              value={discount}
              onChange={setDiscount}
            />
          ) : null}

          {showDeliveryFree ? (
            <ToggleRow
              label="Free Delivery"
              value={deliveryFree}
              onChange={setDeliveryFree}
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
              value={brand || scopeBrandName}
              disabled={brandLocked}
              onPress={() => {
                if (!brandLocked) setSheet("brand");
              }}
              onClear={
                !brandLocked && brand
                  ? () => {
                      setBrand("");
                      setAttrs((prev) => withAttr(prev, "model", ""));
                    }
                  : undefined
              }
            />
          ) : null}

          {!isProfile && brands.length > 0 && supportsModel ? (
            <FilterCard
              label="Model"
              placeholder="Model"
              value={attrs.model ?? ""}
              disabled={!brand && !scopeBrandId}
              onPress={() => {
                if (brand || scopeBrandId) setSheet("model");
              }}
            />
          ) : null}

          {isJobs && jobCategories.length > 0 ? (
            <FilterCard
              label="Category"
              placeholder="Category"
              value={jobCategoryName}
              onPress={() => setSheet("job-category")}
              onClear={jobCategory ? () => setJobCategory("") : undefined}
            />
          ) : null}

          {selectFields.map((field) => {
            const label =
              field.label?.en || FIELD_LABELS[field.key] || field.key;
            if (field.key === "size" && field.type === "number") {
              return (
                <View key="size">
                  <Text className="mb-2 mt-1 text-base font-semibold text-gray-900">
                    Size
                  </Text>
                  <View className="flex-row gap-3">
                    <RangeField
                      label="Min"
                      value={sizeMin}
                      onChangeText={setSizeMin}
                      prefix=""
                    />
                    <RangeField
                      label="Max"
                      value={sizeMax}
                      onChangeText={setSizeMax}
                      prefix=""
                    />
                  </View>
                </View>
              );
            }
            const options = optionsFor(field);
            if (options.length > 0 && options.length <= 3) {
              return (
                <SegmentedRow
                  key={field.key}
                  label={label}
                  value={attrs[field.key] ?? ""}
                  options={[
                    { id: "", label: "Any" },
                    ...options.map((option) => ({
                      id: option.id,
                      label: option.name,
                    })),
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

          {!isProfile ? (
            <View
              className="mb-3 flex-row items-center justify-between rounded-[4px] bg-white px-4"
              style={{ minHeight: 44 }}
            >
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
          ) : null}

          {subQuery.isLoading || jobSchemaQuery.isLoading ? (
            <ActivityIndicator className="my-4" />
          ) : null}
        </ScrollView>

        <View
          className="border-t border-gray-200 bg-white px-3 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 40) }}
        >
          {hasActiveFilters ? (
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={handleClear}
                className="h-[44px] flex-1 items-center justify-center rounded-[4px] bg-gray-200"
                accessibilityRole="button"
                accessibilityLabel="Clear filters"
              >
                <Text className="text-base font-semibold text-gray-700">
                  Clear
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleApply}
                className="h-[44px] flex-[2] items-center justify-center rounded-[4px] bg-secondary-orange"
                accessibilityRole="button"
                accessibilityLabel="Apply filters"
              >
                <Text className="text-base font-semibold text-white">
                  Apply
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleApply}
              className="h-[44px] items-center justify-center rounded-[4px] bg-secondary-orange"
              accessibilityRole="button"
              accessibilityLabel="Apply filters"
            >
              <Text className="text-base font-semibold text-white">Apply</Text>
            </TouchableOpacity>
          )}
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
          image: entry.icon,
        }))}
        value={brand}
        loading={brandsQuery.isLoading}
        emptyLabel="No brands"
        onSelect={(option) => {
          setBrand(option.id);
          setAttrs((prev) => withAttr(prev, "model", ""));
          setSheet(null);
        }}
        onClear={
          brand
            ? () => {
                setBrand("");
                setAttrs((prev) => withAttr(prev, "model", ""));
                setSheet(null);
              }
            : undefined
        }
        onClose={() => setSheet(null)}
      />

      {isJobs ? (
        <SelectionSheet
          visible={sheet === "job-category"}
          title="Category"
          options={jobCategories.map((entry) => ({
            id: entry.slug,
            name: entry.name,
          }))}
          value={jobCategory}
          loading={categoryQuery.isLoading}
          emptyLabel="No categories"
          onSelect={(option) => {
            setJobCategory(option.id);
            setSheet(null);
          }}
          onClear={
            jobCategory
              ? () => {
                  setJobCategory("");
                  setSheet(null);
                }
              : undefined
          }
          onClose={() => setSheet(null)}
        />
      ) : null}

      {selectFields.map((field) => {
        const label = field.label?.en || FIELD_LABELS[field.key] || field.key;
        const compactAttr =
          COMPACT_ATTR_SHEETS.has(field.key) ||
          // Short Type lists (House & Land, Fashion & Beauty) skip the search,
          // as do the furniture children whose Type has no tile row at all.
          (field.key === "type" &&
            (COMPACT_TYPE_CATEGORIES.has(categoryId) ||
              TYPE_IN_FILTERS_ONLY_SUBCATEGORIES.has(subCategoryId)));
        // Furniture's Type rows carry no artwork: text-only sheet rows.
        const iconlessType =
          field.key === "type" &&
          TYPE_IN_FILTERS_ONLY_SUBCATEGORIES.has(subCategoryId);
        return (
          <SelectionSheet
            key={field.key}
            visible={sheet === `attr:${field.key}`}
            title={label}
            options={optionsFor(field)}
            searchable={!compactAttr}
            compact={compactAttr}
            showIcons={!iconlessType}
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
