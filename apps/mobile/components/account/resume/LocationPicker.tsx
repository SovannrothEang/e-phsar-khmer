import { FieldError, FloatingLabel } from "@/components/common/FloatingInput";
import SelectionSheet from "@/components/common/SelectionSheet";
import { Colors } from "@/constants/Colors";
import {
  fetchCommunes,
  fetchDistricts,
  fetchProvinces,
  type PlaceSummary,
} from "@/lib/api/catalog";
import { resumeLocationLabel, type ResumeLocation } from "@/lib/api/resume";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

type Level = "province" | "district" | "commune";

const EMPTY: ResumeLocation = {
  province: null,
  district: null,
  commune: null,
};

/** Filled field + the project's province → district → commune drill-down. */
export default function LocationField({
  label = "Location",
  value,
  onChange,
  error,
}: {
  label?: string;
  value: ResumeLocation;
  onChange: (value: ResumeLocation) => void;
  error?: string;
}) {
  const [visible, setVisible] = useState(false);
  const [level, setLevel] = useState<Level>("province");
  const [prevVisible, setPrevVisible] = useState(visible);

  // Each open starts a fresh province -> district -> commune drill-down.
  // Adjusting state during render is the supported pattern; an effect caused
  // cascading renders.
  if (prevVisible !== visible) {
    setPrevVisible(visible);
    if (visible) setLevel("province");
  }

  const provincesQuery = useQuery({
    queryKey: ["provinces"],
    queryFn: fetchProvinces,
    enabled: visible,
    staleTime: 10 * 60_000,
  });
  const provinceSlug = value.province?.slug ?? "";
  const districtSlug = value.district?.slug ?? "";

  const districtsQuery = useQuery({
    queryKey: ["districts", provinceSlug],
    queryFn: () => fetchDistricts(provinceSlug),
    enabled: visible && level !== "province" && !!provinceSlug,
    staleTime: 10 * 60_000,
  });
  const communesQuery = useQuery({
    queryKey: ["communes", provinceSlug, districtSlug],
    queryFn: () => fetchCommunes(provinceSlug, districtSlug),
    enabled: visible && level === "commune" && !!provinceSlug && !!districtSlug,
    staleTime: 10 * 60_000,
  });

  const rows: PlaceSummary[] =
    level === "province"
      ? (provincesQuery.data ?? [])
      : level === "district"
        ? (districtsQuery.data ?? [])
        : (communesQuery.data ?? []);
  const selected =
    level === "province"
      ? value.province
      : level === "district"
        ? value.district
        : value.commune;
  const title =
    level === "province"
      ? label
      : level === "district"
        ? (value.province?.name ?? label)
        : (value.district?.name ?? label);
  const loading =
    level === "province"
      ? provincesQuery.isLoading
      : level === "district"
        ? districtsQuery.isLoading
        : communesQuery.isLoading;
  const display = resumeLocationLabel(value);

  const pick = (placeId: string) => {
    const place = rows.find((row) => row.id === placeId);
    if (!place) return;
    if (level === "province") {
      onChange({ province: place, district: null, commune: null });
      setLevel("district");
      return;
    }
    if (level === "district") {
      onChange({ ...value, district: place, commune: null });
      setLevel("commune");
      return;
    }
    onChange({ ...value, commune: place });
    setVisible(false);
  };

  const border = error ? "border border-red-400" : "border border-transparent";

  return (
    <>
      <View>
        <TouchableOpacity
          onPress={() => setVisible(true)}
          activeOpacity={0.8}
          className={`h-14 flex-row items-center justify-end rounded-lg bg-[#F2F2F7] px-4 dark:bg-[#3A3A3C] ${border}`}
          accessibilityRole="button"
          accessibilityLabel={label}
        >
          <FloatingLabel label={label} active={!!display} />
          {display ? (
            <Text
              className="text-base text-gray-900 dark:text-white"
              style={{ position: "absolute", left: 16, right: 44, top: 24 }}
              numberOfLines={1}
            >
              {display}
            </Text>
          ) : null}
          {display ? (
            <TouchableOpacity
              onPress={() => onChange(EMPTY)}
              className="h-6 w-6 items-center justify-center rounded-full"
              style={{ backgroundColor: Colors.danger }}
              accessibilityRole="button"
              accessibilityLabel={`Clear ${label}`}
            >
              <Ionicons name="close" size={14} color="white" />
            </TouchableOpacity>
          ) : (
            <Ionicons name="chevron-down" size={20} color={Colors.text.muted} />
          )}
        </TouchableOpacity>
        {error ? <FieldError message={error} /> : null}
      </View>

      <SelectionSheet
        visible={visible}
        title={title}
        options={rows.map((place) => ({ id: place.id, name: place.name }))}
        value={selected?.id}
        loading={loading}
        onBack={
          level !== "province"
            ? () => setLevel(level === "commune" ? "district" : "province")
            : undefined
        }
        onSelect={(option) => pick(option.id)}
        onClose={() => setVisible(false)}
        emptyLabel="No locations"
      />
    </>
  );
}
