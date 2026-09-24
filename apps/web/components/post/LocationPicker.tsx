"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FieldLabel } from "@/components/post/FieldLabel";
import type { BackendPlace } from "@/lib/api/categories";
import { getLocationCommunes, getLocationDistricts } from "@/actions/listings";

export interface PlaceSelection {
  province: BackendPlace | null;
  district: BackendPlace | null;
  commune: BackendPlace | null;
}

export const EMPTY_PLACE: PlaceSelection = {
  province: null,
  district: null,
  commune: null,
};

/** "Phnom Penh, Boeng Keng Kang, Olympic" — largest to smallest. */
export function placeLabel(place: PlaceSelection): string {
  return [place.province, place.district, place.commune]
    .map((level) => level?.name)
    .filter(Boolean)
    .join(", ");
}

type Level = "province" | "district" | "commune";

/**
 * Three-level Location cascade (province → district → commune) over the seeded
 * NCDD geography: chevron rows drill down, ‹ steps back, ✕ closes, Clear empties
 * the selection, and the level on screen marks the chosen row with a blue check.
 *
 * Districts and communes are fetched when the user drills into them (never
 * up front), and every state change happens in a click handler — no effects.
 */
export default function LocationPicker({
  provinces,
  value,
  onChange,
  required,
}: {
  provinces: BackendPlace[];
  value: PlaceSelection;
  onChange: (place: PlaceSelection) => void;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<Level>("province");
  const [districts, setDistricts] = useState<BackendPlace[]>([]);
  const [communes, setCommunes] = useState<BackendPlace[]>([]);
  const [loading, setLoading] = useState(false);
  // Guards against a slow response from a province/district the user left.
  const requestId = useRef(0);

  const loadDistricts = async (province: BackendPlace) => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const rows = await getLocationDistricts(province.slug);
      if (id === requestId.current) setDistricts(rows);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  const loadCommunes = async (
    province: BackendPlace,
    district: BackendPlace,
  ) => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const rows = await getLocationCommunes(province.slug, district.slug);
      if (id === requestId.current) setCommunes(rows);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  // Opening lands on the deepest level already chosen, loading what it needs.
  const openPanel = () => {
    setOpen(true);
    if (value.commune && value.province && value.district) {
      setLevel("commune");
      void loadCommunes(value.province, value.district);
    } else if (value.district && value.province) {
      setLevel("district");
      void loadDistricts(value.province);
    } else {
      setLevel("province");
    }
  };

  const pick = (row: BackendPlace) => {
    if (level === "province") {
      onChange({ province: row, district: null, commune: null });
      setLevel("district");
      void loadDistricts(row);
      return;
    }
    if (level === "district" && value.province) {
      onChange({ province: value.province, district: row, commune: null });
      setLevel("commune");
      void loadCommunes(value.province, row);
      return;
    }
    if (level === "commune") {
      onChange({
        province: value.province,
        district: value.district,
        commune: row,
      });
      setOpen(false);
    }
  };

  const rows =
    level === "province"
      ? provinces
      : level === "district"
        ? districts
        : communes;
  const selected =
    level === "province"
      ? value.province
      : level === "district"
        ? value.district
        : value.commune;
  const label = placeLabel(value);
  const crumbs = [value.province?.name, value.district?.name].filter(Boolean);

  return (
    <div>
      <FieldLabel label="Location" required={required} />
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (next) openPanel();
          else setOpen(false);
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5 text-left text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
          >
            <span className={label ? "" : "text-gray-400"}>
              {label || "Choose Location"}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] p-0"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2.5">
            {level === "province" ? (
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/70"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  setLevel(level === "commune" ? "district" : "province")
                }
                aria-label="Back"
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/70"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <span className="truncate px-2 text-[15px]">
              {crumbs.length > 0 ? crumbs.join(" › ") : "Choose Location"}
            </span>
            <button
              type="button"
              onClick={() => {
                onChange(EMPTY_PLACE);
                setLevel("province");
              }}
              className="shrink-0 cursor-pointer rounded-full bg-muted px-3 py-1 text-[13px] text-muted-foreground hover:bg-muted/70"
            >
              Clear
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto py-1">
            {loading && rows.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                Loading…
              </p>
            ) : rows.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                Nothing here
              </p>
            ) : (
              rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => pick(row)}
                  className={`flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left text-[15px] hover:bg-muted ${
                    selected?.id === row.id ? "bg-muted" : ""
                  }`}
                >
                  <span className="truncate">{row.name}</span>
                  {selected?.id === row.id ? (
                    <Check className="h-4 w-4 shrink-0 text-[#00a0e9]" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
                  )}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
