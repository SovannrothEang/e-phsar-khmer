import ConditionFilterSheet from "@/components/category/ConditionFilterSheet";
import PriceFilterSheet from "@/components/category/PriceFilterSheet";
import YearFilterSheet from "@/components/category/YearFilterSheet";
import SelectionSheet from "@/components/common/SelectionSheet";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  fetchCommunes,
  fetchDistricts,
  fetchLinkedAttributes,
  fetchProvinces,
  fetchSubcategory,
} from "@/lib/api/catalog";
import {
  countActiveFilters,
  firstParam,
  normalizePriceRange,
  normalizeYearRange,
} from "@/lib/feed-params";
import {
  CONDITION_OPTIONS,
  NO_PRICE_CATEGORIES,
  SORT_OPTIONS,
  TYPE_IN_FILTERS_ONLY_SUBCATEGORIES,
} from "@/lib/filter-options";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

export interface FilterItem {
  key?: string;
  label: string;
  icon?: string;
  hasDropdown?: boolean;
}

interface FilterChipsProps {
  categoryId?: string;
  /** Present only on a subcategory feed — the category feed has no year/condition. */
  subCategoryId?: string;
  filters?: FilterItem[];
  onFiltersPress?: () => void;
  /** True when the brand comes from the path, not from a filter. */
  brandIsScope?: boolean;
  /** A screen-owned active row, e.g. the search query on /search-posts. */
  extraFilterCount?: number;
}

type LocationStep = "province" | "district" | "commune";

/**
 * The category feed's quick-filter row. `Filters` opens the full filter screen;
 * `Location` is its own searchable slide-up drill-down (province → khan →
 * sangkat) and writes the browse params in place, so the chip can show the
 * deepest chosen location without leaving the feed.
 */
/** Extra quick filters per subcategory (captain's list, 2026-11-08). */
const YEAR_FILTER: FilterItem = {
  key: "year",
  label: "Year",
  hasDropdown: true,
};
const CONDITION_FILTER: FilterItem = {
  key: "condition",
  label: "Condition",
  hasDropdown: true,
};

const EXTRA_FILTERS_BY_SUBCATEGORY: Record<string, FilterItem[]> = {
  "cars-for-sale": [YEAR_FILTER, CONDITION_FILTER],
  "motorcycles-for-sale": [YEAR_FILTER, CONDITION_FILTER],
  bicycles: [CONDITION_FILTER],
  "lorries-vans-and-tractors": [CONDITION_FILTER],
  "parts-and-accessories": [CONDITION_FILTER],
  // Phones & Tablets (captain, 2026-11-08); phone-numbers has no condition.
  phones: [CONDITION_FILTER],
  tablets: [CONDITION_FILTER],
  "smart-watches": [CONDITION_FILTER],
  "phone-accessories": [CONDITION_FILTER],
  // Books, Sports & Hobbies: only Musical Instruments declares a condition.
  "musical-instruments": [CONDITION_FILTER],
};

