"use client";
import * as React from "react";
import { ChevronRight, ChevronLeft, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { locations, Province, District, Commune } from "@/lib/location";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Post } from "@/lib/posts";
// ─── URL param keys ────────────────────────────────────────────────────────────
export const LOCATION_PRO_PARAM = "loc_pro";
export const LOCATION_DIS_PARAM = "loc_dis";
export const LOCATION_COM_PARAM = "loc_com";
// ─── Post filter helper (same pattern as filterPostsByPrice) ──────────────────
export function filterPostsByLocation(
  posts: Post[],
  proId?: string,
  disId?: string,
): Post[] {
  if (!proId && !disId) return posts;
  return posts.filter((post) => {
    if (proId && post.proId !== proId) return false;
    if (disId && post.disId !== disId) return false;
    return true;
  });
}
// ─── Step types ────────────────────────────────────────────────────────────────
type Step = "province" | "district" | "commune";
interface Selection {
  province: Province | null;
  district: District | null;
  commune: Commune | null;
}
// ─── Resolve a Selection from URL params ──────────────────────────────────────
function resolveSelectionFromParams(
  proId: string | null,
  disId: string | null,
  comId: string | null,
): Selection {
  const province = proId
    ? (locations.find((p) => p.proId === proId) ?? null)
    : null;
  const district =
    province && disId
      ? (province.districts.find((d) => d.disId === disId) ?? null)
      : null;
  const commune =
    district && comId
      ? (district.communes.find((c) => c.comId === comId) ?? null)
      : null;
  return { province, district, commune };
}
// ─── Label builder ─────────────────────────────────────────────────────────────
function buildLabel(selection: Selection, placeholder: string): string {
  if (selection.commune) return selection.commune.name;
  if (selection.district) return selection.district.name;
  if (selection.province) return selection.province.name;
  return placeholder;
}
// ─── Component ────────────────────────────────────────────────────────────────
interface LocationSelectorProps {
  placeholder?: string;
}
export function LocationSelectorFilter({
  placeholder = "Location",
}: LocationSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const proParam = searchParams.get(LOCATION_PRO_PARAM);
  const disParam = searchParams.get(LOCATION_DIS_PARAM);
  const comParam = searchParams.get(LOCATION_COM_PARAM);
  // Derive current selection directly from URL params — single source of truth
  const selection = React.useMemo(
    () => resolveSelectionFromParams(proParam, disParam, comParam),
    [proParam, disParam, comParam],
  );
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<Step>("province");
  // Local draft while the user is navigating the drill-down (before they commit)
  const [draft, setDraft] = React.useState<Selection>(selection);
  // Sync draft when popover opens so it reflects the current URL state
  const handleOpenChange = (o: boolean) => {
    setOpen(o);
    if (o) {
      setDraft(selection);
      setStep(selection.province ? "district" : "province");
    }
  };
  // ── Write to URL ─────────────────────────────────────────────────────────────
  function pushLocation(sel: Selection) {
    const params = new URLSearchParams(searchParams.toString());
    if (sel.province) {
      params.set(LOCATION_PRO_PARAM, sel.province.proId);
    } else {
      params.delete(LOCATION_PRO_PARAM);
    }
    if (sel.district) {
      params.set(LOCATION_DIS_PARAM, sel.district.disId);
    } else {
      params.delete(LOCATION_DIS_PARAM);
    }
    if (sel.commune) {
      params.set(LOCATION_COM_PARAM, sel.commune.comId);
    } else {
      params.delete(LOCATION_COM_PARAM);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }
  // ── Step handlers ─────────────────────────────────────────────────────────────
  const selectProvince = (province: Province) => {
    const next: Selection = { province, district: null, commune: null };
    setDraft(next);
    setStep("district");
  };
  const selectDistrict = (district: District) => {
    const next: Selection = { ...draft, district, commune: null };
    if (district.communes.length > 0) {
      setDraft(next);
      setStep("commune");
    } else {
      pushLocation(next);
      setOpen(false);
    }
  };
  const selectCommune = (commune: Commune) => {
    const next: Selection = { ...draft, commune };
    pushLocation(next);
    setOpen(false);
  };
  // "Show all ads in <province/district>" — commits without going deeper
  const showAll = () => {
    if (step === "district") {
      pushLocation({ province: draft.province, district: null, commune: null });
    } else if (step === "commune") {
      pushLocation({ ...draft, commune: null });
    }
    setOpen(false);
  };
  const goBack = () => {
    if (step === "commune") setStep("district");
    else if (step === "district") setStep("province");
  };
  const clearSelection = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    pushLocation({ province: null, district: null, commune: null });
  };
  // ── Derived display values ────────────────────────────────────────────────────
  const hasSelection = !!selection.province;
  const locationLabel = buildLabel(selection, placeholder);
  const showAllLabel: string | null = {
    province: null,
    district: `Show all ads in ${draft.province?.name}`,
    commune: `Show all ads in ${draft.district?.name}`,
  }[step];
  const items: { id: string; name: string; hasChildren: boolean }[] =
    step === "province"
      ? locations.map((p) => ({ id: p.proId, name: p.name, hasChildren: true }))
      : step === "district"
        ? (draft.province?.districts ?? []).map((d) => ({
            id: d.disId,
            name: d.name,
            hasChildren: d.communes.length > 0,
          }))
        : (draft.district?.communes ?? []).map((c) => ({
            id: c.comId,
            name: c.name,
            hasChildren: false,
          }));
  return (
    <div className="relative inline-flex items-center">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "flex items-center bg-muted rounded-sm gap-2 h-12 py-1.5 text-sm cursor-pointer whitespace-nowrap",
              hasSelection ? "text-foreground border-muted pr-7 pl-3" : "px-3",
            )}
          >
            <MapPin
              className={cn(
                "h-4 w-4 shrink-0",
                hasSelection ? "text-sky-500" : "text-foreground",
              )}
            />
            <span className={hasSelection ? "text-sky-500" : ""}>
              {locationLabel}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="rounded-sm w-70 p-0 mt-3" align="start">
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2.5">
            {step !== "province" && (
              <button
                onClick={goBack}
                className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <span className="text-sm flex-1 text-center pr-4">Location</span>
          </div>
          <Separator />
          {/* "Show all" shortcut */}
          {showAllLabel && (
            <button
              onClick={showAll}
              className="w-full text-left px-4 py-2 text-sm text-primary hover:bg-muted/50 transition-colors border-b cursor-pointer"
            >
              {showAllLabel}
            </button>
          )}
          {/* Item list */}
          <div className="max-h-[320px] overflow-y-auto">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (step === "province") {
                    const prov = locations.find((p) => p.proId === item.id)!;
                    selectProvince(prov);
                  } else if (step === "district") {
                    const dist = draft.province!.districts.find(
                      (d) => d.disId === item.id,
                    )!;
                    selectDistrict(dist);
                  } else {
                    const com = draft.district!.communes.find(
                      (c) => c.comId === item.id,
                    )!;
                    selectCommune(com);
                  }
                }}
                className="flex items-center justify-between w-full px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors text-left cursor-pointer"
              >
                <span>{item.name}</span>
                {item.hasChildren && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </button>
            ))}
          </div>
          <Separator />
        </PopoverContent>
      </Popover>
      {/* Clear (X) button — outside trigger so it doesn't open the popover */}
      {hasSelection && (
        <button
          type="button"
          onClick={clearSelection}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-0.5 rounded-full hover:bg-background/80 transition-colors cursor-pointer"
          aria-label="Clear location filter"
        >
          <X className="h-3.5 w-3.5 shrink-0 text-foreground" />
        </button>
      )}
    </div>
  );
}
