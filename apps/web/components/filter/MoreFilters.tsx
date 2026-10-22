"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  CONDITION_OPTIONS,
  CONDITION_PARAM,
  DATE_OPTIONS,
  DATE_PARAM,
  DELIVERY_PARAM,
  ENGINE_PARAM,
  FILTER_PARAMS,
  LOCATION_COM_PARAM,
  LOCATION_DIS_PARAM,
  LOCATION_PRO_PARAM,
  MAX_AD_PRICE_PARAM,
  MIN_AD_PRICE_PARAM,
  Q_PARAM,
  SORT_PARAM,
  YEAR_MAX_PARAM,
  YEAR_MIN_PARAM,
  defaultSortFor,
  hasQueryParam,
  normalizeQuery,
  parseSortParam,
  sortOptionsFor,
  type DateValue,
  type SortValue,
} from "@/lib/search-params";
import { useCommunes, useDistricts, useProvinces } from "./use-locations";
import { IconFilterCog } from "@tabler/icons-react";

// The keyword is the same `q` the header search bar writes — one keyword
// param everywhere. Re-exported for existing importers.
export const KEYWORD_PARAM = Q_PARAM;
export { DATE_PARAM, DATE_OPTIONS };
export type { DateValue };

// ─── Active filter badge count ────────────────────────────────────────────────
function countActiveFilters(params: URLSearchParams): number {
  let n = 0;
  if (params.get(Q_PARAM)) n++;
  if (params.get(DATE_PARAM)) n++;
  if (params.get(LOCATION_PRO_PARAM)) n++;
  const sort = params.get(SORT_PARAM);
  if (sort && sort !== defaultSortFor(hasQueryParam(params))) n++;
  if (params.get(MIN_AD_PRICE_PARAM)) n++;
  if (params.get(MAX_AD_PRICE_PARAM)) n++;
  if (params.get(CONDITION_PARAM)) n++;
  if (params.get(DELIVERY_PARAM)) n++;
  if (params.get(YEAR_MIN_PARAM) || params.get(YEAR_MAX_PARAM)) n++;
  if (params.get(ENGINE_PARAM)) n++;
  return n;
}