const FilterChips = ({
  categoryId,
  subCategoryId,
  filters,
  onFiltersPress,
  brandIsScope,
  extraFilterCount = 0,
}: FilterChipsProps) => {
  const { t } = useLanguage();
  const params = useLocalSearchParams();
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationStep, setLocationStep] = useState<LocationStep>("province");
  const [sortOpen, setSortOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const [yearOpen, setYearOpen] = useState(false);
  const [conditionOpen, setConditionOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);

  const provinceSlug = firstParam(params.provinceSlug) ?? "";
  const districtSlug = firstParam(params.districtSlug) ?? "";
  const communeSlug = firstParam(params.communeSlug) ?? "";

  const provincesQuery = useQuery({
    queryKey: ["provinces"],
    queryFn: fetchProvinces,
    staleTime: 10 * 60_000,
  });
  const districtsQuery = useQuery({
    queryKey: ["districts", provinceSlug],
    queryFn: () => fetchDistricts(provinceSlug),
    enabled: !!provinceSlug,
    staleTime: 10 * 60_000,
  });
  const communesQuery = useQuery({
    queryKey: ["communes", provinceSlug, districtSlug],
    queryFn: () => fetchCommunes(provinceSlug, districtSlug),
    enabled: !!provinceSlug && !!districtSlug,
    staleTime: 10 * 60_000,
  });

  const provinceName = useMemo(
    () =>
      (provincesQuery.data ?? []).find(
        (province) => province.slug === provinceSlug,
      )?.name ?? provinceSlug,
    [provincesQuery.data, provinceSlug],
  );
  const districtName = useMemo(
    () =>
      (districtsQuery.data ?? []).find(
        (district) => district.slug === districtSlug,
      )?.name ?? districtSlug,
    [districtsQuery.data, districtSlug],
  );
  const communeName = useMemo(
    () =>
      (communesQuery.data ?? []).find((commune) => commune.slug === communeSlug)
        ?.name ?? communeSlug,
    [communesQuery.data, communeSlug],
  );

  const locationName = communeName || districtName || provinceName;
  const currentLocation = locationName;

  const isJobs = categoryId === "jobs";
  // Services post no price, so the feed offers no Price/Salary chip there.
  const hasPrice = !NO_PRICE_CATEGORIES.has(categoryId ?? "");
  // Furniture's Type has no tile row; it is reachable from this chip row and
  // the Filters page only, with a compact searchless sheet.
  const showTypeChip = TYPE_IN_FILTERS_ONLY_SUBCATEGORIES.has(
    subCategoryId ?? "",
  );
  const typeSubQuery = useQuery({
    queryKey: ["subcategory", categoryId, subCategoryId],
    queryFn: () => fetchSubcategory(categoryId!, subCategoryId!),
    enabled: showTypeChip && !!categoryId && !!subCategoryId,
  });
  const typeAttributesQuery = useQuery({
    queryKey: ["linked-attributes", typeSubQuery.data?.id],
    queryFn: () => fetchLinkedAttributes(typeSubQuery.data!.id),
    enabled: showTypeChip && !!typeSubQuery.data?.id,
  });
  const typeOptions = useMemo(
    () =>
      (typeAttributesQuery.data ?? [])
        .filter((row) => row.type === "types")
        .map((row) => ({ id: row.name, name: row.name, image: row.image })),
    [typeAttributesQuery.data],
  );
  const attrsParam = firstParam(params.attrs) ?? "";
  const selectedType = useMemo(() => {
    if (!attrsParam) return "";
    try {
      const parsed: unknown = JSON.parse(attrsParam);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return "";
      }
      const value = (parsed as Record<string, unknown>).type;
      return typeof value === "string" ? value : "";
    } catch {
      return "";
    }
  }, [attrsParam]);
  /** Sets or removes `attrs.type` without touching the other attributes. */
  const setType = (value: string) => {
    let current: Record<string, string> = {};
    if (attrsParam) {
      try {
        const parsed: unknown = JSON.parse(attrsParam);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          current = Object.fromEntries(
            Object.entries(parsed as Record<string, unknown>).map(
              ([key, v]) => [key, String(v)],
            ),
          );
        }
      } catch {
        /* malformed attrs are replaced */
      }
    }
    if (value.trim() !== "") current.type = value;
    else delete current.type;
    router.setParams({
      attrs: Object.keys(current).length > 0 ? JSON.stringify(current) : "",
    });
  };

  const defaultFilters: FilterItem[] = [
    { key: "filters", label: t("filters"), icon: "options-outline" },
    {
      key: "location",
      label: t("location"),
      icon: "location",
      hasDropdown: true,
    },
    { key: "sort", label: t("sort"), hasDropdown: true },
    ...(hasPrice
      ? [
          {
            key: isJobs ? "salary" : "price",
            label: isJobs ? t("salary") : t("price"),
            hasDropdown: true,
          },
        ]
      : []),
    // Furniture children: Type stays a chip, never an icon tile strip.
    ...(showTypeChip
      ? [{ key: "type", label: "Type", hasDropdown: true }]
      : []),
    // Quick filters each subcategory's schema actually supports.
    ...(EXTRA_FILTERS_BY_SUBCATEGORY[subCategoryId ?? ""] ?? []),
  ];

  const items = filters || defaultFilters;

  const yearMin = firstParam(params.yearMin) ?? "";
  const yearMax = firstParam(params.yearMax) ?? "";
  const selectedYear =
    yearMin && yearMax
      ? yearMin === yearMax
        ? yearMin
        : `${yearMin}–${yearMax}`
      : yearMin
        ? `${yearMin}+`
        : yearMax
          ? `≤${yearMax}`
          : "";
  const selectedCondition = firstParam(params.condition) ?? "";
  const sortParam = firstParam(params.sort) ?? "";
  const sortLabel =
    sortParam && sortParam !== "newest"
      ? (SORT_OPTIONS.find((option) => option.id === sortParam)?.name ??
        sortParam)
      : "";
  const priceMin = firstParam(params.minPrice) ?? "";
  const priceMax = firstParam(params.maxPrice) ?? "";
  const priceLabel =
    priceMin && priceMax
      ? `$${priceMin}–$${priceMax}`
      : priceMin
        ? `$${priceMin}+`
        : priceMax
          ? `≤$${priceMax}`
          : "";
  /** Badge on the Filters chip: the shared one-per-active-row definition. */
  const activeFilterCount =
    countActiveFilters(params, { brandIsScope }) + extraFilterCount;
  const conditionLabel =
    CONDITION_OPTIONS.find((option) => option.id === selectedCondition)?.name ??
    selectedCondition;

  const clearFilter = (key?: string) => {
    if (key === "location") {
      router.setParams({
        provinceSlug: "",
        districtSlug: "",
        communeSlug: "",
      });
      return;
    }
    if (key === "year") {
      router.setParams({ yearMin: "", yearMax: "" });
      return;
    }
    if (key === "condition") {
      router.setParams({ condition: "" });
      return;
    }
    if (key === "sort") {
      router.setParams({ sort: "" });
      return;
    }
    if (key === "price" || key === "salary") {
      router.setParams({ minPrice: "", maxPrice: "" });
      return;
    }
    if (key === "type") {
      setType("");
    }
  };

  const handleFilterPress = (filter: FilterItem) => {
    if (filter.key === "location") {
      setLocationStep("province");
      setLocationOpen(true);
      return;
    }
    if (filter.key === "filters") {
      onFiltersPress?.();
      return;
    }
    if (filter.key === "sort") {
      setSortOpen(true);
      return;
    }
    if (filter.key === "price" || filter.key === "salary") {
      setPriceOpen(true);
      return;
    }
    if (filter.key === "year") {
      setYearOpen(true);
      return;
    }
    if (filter.key === "condition") {
      setConditionOpen(true);
      return;
    }
    if (filter.key === "type") {
      setTypeOpen(true);
    }
  };

  const closeLocation = () => {
    setLocationOpen(false);
    setLocationStep("province");
  };

  const clearProvince = () => {
    router.setParams({
      provinceSlug: "",
      districtSlug: "",
      communeSlug: "",
    });
  };

  const clearDistrict = () => {
    router.setParams({
      provinceSlug,
      districtSlug: "",
      communeSlug: "",
    });
  };

  const clearCommune = () => {
    router.setParams({
      provinceSlug,
      districtSlug,
      communeSlug: "",
    });
  };

  const locationTitle =
    locationStep === "province"
      ? t("location")
      : locationStep === "district"
        ? "Khan/District"
        : "Sangkat/Commune";

  const locationOptions =
    locationStep === "province"
      ? (provincesQuery.data ?? []).map((province) => ({
          id: province.slug,
          name: province.name,
        }))
      : locationStep === "district"
        ? (districtsQuery.data ?? []).map((district) => ({
            id: district.slug,
            name: district.name,
          }))
        : (communesQuery.data ?? []).map((commune) => ({
            id: commune.slug,
            name: commune.name,
          }));

  const locationValue =
    locationStep === "province"
      ? provinceSlug
      : locationStep === "district"
        ? districtSlug
        : communeSlug;

  const locationLoading =
    locationStep === "province"
      ? provincesQuery.isLoading
      : locationStep === "district"
        ? districtsQuery.isLoading
        : communesQuery.isLoading;

  const locationEmpty =
    locationStep === "province"
      ? "No provinces"
      : locationStep === "district"
        ? "No districts"
        : "No communes";

  const locationBack =
    locationStep === "province"
      ? undefined
      : () =>
          setLocationStep(locationStep === "commune" ? "district" : "province");

  const locationClear =
    locationStep === "province"
      ? provinceSlug
        ? clearProvince
        : undefined
      : locationStep === "district"
        ? districtSlug
          ? clearDistrict
          : undefined
        : communeSlug
          ? clearCommune
          : undefined;

  const selectLocation = (id: string) => {
    if (locationStep === "province") {
      router.setParams({
        provinceSlug: id,
        districtSlug: "",
        communeSlug: "",
      });
      setLocationStep("district");
      return;
    }
    if (locationStep === "district") {
      router.setParams({
        provinceSlug,
        districtSlug: id,
        communeSlug: "",
      });
      setLocationStep("commune");
      return;
    }
    router.setParams({ provinceSlug, districtSlug, communeSlug: id });
    closeLocation();
  };

  return (
    <View className="pt-1 pb-2 bg-white">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        {items.map((filter, index) => {
          const isLocation =
            filter.key === "location" || filter.label === t("location");
          const valueLabel = isLocation
            ? currentLocation
            : filter.key === "sort"
              ? sortLabel
              : filter.key === "year"
                ? selectedYear
                : filter.key === "condition"
                  ? conditionLabel
                  : filter.key === "price" || filter.key === "salary"
                    ? priceLabel
                    : filter.key === "type"
                      ? selectedType
                      : "";
          const displayLabel = valueLabel || filter.label;
          const isSelected = !!valueLabel;

          return (
            <TouchableOpacity
              key={index}
              onPress={() => handleFilterPress(filter)}
              className={`flex-row items-center rounded px-4 py-2 bg-gray-100 ${
                isSelected ? "bg-sky-500" : "bg-gray-100"
              }`}
              activeOpacity={0.7}
            >
              {filter.icon && (
                <Ionicons
                  name={filter.icon as any}
                  size={16}
                  color={isSelected ? "white" : "#374151"}
                  style={{ marginRight: 6 }}
                />
              )}
              <Text
                className={`text-base font-semibold ${
                  isSelected ? "text-white" : "text-gray-800"
                }`}
              >
                {displayLabel}
              </Text>
              {filter.key === "filters" && activeFilterCount > 0 && (
                <View className="ml-1.5 h-5 min-w-5 items-center justify-center rounded-full bg-[#F59E0B] px-1">
                  <Text className="text-[11px] font-bold text-white">
                    {activeFilterCount}
                  </Text>
                </View>
              )}
              {filter.hasDropdown &&
                (isSelected ? (
                  <TouchableOpacity
                    onPress={() => clearFilter(filter.key)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Clear ${filter.label}`}
                  >
                    <Ionicons
                      name="close"
                      size={16}
                      color="white"
                      style={{ marginLeft: 6 }}
                    />
                  </TouchableOpacity>
                ) : (
                  <Ionicons
                    name="caret-down"
                    size={12}
                    color="#4B5563"
                    style={{ marginLeft: 6 }}
                  />
                ))}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View className="mt-2 h-[1px] bg-gray-200" />

      <SelectionSheet
        visible={locationOpen}
        title={locationTitle}
        options={locationOptions}
        value={locationValue}
        onSelect={(option) => selectLocation(option.id)}
        onClear={locationClear}
        onBack={locationBack}
        onClose={closeLocation}
        emptyLabel={locationEmpty}
        loading={locationLoading}
      />

      <SelectionSheet
        visible={sortOpen}
        title="Sort"
        options={SORT_OPTIONS}
        value={firstParam(params.sort) || "newest"}
        searchable={false}
        compact
        indicator="radio"
        onSelect={(option) => {
          router.setParams({ sort: option.id === "newest" ? "" : option.id });
          setSortOpen(false);
        }}
        onClose={() => setSortOpen(false)}
      />

      <YearFilterSheet
        visible={yearOpen}
        initialMin={yearMin}
        initialMax={yearMax}
        onApply={(min, max) => {
          const years = normalizeYearRange(min, max);
          router.setParams({
            yearMin: years.min ?? "",
            yearMax: years.max ?? "",
          });
          setYearOpen(false);
        }}
        onClose={() => setYearOpen(false)}
      />

      <ConditionFilterSheet
        visible={conditionOpen}
        initial={selectedCondition}
        onApply={(condition) => {
          router.setParams({ condition });
          setConditionOpen(false);
        }}
        onClose={() => setConditionOpen(false)}
      />

      <PriceFilterSheet
        visible={priceOpen}
        title={isJobs ? "Salary" : "Price"}
        label={isJobs ? "Salary" : "Price"}
        initialMin={firstParam(params.minPrice) ?? ""}
        initialMax={firstParam(params.maxPrice) ?? ""}
        onApply={(min, max) => {
          const price = normalizePriceRange(min, max);
          router.setParams({
            minPrice: price.min ?? "",
            maxPrice: price.max ?? "",
          });
          setPriceOpen(false);
        }}
        onClose={() => setPriceOpen(false)}
      />

      {showTypeChip ? (
        <SelectionSheet
          visible={typeOpen}
          title="Type"
          options={typeOptions}
          value={selectedType}
          loading={typeSubQuery.isLoading || typeAttributesQuery.isLoading}
          emptyLabel="No types"
          // The furniture Type lists are short and have no artwork.
          searchable={false}
          compact
          showIcons={false}
          onSelect={(option) => {
            setType(option.name);
            setTypeOpen(false);
          }}
          onClear={
            selectedType
              ? () => {
                  setType("");
                  setTypeOpen(false);
                }
              : undefined
          }
          onClose={() => setTypeOpen(false)}
        />
      ) : null}
    </View>
  );
};

export default FilterChips;
