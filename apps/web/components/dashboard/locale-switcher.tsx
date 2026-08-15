"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { IconLanguage } from "@tabler/icons-react";
import { toast } from "@/components/ui/sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updateAdminLocale } from "@/actions/admin-locale";

const LOCALE_LABELS: Record<string, string> = {
  en: "English",
  km: "ខ្មែរ",
  zh: "中文",
  ko: "한국어",
  id: "Bahasa Indonesia",
  vi: "Tiếng Việt",
};

const LOCALES = Object.keys(LOCALE_LABELS);

/**
 * In-dashboard language switcher for the /wanderer/* admin surface. Reads the
 * current locale from the NextIntlClientProvider (sourced from the admin_locale
 * cookie), and on select calls the `updateAdminLocale` server action which sets
 * the cookie + PATCHes /users/me, then refreshes so the wanderer root layout
 * re-reads the cookie and re-renders in the new locale.
 */
export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleChange = (next: string) => {
    startTransition(async () => {
      const result = await updateAdminLocale(next);
      if (result.success) {
        router.refresh();
      } else {
        toast.error(result.error || "Failed to switch language");
      }
    });
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild className="cursor-pointer">
        <Button
          variant="ghost"
          size="icon-lg"
          disabled={isPending}
          className="h-10 w-10 hover:bg-muted/60 hover:rounded-full transition-all duration-200"
        >
          <IconLanguage stroke={2} className="h-[1.1rem] w-[1.1rem]" />
          <span className="sr-only">Switch language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        sideOffset={10}
        className="w-44 rounded-lg shadow-xl"
      >
        {LOCALES.map((code) => (
          <DropdownMenuItem
            key={code}
            onClick={() => handleChange(code)}
            className="flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer"
          >
            <span className="text-sm">{LOCALE_LABELS[code]}</span>
            {locale === code && (
              <div className="ml-auto h-2 w-2 rounded-full bg-[#00a0e9]" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