// ─── Reusable cascading select ────────────────────────────────────────────────
function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  placeholder: string;
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
              : "cursor-pointer hover:border-ring",
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
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function MoreFilters() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [open, setOpen] = useState(false);

  // ── Draft state ──────────────────────────────────────────────────────────
  const [keyword, setKeyword] = useState("");
  const [sort, setSort] = useState<SortValue>(defaultSortFor(false));
  // The draft keyword decides which sorts exist and which one is the default.
  const draftHasQuery = normalizeQuery(keyword) !== "";
  const [date, setDate] = useState<DateValue>("");
  const [proId, setProId] = useState("");
  const [disId, setDisId] = useState("");
  const [comId, setComId] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [condition, setCondition] = useState("");
  const [delivery, setDelivery] = useState(false);

  // Sync draft from URL whenever dialog opens
  useEffect(() => {
    if (!open) return;
    // Sync draft from URL each time the dialog opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKeyword(searchParams.get(Q_PARAM) ?? "");
    setSort(
      parseSortParam(searchParams.get(SORT_PARAM), hasQueryParam(searchParams)),
    );
    setDate((searchParams.get(DATE_PARAM) as DateValue) ?? "");
    setProId(searchParams.get(LOCATION_PRO_PARAM) ?? "");
    setDisId(searchParams.get(LOCATION_DIS_PARAM) ?? "");
    setComId(searchParams.get(LOCATION_COM_PARAM) ?? "");
    setMinPrice(searchParams.get(MIN_AD_PRICE_PARAM) ?? "");
    setMaxPrice(searchParams.get(MAX_AD_PRICE_PARAM) ?? "");
    setCondition(searchParams.get(CONDITION_PARAM) ?? "");
    setDelivery(searchParams.get(DELIVERY_PARAM) === "1");
  }, [open, searchParams]);

  // ── Location cascade options ─────────────────────────────────────────────
  // Real geography; the values are the slugs the URL and backend use.
  const toOptions = (rows: { slug: string; name: string }[] | undefined) =>
    (rows ?? []).map((r) => ({ value: r.slug, label: r.name }));
  const provinceOptions = toOptions(useProvinces(open).data);
  const districtOptions = toOptions(useDistricts(open ? proId : null).data);
  const communeOptions = toOptions(
    useCommunes(open ? proId : null, open ? disId : null).data,
  );

  const handleProvinceChange = (v: string) => {
    setProId(v);
    setDisId("");
    setComId("");
  };
  const handleDistrictChange = (v: string) => {
    setDisId(v);
    setComId("");
  };

  // ── Write all params to URL at once ─────────────────────────────────────
  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    const set = (key: string, val: string) =>
      val.trim() ? params.set(key, val.trim()) : params.delete(key);

    set(Q_PARAM, normalizeQuery(keyword));
    set(DATE_PARAM, date);
    // Re-validate against the draft keyword: "best-match" without one is moot.
    const finalSort = parseSortParam(sort, draftHasQuery);
    if (finalSort === defaultSortFor(draftHasQuery)) {
      params.delete(SORT_PARAM);
    } else {
      params.set(SORT_PARAM, finalSort);
    }
    set(LOCATION_PRO_PARAM, proId);
    set(LOCATION_DIS_PARAM, disId);
    set(LOCATION_COM_PARAM, comId);
    set(MIN_AD_PRICE_PARAM, minPrice);
    set(MAX_AD_PRICE_PARAM, maxPrice);
    set(CONDITION_PARAM, condition);
    set(DELIVERY_PARAM, delivery ? "1" : "");

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
    setOpen(false);
  };

  // ── Clear everything ─────────────────────────────────────────────────────
  const clearAll = () => {
    setKeyword("");
    setSort(defaultSortFor(false));
    setDate("");
    setProId("");
    setDisId("");
    setComId("");
    setMinPrice("");
    setMaxPrice("");
    setCondition("");
    setDelivery(false);
    // Only the filter params — a subcategory page's brand/type drill-down and
    // the search page's category stay put.
    const params = new URLSearchParams(searchParams.toString());
    for (const key of FILTER_PARAMS) params.delete(key);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
    setOpen(false);
  };
  const activeCount = countActiveFilters(searchParams);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* ── Trigger ─────────────────────────────────────────────────────── */}
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="relative bg-muted rounded-sm h-12 px-3 text-sm cursor-pointer gap-2"
        >
          <IconFilterCog className="h-4 w-4 shrink-0" />
          <span>{t("Filters.more.title")}</span>
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
          <DialogTitle className="text-base font-semibold">
            {t("Filters.more.title")}
          </DialogTitle>
          <div className="flex items-center gap-4">
            <button
              onClick={clearAll}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {t("Filters.more.clearAll")}
            </button>
            <DialogClose className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-5 py-5 space-y-5 flex-1">
          {/* Search */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              {t("Filters.more.search")}
            </label>
            <Input
              placeholder={t("Filters.more.searchPlaceholder")}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="h-10 rounded-sm"
            />
          </div>
          {/* Sort */}
          <SelectField
            label={t("Filters.sort.label")}
            value={sort}
            onChange={(v) => setSort(v as SortValue)}
            options={sortOptionsFor(draftHasQuery).map((o) => ({
              value: o.value,
              label: t(o.labelKey),
            }))}
            placeholder={t("Filters.more.default")}
          />
          {/* Date */}
          <SelectField
            label={t("Filters.date.label")}
            value={date}
            onChange={(v) => setDate(v as DateValue)}
            options={DATE_OPTIONS.filter((o) => o.value !== "").map((o) => ({
              value: o.value,
              label: t(o.labelKey),
            }))}
            placeholder={t("Filters.date.allTime")}
          />
          {/* Location — cascading */}
          <div className="space-y-3">
            <SelectField
              label={t("Filters.more.cityProvince")}
              value={proId}
              onChange={handleProvinceChange}
              options={provinceOptions}
              placeholder={t("Filters.more.selectProvince")}
            />
            <SelectField
              label={t("Filters.more.khanDistrict")}
              value={disId}
              onChange={handleDistrictChange}
              options={districtOptions}
              disabled={!proId}
              placeholder={
                proId
                  ? t("Filters.more.selectDistrict")
                  : t("Filters.more.selectProvinceFirst")
              }
            />
            <SelectField
              label={t("Filters.more.sangkatCommune")}
              value={comId}
              onChange={setComId}
              options={communeOptions}
              disabled={!disId}
              placeholder={
                disId
                  ? t("Filters.more.selectCommune")
                  : t("Filters.more.selectDistrictFirst")
              }
            />
          </div>
          {/* Condition */}
          <SelectField
            label={t("Filters.condition.label")}
            value={condition}
            onChange={setCondition}
            options={CONDITION_OPTIONS.map((o) => ({
              value: o.value,
              label: t(o.labelKey),
            }))}
            placeholder={t("Filters.more.any")}
          />
          {/* Free delivery */}
          <label className="flex items-center justify-between gap-3 text-sm font-medium text-foreground cursor-pointer">
            {t("Filters.more.freeDeliveryOnly")}
            <Switch checked={delivery} onCheckedChange={setDelivery} />
          </label>
          {/* Price */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground ">
              {t("Filters.price.label")}
            </label>
            <div className="flex gap-3 mt-2">
              <Input
                type="number"
                placeholder={t("Filters.price.min")}
                value={minPrice}
                min={0}
                onChange={(e) => setMinPrice(e.target.value)}
                className="h-10 rounded-sm"
              />
              <Input
                type="number"
                placeholder={t("Filters.price.max")}
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
            {t("Common.applyFilter")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
