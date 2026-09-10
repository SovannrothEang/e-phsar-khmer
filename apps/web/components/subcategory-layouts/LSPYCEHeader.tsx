"use client";

import { useState } from "react";
import {
  IconFilterCog,
  IconLayoutGridFilled,
  IconListFilled,
} from "@tabler/icons-react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Filters {
  search: string;
  province: string;
  district: string;
  commune: string;
  sort: string;
  price: number;
  minPrice: string;
  maxPrice: string;
  priceRange: string;
  condition: string;
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
  const [filters, setFilters] = useState<Filters>({
    search: "",
    province: "",
    district: "",
    commune: "",
    sort: "latest",
    price: 0,
    minPrice: "",
    maxPrice: "",
    priceRange: "",
    condition: "",
    year: "",
    engine: "",
  });

  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showPriceDropdown, setShowPriceDropdown] = useState(false);
  const [showConditionDropdown, setShowConditionDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showEngineDropdown, setShowEngineDropdown] = useState(false);

  // Helper functions
  const getProvinceLabel = () => {
    if (!filters.province) return "Location";
    if (filters.province === "phnom-penh") return "Phnom Penh";
    if (filters.province === "siem-reap") return "Siem Reap";
    if (filters.province === "battambang") return "Battambang";
    if (filters.province === "sihanoukville") return "Sihanoukville";
    return filters.province
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getSortLabel = () => {
    if (filters.sort === "latest") return "Sort";
    if (filters.sort === "oldest") return "Oldest First";
    if (filters.sort === "price-low") return "Price: Low to High";
    if (filters.sort === "price-high") return "Price: High to Low";
    return "Sort";
  };

  const getPriceLabel = () => {
    if (!filters.priceRange) return priceLabel;
    switch (filters.priceRange) {
      case "under-100":
        return "Under $100";
      case "100-500":
        return "$100-$500";
      case "500-plus":
        return "$500+";
      default:
        return "Price";
    }
  };

  const getConditionLabel = () => {
    if (!filters.condition) return "Condition";
    if (filters.condition === "new") return "New";
    if (filters.condition === "used") return "Used";
    if (filters.condition === "refurbished") return "Refurbished";
    return "Condition";
  };

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
          {/* Location Filter */}
          <div className="relative">
            <Button
              variant="outline"
              onClick={() => setShowLocationDropdown(!showLocationDropdown)}
              className={`flex items-center bg-muted rounded-sm gap-2 h-12 py-1.5 text-sm cursor-pointer whitespace-nowrap px-3 ${
                filters.province ? "text-sky-500" : "text-foreground"
              }`}
            >
              <MapPin
                className={`h-4 w-4 shrink-0 ${filters.province ? "text-sky-500" : ""}`}
              />
              <span className="font-medium whitespace-nowrap">
                {getProvinceLabel()}
              </span>
            </Button>

            {showLocationDropdown && (
              <div className="absolute top-full left-0 mt-1 w-44 bg-white border border-gray-200 rounded-md shadow-lg z-20 py-2">
                {[
                  { val: "", label: "All Locations" },
                  { val: "phnom-penh", label: "Phnom Penh" },
                  { val: "siem-reap", label: "Siem Reap" },
                  { val: "battambang", label: "Battambang" },
                  { val: "sihanoukville", label: "Sihanoukville" },
                ].map((loc) => (
                  <button
                    key={loc.val}
                    onClick={() => {
                      setFilters({ ...filters, province: loc.val });
                      setShowLocationDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-between"
                  >
                    <span>{loc.label}</span>
                    {filters.province === loc.val && (
                      <i className="bi bi-check text-blue-600"></i>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sort Filter */}
          <div className="relative">
            <Button
              variant="outline"
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className={`bg-muted rounded-sm h-12 p-2 px-3 pr-3 cursor-pointer ${
                filters.sort !== "latest"
                  ? "text-sky-500 hover:bg-muted/50 hover:text-sky-500"
                  : ""
              }`}
            >
              <span className="font-medium whitespace-nowrap">
                {getSortLabel()}
              </span>
            </Button>

            {showSortDropdown && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-20 py-2">
                {[
                  { val: "latest", label: "Newest First" },
                  { val: "oldest", label: "Oldest First" },
                  { val: "price-low", label: "Price: Low to High" },
                  { val: "price-high", label: "Price: High to Low" },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    onClick={() => {
                      setFilters({ ...filters, sort: opt.val });
                      setShowSortDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-between"
                  >
                    <span>{opt.label}</span>
                    {filters.sort === opt.val && (
                      <i className="bi bi-check text-blue-600"></i>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {price && (
            <div className="relative">
              <Button
                variant="outline"
                onClick={() => setShowPriceDropdown(!showPriceDropdown)}
                className={`bg-muted rounded-sm h-12 p-2 px-3 pr-3 cursor-pointer ${
                  filters.priceRange
                    ? "text-sky-500 hover:bg-muted/50 hover:text-sky-500"
                    : ""
                }`}
              >
                <span className="font-medium whitespace-nowrap">
                  {getPriceLabel()}
                </span>
              </Button>

              {showPriceDropdown && (
                <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-20 py-2">
                  {[
                    { val: "", label: "All Prices" },
                    { val: "under-100", label: "Under $100" },
                    { val: "100-500", label: "$100 - $500" },
                    { val: "500-plus", label: "$500+" },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      onClick={() => {
                        setFilters({ ...filters, priceRange: opt.val });
                        setShowPriceDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-between"
                    >
                      <span>{opt.label}</span>
                      {filters.priceRange === opt.val && (
                        <i className="bi bi-check text-blue-600"></i>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

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
                  filters.condition
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
                    { val: "new", label: "New" },
                    { val: "used", label: "Used" },
                    { val: "refurbished", label: "Refurbished" },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      onClick={() => {
                        setFilters({ ...filters, condition: opt.val });
                        setShowConditionDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-between"
                    >
                      <span>{opt.label}</span>
                      {filters.condition === opt.val && (
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

          {/* More Filters Button */}
          <Button
            variant="outline"
            className="relative bg-muted rounded-sm h-12 px-3 text-sm cursor-pointer gap-2"
          >
            <IconFilterCog className="h-4 w-4 shrink-0" />
            <span className="font-medium whitespace-nowrap">More Filters</span>
          </Button>
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
