"use client";

import { useState } from "react";
import { IconLayoutGridFilled, IconListFilled } from "@tabler/icons-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LocationSelectorFilter } from "@/components/filter/LocationSelectorFilter";
import SortFilter from "@/components/filter/SortFilter";
import PriceFilter from "@/components/filter/PriceFilter";
import MoreFilters from "@/components/filter/MoreFilters";
import { CONDITION_OPTIONS, CONDITION_PARAM } from "@/lib/search-params";

/**
 * Year and Engine Type are still local-only chips: they need per-subcategory
 * attribute-key resolution before they can filter (see spec-search.md, out of
 * scope). Location, Sort, Price, Condition and More Filters are the shared
 * URL-driven filters the page forwards to the feed.
 */
interface LocalFilters {
  year: string;
  engine: string;
}

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
}

export default function LSPYCEHeader({
  title,
  year = true,
  engine = true,
  condition = true,
  price = true,
  priceLabel = "Price",
}: LSPCYEHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const conditionValue = searchParams.get(CONDITION_PARAM) ?? "";

  const [filters, setFilters] = useState<LocalFilters>({
    year: "",
    engine: "",
  });

  const [showConditionDropdown, setShowConditionDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showEngineDropdown, setShowEngineDropdown] = useState(false);

  const setCondition = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(CONDITION_PARAM, value);
    else params.delete(CONDITION_PARAM);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  const getConditionLabel = () =>
    CONDITION_OPTIONS.find((o) => o.value === conditionValue)?.label ??
    "Condition";

  const getYearLabel = () => {
    if (!filters.year) return "Year";
    return filters.year;
  };

  const getEngineLabel = () => {
    if (!filters.engine) return "Engine Type";
    if (filters.engine === "gasoline") return "Gasoline";
    if (filters.engine === "diesel") return "Diesel";
    if (filters.engine === "electric") return "Electric";
    if (filters.engine === "hybrid") return "Hybrid";
    return "Engine Type";
  };

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
          root). */}
      <div className="sticky top-16 z-40 flex items-center justify-between bg-card rounded-b-sm border px-4 p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <LocationSelectorFilter />
          <SortFilter />
          {price && <PriceFilter label={priceLabel} />}

          {year && (
            <div className="relative">
              <Button
                variant="outline"
                onClick={() => setShowYearDropdown(!showYearDropdown)}
                className={`bg-muted rounded-sm h-12 p-2 px-3 pr-3 cursor-pointer ${
                  filters.year
                    ? "text-sky-500 hover:bg-muted/50 hover:text-sky-500"
                    : ""
                }`}
              >
                <span className="font-medium whitespace-nowrap">
                  {getYearLabel()}
                </span>
              </Button>

              {showYearDropdown && (
                <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-20 py-2">
                  {[
                    { val: "", label: "All Years" },
                    { val: "2024", label: "2024" },
                    { val: "2023", label: "2023" },
                    { val: "2022", label: "2022" },
                    { val: "2021", label: "2021" },
                    { val: "2020", label: "2020 & Older" },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      onClick={() => {
                        setFilters({ ...filters, year: opt.val });
                        setShowYearDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-between"
                    >
                      <span>{opt.label}</span>
                      {filters.year === opt.val && (
                        <i className="bi bi-check text-blue-600"></i>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {condition && (
            <div className="relative">
              <Button
                variant="outline"
                onClick={() => setShowConditionDropdown(!showConditionDropdown)}
                className={`bg-muted rounded-sm h-12 p-2 px-3 pr-3 cursor-pointer ${
                  conditionValue
                    ? "text-sky-500 hover:bg-muted/50 hover:text-sky-500"
                    : ""
                }`}
              >
                <span className="font-medium whitespace-nowrap">
                  {getConditionLabel()}
                </span>
              </Button>

              {showConditionDropdown && (
                <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-20 py-2">
                  {[
                    { val: "", label: "All Conditions" },
                    ...CONDITION_OPTIONS.map((o) => ({
                      val: o.value,
                      label: o.label,
                    })),
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      onClick={() => {
                        setCondition(opt.val);
                        setShowConditionDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-between"
                    >
                      <span>{opt.label}</span>
                      {conditionValue === opt.val && (
                        <i className="bi bi-check text-blue-600"></i>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {engine && (
            <div className="relative">
              <Button
                variant="outline"
                onClick={() => setShowEngineDropdown(!showEngineDropdown)}
                className={`bg-muted rounded-sm h-12 p-2 px-3 pr-3 cursor-pointer ${
                  filters.engine
                    ? "text-sky-500 hover:bg-muted/50 hover:text-sky-500"
                    : ""
                }`}
              >
                <span className="font-medium whitespace-nowrap">
                  {getEngineLabel()}
                </span>
              </Button>

              {showEngineDropdown && (
                <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-20 py-2">
                  {[
                    { val: "", label: "All Engine Types" },
                    { val: "gasoline", label: "Gasoline" },
                    { val: "diesel", label: "Diesel" },
                    { val: "electric", label: "Electric" },
                    { val: "hybrid", label: "Hybrid" },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      onClick={() => {
                        setFilters({ ...filters, engine: opt.val });
                        setShowEngineDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-between"
                    >
                      <span>{opt.label}</span>
                      {filters.engine === opt.val && (
                        <i className="bi bi-check text-blue-600"></i>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
