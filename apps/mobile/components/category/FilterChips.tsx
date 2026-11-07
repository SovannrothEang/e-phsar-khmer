import ConditionFilterSheet from "@/components/category/ConditionFilterSheet";
import PriceFilterSheet from "@/components/category/PriceFilterSheet";
import YearFilterSheet from "@/components/category/YearFilterSheet";
import SelectionSheet from "@/components/common/SelectionSheet";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  fetchCommunes,
  fetchDistricts,
  fetchProvinces,
} from "@/lib/api/catalog";
import { firstParam } from "@/lib/feed-params";
import { CONDITION_OPTIONS, SORT_OPTIONS } from "@/lib/filter-options";
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
  selectedLocation?: string;
}

type LocationStep = "province" | "district" | "commune";

/**
 * The category feed's quick-filter row. `Filters` opens the full filter screen;
 * `Location` is its own searchable slide-up drill-down (province → khan →
 * sangkat) and writes the browse params in place, so the chip can show the
 * deepest chosen location without leaving the feed.
 */
const FilterChips = ({
  categoryId,
  subCategoryId,
  filters,
  onFiltersPress,
  selectedLocation,
}: FilterChipsProps) => {
  const { t } = useLanguage();
  const params = useLocalSearchParams();
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationStep, setLocationStep] = useState<LocationStep>("province");
  const [sortOpen, setSortOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const [yearOpen, setYearOpen] = useState(false);
  const [conditionOpen, setConditionOpen] = useState(false);

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
  const currentLocation = selectedLocation ?? locationName;

  const isJobs = categoryId === "jobs";
  const isVehicles = categoryId === "cars-and-vehicles" && !!subCategoryId;

  const defaultFilters: FilterItem[] = [
    { key: "filters", label: t("filters"), icon: "options-outline" },
    {
      key: "location",
      label: t("location"),
      icon: "location",
      hasDropdown: true,
    },
    { key: "sort", label: t("sort"), hasDropdown: true },
    {
      key: isJobs ? "salary" : "price",
      label: isJobs ? t("salary") : t("price"),
      hasDropdown: true,
    },
    // Vehicles carry two extra quick filters, matching the filter screen.
    ...(isVehicles
      ? ([
          { key: "year", label: "Year", hasDropdown: true },
          { key: "condition", label: "Condition", hasDropdown: true },
        ] satisfies FilterItem[])
      : []),
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
  const conditionLabel =
    CONDITION_OPTIONS.find((option) => option.id === selectedCondition)?.name ??
    selectedCondition;

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
            : filter.key === "year"
              ? selectedYear
              : filter.key === "condition"
                ? conditionLabel
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
              {filter.hasDropdown && (
                <Ionicons
                  name="caret-down"
                  size={12}
                  color={isSelected ? "white" : "#4B5563"}
                  style={{ marginLeft: 6 }}
                />
              )}
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
          router.setParams({ yearMin: min, yearMax: max });
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
          router.setParams({ minPrice: min.trim(), maxPrice: max.trim() });
          setPriceOpen(false);
        }}
        onClose={() => setPriceOpen(false)}
      />
    </View>
  );
};

export default FilterChips;
