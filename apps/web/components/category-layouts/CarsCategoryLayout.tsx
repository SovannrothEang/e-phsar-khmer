"use client";

import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IconLayoutGridFilled, IconListFilled } from "@tabler/icons-react";
import { LocationSelectorFilter } from "@/components/filter/LocationSelectorFilter";
import SortFilter from "@/components/filter/SortFilter";
import PriceFilter from "@/components/filter/PriceFilter";
import MoreFilters from "@/components/filter/MoreFilters";

interface CarsCategoryLayoutProps {
  category: {
    name: string;
    slug: string;
    subcategories: { name: string; slug: string }[];
  };
}

export default function CarsCategoryLayout({
  category,
}: CarsCategoryLayoutProps) {
  return (
    <>
      {/* HEADER */}
      <div className="px-6 py-3 bg-card rounded-t-sm border">
        <h1 className="font-semibold text-lg md:text-lg">
          {category.name}{" "}
          <span className="font-semibold text-lg">in Cambodia</span>
        </h1>
      </div>

      {/* FILTER BAR — floating/sticky like the All Ads bar; the grid/list tabs
          inside switch the post sections below (page-level Tabs provides the
          context). */}
      <div className="sticky top-16 z-40 flex items-center justify-between bg-card rounded-b-sm border px-4 p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <LocationSelectorFilter />
          <SortFilter />
          <PriceFilter />
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
