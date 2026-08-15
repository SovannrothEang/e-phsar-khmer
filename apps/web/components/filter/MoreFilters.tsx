"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { locations } from "@/lib/location"
import {
  SORT_PARAM,
  SORT_OPTIONS,
  DEFAULT_SORT,
  type SortValue,
} from "@/components/filter/SortFilter"
import {
  MIN_AD_PRICE_PARAM,
  MAX_AD_PRICE_PARAM,
} from "@/components/filter/PriceFilter"
import {
  LOCATION_PRO_PARAM,
  LOCATION_DIS_PARAM,
  LOCATION_COM_PARAM,
} from "@/components/filter/LocationSelectorFilter"
import type { Post } from "@/lib/posts"
import { IconFilterCog } from '@tabler/icons-react';

// ─── Shared param keys (imported by AllAdsHeader) ─────────────────────────────
export const KEYWORD_PARAM = "keyword"
export const DATE_PARAM    = "date"

// ─── Date options ─────────────────────────────────────────────────────────────
export const DATE_OPTIONS = [
  { value: "",       label: "All Time" },
  { value: "today",  label: "Today" },
  { value: "week",   label: "This Week" },
  { value: "month",  label: "This Month" },
] as const
export type DateValue = (typeof DATE_OPTIONS)[number]["value"]

// ─── Post filter helpers ──────────────────────────────────────────────────────
export function filterPostsByKeyword(posts: Post[], keyword: string): Post[] {
  if (!keyword.trim()) return posts
  const q = keyword.toLowerCase()
  return posts.filter((p) => p.title.toLowerCase().includes(q))
}

export function filterPostsByDate(posts: Post[], date: DateValue): Post[] {
  if (!date) return posts
  const start = new Date()
  if (date === "today") {
    start.setHours(0, 0, 0, 0)
  } else if (date === "week") {
    start.setDate(start.getDate() - 7)
    start.setHours(0, 0, 0, 0)
  } else if (date === "month") {
    start.setDate(start.getDate() - 30)
    start.setHours(0, 0, 0, 0)
  }
  return posts.filter((p) => p.createdat >= start)
}

// ─── Active filter badge count ────────────────────────────────────────────────
function countActiveFilters(params: URLSearchParams): number {
  let n = 0
  if (params.get(KEYWORD_PARAM))      n++
  if (params.get(DATE_PARAM))         n++
  if (params.get(LOCATION_PRO_PARAM)) n++
  if (params.get(SORT_PARAM) && params.get(SORT_PARAM) !== DEFAULT_SORT) n++
  if (params.get(MIN_AD_PRICE_PARAM)) n++
  if (params.get(MAX_AD_PRICE_PARAM)) n++
  return n
}

