"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { IconCircleCheckFilled } from "@tabler/icons-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import type { Post } from "@/lib/posts";

export const SORT_PARAM = "sort";
export const DEFAULT_SORT = "latest-ads";

export const SORT_OPTIONS = [
  { value: "latest-ads", label: "Latest Ads", adsLabel: "Latest Ads" },
  { value: "new-ads", label: "New Ads", adsLabel: "New Ads" },
  { value: "most-hit", label: "Most Hit Ads", adsLabel: "Most Hit Ads" },
  {
    value: "price-asc",
    label: "Price: Low to High",
    adsLabel: "Price: Low to High",
  },
  {
    value: "price-desc",
    label: "Price: High to Low",
    adsLabel: "Price: High to Low",
  },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export function parseSortParam(value: string | null): SortValue {
  const found = SORT_OPTIONS.find((o) => o.value === value);
  return found?.value ?? DEFAULT_SORT;
}

export function sortPosts(posts: Post[], sort: SortValue): Post[] {
  const ads = [...posts];

  switch (sort) {
    case "new-ads":
      return ads.sort((a, b) => b.createdat.getTime() - a.createdat.getTime());
    case "most-hit":
      return ads.sort((a, b) => Number(b.postId) - Number(a.postId));
    // "Negotiable" listings have no numeric price to rank, so they sort LAST
    // in both directions rather than first (a bare `a.price - b.price` would
    // coerce null to 0 and float them to the top of price-asc).
    case "price-asc":
      return ads.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    case "price-desc":
      return ads.sort(
        (a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity),
      );
    case "latest-ads":
    default:
      return ads;
  }
}

function SortLabel(sort: SortValue) {
  if (sort === DEFAULT_SORT) return "Sort";
  const option = SORT_OPTIONS.find((o) => o.value === sort);
  return option ? `Sort :${option.adsLabel}` : "Sort";
}

export default function SortFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sortParam = parseSortParam(searchParams.get(SORT_PARAM));
  const [open, setOpen] = useState(false);

  const hasActiveFilter = sortParam !== DEFAULT_SORT;
  const adsLabel = SortLabel(sortParam);

  function pushSort(next: SortValue) {
    const params = new URLSearchParams(searchParams.toString());

    if (next === DEFAULT_SORT) {
      params.delete(SORT_PARAM);
    } else {
      params.set(SORT_PARAM, next);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  function selectSort(value: SortValue) {
    pushSort(value);
    setOpen(false);
  }

  function removeFilter(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    pushSort(DEFAULT_SORT);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "bg-muted rounded-sm h-12 p-2 px-3 pr-3 cursor-pointer",
            hasActiveFilter &&
              "text-sky-500 hover:bg-muted/50 hover:text-sky-500",
            open && !hasActiveFilter && "",
          )}
        >
          <span>{adsLabel}</span>
          {hasActiveFilter && (
            <span
              role="button"
              tabIndex={0}
              className="inline-flex rounded-sm p-0.5"
              onClick={removeFilter}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  removeFilter(e as unknown as React.MouseEvent);
                }
              }}
              aria-label="Remove sort filter"
            >
              <X className="size-4 shrink-0 text-foreground" aria-hidden />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="center" className="rounded-sm w-50 p-0 mt-3">
        <p className="text-base text-foreground text-center pt-2 ">Sort</p>
        <ul className="">
          <div className="border-b border-gray-200" />
          {SORT_OPTIONS.map((option) => {
            const isSelected = sortParam === option.value;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  onClick={() => selectSort(option.value)}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-sm hover:bg-muted/60 transition-colors cursor-pointer"
                >
                  <span>{option.label}</span>
                  {isSelected && (
                    <IconCircleCheckFilled
                      className="size-5 shrink-0 text-sky-600"
                      aria-hidden
                    />
                  )}
                </button>
                <Separator />
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
