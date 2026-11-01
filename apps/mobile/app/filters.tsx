import SafeAreaView from "@/components/common/SafeAreaView";
import {
  fetchBrands,
  fetchCommunes,
  fetchDistricts,
  fetchProvinces,
  fetchSubcategory,
} from "@/lib/api/catalog";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface DropdownOption {
  id: string;
  name: string;
}

const SORT_OPTIONS: DropdownOption[] = [
  { id: "newest", name: "Newest" },
  { id: "price_asc", name: "Price: Low to High" },
  { id: "price_desc", name: "Price: High to Low" },
];

const DATE_OPTIONS: DropdownOption[] = [
  { id: "today", name: "Today" },
  { id: "week", name: "This Week" },
  { id: "month", name: "This Month" },
];

const CONDITION_OPTIONS: DropdownOption[] = [
  { id: "new", name: "New" },
  { id: "used", name: "Used" },
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

const SimpleDropdown = ({
  label,
  value,
  placeholder,
  options,
  onSelect,
  disabled = false,
}: {
  label?: string;
  value?: string;
  placeholder: string;
  options: DropdownOption[];
  onSelect: (option: DropdownOption) => void;
  disabled?: boolean;
}) => {
  const [visible, setVisible] = useState(false);
  const selected = options.find((option) => option.id === value);

  return (
    <>
      <TouchableOpacity
        onPress={() => !disabled && setVisible(true)}
        disabled={disabled}
        className={`flex-row items-center justify-between rounded-lg border border-gray-200 px-4 py-3 ${
          disabled ? "bg-gray-100" : "bg-white"
        }`}
      >
        <View>
          {label && <Text className="text-xs text-gray-400">{label}</Text>}
          <Text
            className={`text-base ${selected ? "text-gray-900" : "text-gray-400"}`}
          >
            {selected?.name || placeholder}
          </Text>
        </View>
        <Ionicons
          name="chevron-down"
          size={20}
          color={disabled ? "#D1D5DB" : "#6B7280"}
        />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setVisible(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/50"
          onPress={() => setVisible(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="max-h-[60%] w-full rounded-t-3xl bg-white pb-8"
          >
            <View className="items-center py-4">
              <View className="h-1.5 w-12 rounded-full bg-gray-300" />
            </View>
            <Text className="border-b border-gray-100 px-4 pb-4 text-center text-lg font-bold text-gray-900">
              {placeholder}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {options.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  onPress={() => {
                    onSelect(option);
                    setVisible(false);
                  }}
                  activeOpacity={0.7}
                  className="flex-row items-center justify-between border-b border-gray-100 px-4 py-4"
                >
                  <Text
                    className={`text-base ${value === option.id ? "font-bold text-blue-500" : "text-gray-900"}`}
                  >
                    {option.name}
                  </Text>
                  {value === option.id && (
                    <Ionicons name="checkmark" size={20} color="#3b82f6" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

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
  const isJobs = categoryId === "jobs";

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
  const [year, setYear] = useState(firstParam(params.yearMin));
  const [condition, setCondition] = useState(firstParam(params.condition));
  const [brand, setBrand] = useState(firstParam(params.brand));
  const [attrs, setAttrs] = useState<Record<string, string>>(() =>
    parseAttrs(firstParam(params.attrs)),
  );

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

  const schemaKeys = useMemo(
    () => new Set((subcategory?.fieldSchema ?? []).map((field) => field.key)),
    [subcategory?.fieldSchema],
  );
  const hasSchema = !!subcategory?.fieldSchema;
  const showYear = !hasSchema || schemaKeys.has("year");
  const showCondition = !hasSchema || schemaKeys.has("condition");

  const handleProvinceSelect = (option: DropdownOption) => {
    setProvinceSlug(option.id);
    setDistrictSlug("");
    setCommuneSlug("");
  };

  const handleDistrictSelect = (option: DropdownOption) => {
    setDistrictSlug(option.id);
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
    if (year) {
      filterParams.yearMin = year.trim();
      filterParams.yearMax = year.trim();
    }
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

  const handleClear = () => {
    setSort("");
    setPostedWithin("");
    setProvinceSlug("");
    setDistrictSlug("");
    setCommuneSlug("");
    setMinPrice("");
    setMaxPrice("");
    setYear("");
    setCondition("");
    setBrand("");
    setAttrs({});
  };

  return (
    <SafeAreaView statusBarColor="#0EA5E9" statusBarStyle="light-content">
      <View className="flex-row items-center justify-between bg-[#0EA5E9] px-4 py-4">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-white">Filters</Text>
        <TouchableOpacity onPress={handleClear}>
          <Text className="text-base font-medium text-white">Clear All</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-1">
        <ScrollView
          className="flex-1 px-4 pt-4"
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-4">
            <SimpleDropdown
              label="Sort"
              value={sort}
              placeholder="Sort"
              options={SORT_OPTIONS}
              onSelect={(option) => setSort(option.id)}
            />
          </View>

          <View className="mb-4">
            <SimpleDropdown
              label="Date Range"
              value={postedWithin}
              placeholder="Any Time"
              options={DATE_OPTIONS}
              onSelect={(option) => setPostedWithin(option.id)}
            />
          </View>

          <View className="mb-4">
            <SimpleDropdown
              label="Province"
              value={provinceSlug}
              placeholder="Select Province"
              options={provinces.map((province) => ({
                id: province.slug,
                name: province.name,
              }))}
              onSelect={handleProvinceSelect}
            />
          </View>

          {provinceSlug ? (
            <View className="mb-4">
              <SimpleDropdown
                label="District"
                value={districtSlug}
                placeholder="Select District"
                options={districts.map((district) => ({
                  id: district.slug,
                  name: district.name,
                }))}
                onSelect={handleDistrictSelect}
              />
            </View>
          ) : null}

          {districtSlug ? (
            <View className="mb-4">
              <SimpleDropdown
                label="Commune"
                value={communeSlug}
                placeholder="Select Commune"
                options={communes.map((commune) => ({
                  id: commune.slug,
                  name: commune.name,
                }))}
                onSelect={(option) => setCommuneSlug(option.id)}
              />
            </View>
          ) : null}

          <View className="mb-4">
            <Text className="mb-2 text-sm font-medium text-gray-700">
              {isJobs ? "Salary Range" : "Price Range"}
            </Text>
            <View className="flex-row gap-2">
              <TextInput
                placeholder="Min"
                value={minPrice}
                onChangeText={setMinPrice}
                keyboardType="numeric"
                className="flex-1 rounded-lg border border-gray-200 px-4 py-3 text-base"
              />
              <TextInput
                placeholder="Max"
                value={maxPrice}
                onChangeText={setMaxPrice}
                keyboardType="numeric"
                className="flex-1 rounded-lg border border-gray-200 px-4 py-3 text-base"
              />
            </View>
          </View>

          {showYear ? (
            <View className="mb-4">
              <Text className="mb-2 text-sm font-medium text-gray-700">
                Year
              </Text>
              <TextInput
                placeholder="e.g., 2024"
                value={year}
                onChangeText={setYear}
                keyboardType="numeric"
                className="rounded-lg border border-gray-200 px-4 py-3 text-base"
              />
            </View>
          ) : null}

          {showCondition ? (
            <View className="mb-4">
              <SimpleDropdown
                label="Condition"
                value={condition}
                placeholder="Select Condition"
                options={CONDITION_OPTIONS}
                onSelect={(option) => setCondition(option.id)}
              />
            </View>
          ) : null}

          {brands.length > 0 ? (
            <View className="mb-4">
              <SimpleDropdown
                label="Brand"
                value={brand}
                placeholder="Select Brand"
                options={brands.map((entry) => ({
                  id: entry.name,
                  name: entry.name,
                }))}
                onSelect={(option) => setBrand(option.id)}
              />
            </View>
          ) : null}

          {selectFields.map((field) => (
            <View key={field.key} className="mb-4">
              <SimpleDropdown
                label={field.label?.en || FIELD_LABELS[field.key] || field.key}
                value={attrs[field.key] ?? ""}
                placeholder={`Select ${field.label?.en || FIELD_LABELS[field.key] || field.key}`}
                options={(field.options ?? []).map((option) => ({
                  id: option,
                  name: option,
                }))}
                onSelect={(option) =>
                  setAttrs((prev) => ({ ...prev, [field.key]: option.id }))
                }
              />
            </View>
          ))}

          {subQuery.isLoading ? <ActivityIndicator className="my-4" /> : null}
        </ScrollView>

        <View className="border-t border-gray-100 bg-white p-4">
          <TouchableOpacity
            onPress={handleApply}
            className="items-center justify-center rounded-xl bg-[#0EA5E9] py-4 shadow-lg"
          >
            <Text className="text-lg font-bold text-white">Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