// ─── Reusable cascading select ────────────────────────────────────────────────
function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
  placeholder = "Select...",
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  disabled?: boolean
  placeholder?: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={cn(
            "w-full h-10 rounded-sm border bg-background px-3 pr-8 text-sm appearance-none",
            "focus:outline-none focus:ring-2 focus:ring-ring transition-colors",
            disabled
              ? "opacity-40 cursor-not-allowed bg-muted text-muted-foreground"
              : "cursor-pointer hover:border-ring"
          )}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function MoreFilters() {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  const [open, setOpen] = useState(false)

  // ── Draft state ──────────────────────────────────────────────────────────
  const [keyword,  setKeyword]  = useState("")
  const [sort,     setSort]     = useState<SortValue>(DEFAULT_SORT)
  const [date,     setDate]     = useState<DateValue>("")
  const [proId,    setProId]    = useState("")
  const [disId,    setDisId]    = useState("")
  const [comId,    setComId]    = useState("")
  const [minPrice, setMinPrice] = useState("")
  const [maxPrice, setMaxPrice] = useState("")

  // Sync draft from URL whenever dialog opens
  useEffect(() => {
    if (!open) return
    // Sync draft from URL each time the dialog opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKeyword(searchParams.get(KEYWORD_PARAM)      ?? "")
    setSort((searchParams.get(SORT_PARAM)  as SortValue) ?? DEFAULT_SORT)
    setDate((searchParams.get(DATE_PARAM)  as DateValue) ?? "")
    setProId(searchParams.get(LOCATION_PRO_PARAM)   ?? "")
    setDisId(searchParams.get(LOCATION_DIS_PARAM)   ?? "")
    setComId(searchParams.get(LOCATION_COM_PARAM)   ?? "")
    setMinPrice(searchParams.get(MIN_AD_PRICE_PARAM) ?? "")
    setMaxPrice(searchParams.get(MAX_AD_PRICE_PARAM) ?? "")
  }, [open, searchParams])

  // ── Location cascade options ─────────────────────────────────────────────
  const provinceOptions = locations.map((p) => ({ value: p.proId, label: p.name }))

  const selectedProvince = locations.find((p) => p.proId === proId)
  const districtOptions  = (selectedProvince?.districts ?? []).map((d) => ({
    value: d.disId, label: d.name,
  }))

  const selectedDistrict = selectedProvince?.districts.find((d) => d.disId === disId)
  const communeOptions   = (selectedDistrict?.communes ?? []).map((c) => ({
    value: c.comId, label: c.name,
  }))

  const handleProvinceChange = (v: string) => { setProId(v); setDisId(""); setComId("") }
  const handleDistrictChange = (v: string) => { setDisId(v); setComId("") }

  // ── Write all params to URL at once ─────────────────────────────────────
  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString())
    const set = (key: string, val: string) =>
      val.trim() ? params.set(key, val.trim()) : params.delete(key)

    set(KEYWORD_PARAM, keyword)
    set(DATE_PARAM, date)
    if (sort === DEFAULT_SORT) {
      params.delete(SORT_PARAM)
    } else {
      params.set(SORT_PARAM, sort)
    }
    set(LOCATION_PRO_PARAM, proId)
    set(LOCATION_DIS_PARAM, disId)
    set(LOCATION_COM_PARAM, comId)
    set(MIN_AD_PRICE_PARAM, minPrice)
    set(MAX_AD_PRICE_PARAM, maxPrice)

    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    setOpen(false)
  }

  // ── Clear everything ─────────────────────────────────────────────────────
  const clearAll = () => {
    setKeyword(""); setSort(DEFAULT_SORT); setDate("")
    setProId(""); setDisId(""); setComId("")
    setMinPrice(""); setMaxPrice("")
    router.replace(pathname, { scroll: false })
    setOpen(false)
  }
  const activeCount = countActiveFilters(searchParams)
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* ── Trigger ─────────────────────────────────────────────────────── */}
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="relative bg-muted rounded-sm h-12 px-3 text-sm cursor-pointer gap-2"
        >
          <IconFilterCog className="h-4 w-4 shrink-0" />
          <span>More Filters</span>
          {activeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white leading-none">
              {activeCount}
            </span>
          )}
        </Button>
      </DialogTrigger>
      {/* ── Dialog ──────────────────────────────────────────────────────── */}
      <DialogContent
        showCloseButton={false}
        className="flex flex-col gap-0 p-0 max-w-md w-full max-h-[90vh] rounded-sm overflow-hidden"
      >
        {/* Header */}
        <DialogHeader className="flex-row items-center justify-between px-5 py-4 border-b shrink-0 gap-0">
          <DialogTitle className="text-base font-semibold">More Filters</DialogTitle>
          <div className="flex items-center gap-4">
            <button
              onClick={clearAll}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Clear all
            </button>
            <DialogClose className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-5 py-5 space-y-5 flex-1">

          {/* Search */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Search</label>
            <Input
              placeholder="Search keywords..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="h-10 rounded-sm"
            />
          </div>
          {/* Sort */}
          <SelectField
            label="Sort"
            value={sort}
            onChange={(v) => setSort(v as SortValue)}
            options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            placeholder="Default"
          />
          {/* Date */}
          <SelectField
            label="Date"
            value={date}
            onChange={(v) => setDate(v as DateValue)}
            options={DATE_OPTIONS.filter((o) => o.value !== "").map((o) => ({
              value: o.value, label: o.label,
            }))}
            placeholder="All Time"
          />
          {/* Location — cascading */}
          <div className="space-y-3">
            <SelectField
              label="City / Province"
              value={proId}
              onChange={handleProvinceChange}
              options={provinceOptions}
              placeholder="Select province..."
            />
            <SelectField
              label="Khan / District"
              value={disId}
              onChange={handleDistrictChange}
              options={districtOptions}
              disabled={!proId}
              placeholder={proId ? "Select district..." : "Select province first"}
            />
            <SelectField
              label="Sangkat / Commune"
              value={comId}
              onChange={setComId}
              options={communeOptions}
              disabled={!disId}
              placeholder={disId ? "Select commune..." : "Select district first"}
            />
          </div>
          {/* Price */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground ">Price</label>
            <div className="flex gap-3 mt-2">
              <Input
                type="number"
                placeholder="Minimum $"
                value={minPrice}
                min={0}
                onChange={(e) => setMinPrice(e.target.value)}
                className="h-10 rounded-sm"
              />
              <Input
                type="number"
                placeholder="Maximum $"
                value={maxPrice}
                min={0}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="h-10 rounded-sm"
              />
            </div>
          </div>
        </div>
        {/* Footer */}
        <DialogFooter className="p-8 rounded-none bg-background shrink-0 sm:flex-row sm:justify-stretch">
          <Button
            onClick={applyFilters}
            className="w-full h-10 rounded-sm bg-orange-500 hover:bg-orange-600 text-white cursor-pointer font-semibold"
          >
            Apply Filter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}