"use client";

import { useState } from "react";
import { IconLayoutGridFilled, IconListFilled } from "@tabler/icons-react";
import { Check } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LocationSelectorFilter } from "@/components/filter/LocationSelectorFilter";
import SortFilter from "@/components/filter/SortFilter";
import PriceFilter from "@/components/filter/PriceFilter";
import MoreFilters from "@/components/filter/MoreFilters";
import { cn } from "@/lib/utils";
import {
  CONDITION_OPTIONS,
  CONDITION_PARAM,
  ENGINE_PARAM,
  YEAR_MAX_PARAM,
  YEAR_MIN_PARAM,
} from "@/lib/search-params";

export interface LSPCYEHeaderProps {
  title: string;
  /** Optional chips — cars-for-sale renders all; subcategories hide the ones they don't have. */
  year?: boolean;
  engine?: boolean;
  /** Vehicles-for-rent and other L-S-P surfaces hide the Condition chip. */
  condition?: boolean;
  /** LS-group surfaces (services/properties) hide the Price chip. */
  price?: boolean;
  /** Jobs replaces "Price" with "Salary". */
  priceLabel?: string;
  /**
   * Engine type names from the `enginetypes` attribute set — the exact names
   * the post form stores in `attributes.engineType` (e.g. "Petrol").
   */
  engineOptions?: string[];
}

interface ChipOption {
  /** Stable key; "" is the "all" row. */
  key: string;
  label: string;
}

/** One filter chip + its single-choice dropdown. */
function ChipSelect({
  label,
  activeLabel,
  options,
  value,
  onSelect,
}: {
  label: string;
  activeLabel?: string;
  options: ChipOption[];
  value: string;
  onSelect: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = value !== "";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "bg-muted rounded-sm h-12 p-2 px-3 cursor-pointer",
            active && "text-sky-500 hover:bg-muted/50 hover:text-sky-500",
          )}
        >
          <span className="font-medium whitespace-nowrap">
            {active ? (activeLabel ?? label) : label}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="rounded-sm w-48 p-1 mt-3 max-h-80 overflow-y-auto"
      >
        {options.map((opt) => (
          <button
            key={opt.key || "all"}
            type="button"
            onClick={() => {
              onSelect(opt.key);
              setOpen(false);
            }}
            className="flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm hover:bg-muted/60 transition-colors cursor-pointer"
          >
            <span>{opt.label}</span>
            {value === opt.key && <Check className="size-4 text-sky-600" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Year buckets: each of the last few model years on its own, then one
 * "& older" bucket. A bucket is a `year_min`/`year_max` pair; the key encodes
 * both so a URL-driven range can be matched back to its row.
 */
function yearOptions(): {
  key: string;
  label: string;
  min?: number;
  max?: number;
}[] {
  const newest = new Date().getFullYear() + 1; // next model year is sold already
  const singles = Array.from({ length: 8 }, (_, i) => newest - i).map((y) => ({
    key: `${y}-${y}`,
    label: String(y),
    min: y,
    max: y,
  }));
  const older = newest - 8;
  return [
    { key: "", label: "All Years" },
    ...singles,
    { key: `-${older}`, label: `${older} & Older`, max: older },
  ];
}

export default function LSPYCEHeader({
  title,
  year = true,
  engine = true,
  condition = true,
  price = true,
  priceLabel = "Price",
  engineOptions = [],
}: LSPCYEHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /** Apply param changes (null = remove) and keep every other filter. */
  const replaceParams = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  const conditionValue = searchParams.get(CONDITION_PARAM) ?? "";
  const engineValue = searchParams.get(ENGINE_PARAM) ?? "";
  const yearMin = searchParams.get(YEAR_MIN_PARAM) ?? "";
  const yearMax = searchParams.get(YEAR_MAX_PARAM) ?? "";
  const yearKey = yearMin || yearMax ? `${yearMin}-${yearMax}` : "";
  const years = yearOptions();
  const yearLabel =
    years.find((o) => o.key === yearKey)?.label ??
    (yearMin && yearMax
      ? `${yearMin}–${yearMax}`
      : yearMin
        ? `${yearMin}+`
        : `${yearMax} & Older`);

  return (
    <>
      {/* HEADER */}
      <div className="px-6 py-3 bg-card rounded-t-sm border">
        <h1 className="font-semibold text-lg md:text-lg">
          {title} <span className="font-semibold text-lg">in Cambodia</span>
        </h1>
      </div>

      {/* FILTER BAR — sticky like the All Ads / category bar; the grid/list
          tabs switch the page's TabsContent views (the page owns the Tabs
          root). Every chip reads and writes the URL, which the page forwards
          to the feed (lib/search-params.ts). */}
      <div className="sticky top-16 z-40 flex items-center justify-between bg-card rounded-b-sm border px-4 p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <LocationSelectorFilter />
          <SortFilter />
          {price && <PriceFilter label={priceLabel} />}

          {year && (
            <ChipSelect
              label="Year"
              activeLabel={yearLabel}
              value={yearKey}
              options={years}
              onSelect={(key) => {
                const opt = years.find((o) => o.key === key);
                replaceParams({
                  [YEAR_MIN_PARAM]: opt?.min ? String(opt.min) : null,
                  [YEAR_MAX_PARAM]: opt?.max ? String(opt.max) : null,
                });
              }}
            />
          )}

          {condition && (
            <ChipSelect
              label="Condition"
              activeLabel={
                CONDITION_OPTIONS.find((o) => o.value === conditionValue)?.label
              }
              value={conditionValue}
              options={[
                { key: "", label: "All Conditions" },
                ...CONDITION_OPTIONS.map((o) => ({
                  key: o.value,
                  label: o.label,
                })),
              ]}
              onSelect={(key) => replaceParams({ [CONDITION_PARAM]: key })}
            />
          )}

          {engine && engineOptions.length > 0 && (
            <ChipSelect
              label="Engine Type"
              activeLabel={engineValue}
              value={engineValue}
              options={[
                { key: "", label: "All Engine Types" },
                ...engineOptions.map((name) => ({ key: name, label: name })),
              ]}
              onSelect={(key) => replaceParams({ [ENGINE_PARAM]: key })}
            />
          )}

          <MoreFilters />
        </div>
        <TabsList className="h-9 shrink-0">
          <TabsTrigger value="grid" className="cursor-pointer px-3">
            <IconLayoutGridFilled className="size-4" />
          </TabsTrigger>
          <TabsTrigger value="list" className="cursor-pointer px-3">
            <IconListFilled className="size-4" />
          </TabsTrigger>
        </TabsList>
      </div>
    </>
  );
}
