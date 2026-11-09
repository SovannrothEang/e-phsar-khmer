"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { FieldLabel } from "@/components/post/FieldLabel";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import DbImage from "@/components/common/DbImage";

/**
 * Searchable picker for long option lists (91+ brands, a brand's models):
 * the trigger opens a panel with a Search field over a scrolling list. Images
 * go through DbImage, so only Storage-backed icons render; the logo slot is
 * kept only when the option set actually carries images.
 */
export function SearchPicker({
  label,
  options,
  value,
  onChange,
  required,
  disabled,
  placeholder,
  emptyLabel,
  showOnlyKm,
  resolveInput,
}: {
  label: string;
  options: {
    id: string;
    name: string;
    nameKm?: string | null;
    image?: string | null;
  }[];
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
  /** Inert until its parent choice is made (a disabled button fires no click,
   *  so the popover can never open); renders empty rather than a placeholder. */
  disabled?: boolean;
  placeholder?: string;
  emptyLabel?: string;
  /** Drop the English half of `nameKm/name` (colours and the range pickers). */
  showOnlyKm?: boolean;
  /**
   * Optional paste resolver (the Product Spec picker): a pasted product URL is
   * matched against the loaded options and selected outright. Normal search
   * filtering is untouched — a miss simply falls through to it.
   */
  resolveInput?: (text: string) => { id: string; name: string } | null;
}) {
  const t = useTranslations("PostForm");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  /**
   * Inline pick-list ranges (storage / screen size / RAM / VGA) carry no
   * `nameKm` in the DB — their seeded options are strings like "1TB & Above".
   * Translate only the words; the number/unit prefix is already universal and
   * the stored value stays the English option name.
   */
  const kmOptionLabel = (name: string): string | null => {
    if (name === "Integrated") return t("options.integrated");
    const above = name.match(/^(.*?)\s*&\s*(?:Above|Larger)$/);
    if (above) return t("options.andAbove", { value: above[1] });
    const below = name.match(/^(.*?)\s*(?:&\s*(?:Under|Below)|or below)$/);
    if (below) return t("options.andBelow", { value: below[1] });
    return null;
  };
  const optionKm = (option: { name: string; nameKm?: string | null }) =>
    option.nameKm ?? (locale === "km" ? kmOptionLabel(option.name) : null);
  /** Bilingual on km ("សេដាន/Sedan"); the stored value stays the English name. */
  const displayName = (option: { name: string; nameKm?: string | null }) => {
    const km = optionKm(option);
    return locale === "km" && km
      ? showOnlyKm
        ? km
        : `${km}/${option.name}`
      : option.name;
  };
  const selected = options.find((o) => o.id === value);
  const withIcons = options.some((o) => !!o.image);

  return (
    <div>
      <FieldLabel label={label} required={required} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            // Keyboard paste on the focused (closed) trigger: the placeholder
            // invites pasting a link, so it must work before the panel opens
            // too — clicking the trigger opens the panel and pastes land in
            // the CommandInput instead.
            onPaste={
              resolveInput
                ? (event) => {
                    const hit = resolveInput(
                      event.clipboardData.getData("text"),
                    );
                    if (!hit) return;
                    event.preventDefault();
                    onChange(hit.id);
                  }
                : undefined
            }
            className={`flex w-full items-center justify-between rounded-lg border border-border px-3 py-2.5 text-left type-body focus:outline-none ${
              disabled
                ? "cursor-not-allowed bg-muted text-muted-foreground"
                : "cursor-pointer text-foreground focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            }`}
          >
            <span className={selected ? "" : "text-muted-foreground"}>
              {selected
                ? displayName(selected)
                : disabled
                  ? ""
                  : (placeholder ?? t("chooseOption"))}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] p-0"
        >
          <Command>
            <CommandInput
              placeholder={t("search")}
              onPaste={
                resolveInput
                  ? (event) => {
                      const hit = resolveInput(
                        event.clipboardData.getData("text"),
                      );
                      if (!hit) return;
                      event.preventDefault();
                      onChange(hit.id);
                      setOpen(false);
                    }
                  : undefined
              }
            />
            <CommandList>
              <CommandEmpty>{emptyLabel ?? t("noMatch")}</CommandEmpty>
              {options.map((option) => {
                const km = optionKm(option);
                return (
                  <CommandItem
                    key={option.id}
                    value={km ? `${km} ${option.name}` : option.name}
                    onSelect={() => {
                      onChange(option.id);
                      setOpen(false);
                    }}
                    className="cursor-pointer"
                  >
                    {withIcons && (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                        <DbImage
                          src={option.image ?? ""}
                          alt=""
                          width={24}
                          height={24}
                          className="object-contain"
                        />
                      </span>
                    )}
                    <span>{displayName(option)}</span>
                  </CommandItem>
                );
              })}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
