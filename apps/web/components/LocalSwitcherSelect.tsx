"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Locale, routing, usePathname, useRouter } from "@/i18n/routing";
import { useParams } from "next/navigation";
import Image from "next/image";

const flagMap: Record<string, { name: string; url: string }> = {
  en: { name: "English", url: "/flag/uk.png" },
  km: { name: "ខ្មែរ", url: "/flag/khmer.png" },
  zh: { name: "中文", url: "/flag/zh.png" },
};

export default function LocaleSwitcherSelect({
  defaultValue,
  label,
}: {
  defaultValue: string;
  label: string;
}) {
  
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();

  function onSelectChange(nextLocale: string) {
    router.replace(
      // @ts-expect-error -- validation handled by i18n routing
      { pathname, params },
      { locale: nextLocale as Locale }
    );
  }

  return (
    <Select value={defaultValue} onValueChange={onSelectChange}>
      <SelectTrigger
        className="group w-10 h-12 bg-transparent border-none hover:bg-black/5 dark:hover:bg-white/10 data-[state=open]:bg-black/5 dark:data-[state=open]:bg-white/10 transition-all focus:ring-0 focus:ring-offset-0 shadow-none flex items-center justify-center rounded-xl p-0 [&>svg]:hidden cursor-pointer"
        aria-label={label}
      >
        <SelectValue>
          <div className="relative w-6 h-6">
            <Image
              src={flagMap[defaultValue]?.url ?? "/flag/uk.png"}
              alt="selected flag"
              fill
              unoptimized
              className="rounded-full object-cover shadow-sm"
            />
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        position="popper"
        align="center"
        sideOffset={8}
        className="min-w-[180px] bg-card rounded-xl p-1 shadow-2xl border-muted/20"
      >
        {routing.locales.map((locale) => {
          const isActive = locale === defaultValue;
          return (
            <SelectItem
              key={locale}
              value={locale}
              className="cursor-pointer rounded-lg focus:bg-muted focus:text-foreground py-2 px-3 transition-colors"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <div className="relative w-6 h-6 shrink-0">
                    <Image
                      src={flagMap[locale]?.url}
                      alt={locale}
                      width={24}
                      height={24}
                      unoptimized
                      className="rounded-full object-cover border border-muted/10"
                    />
                  </div>
                  <span className={`text-sm font-medium ${isActive ? "text-[#00a0e9]" : "text-foreground"}`}>
                    {flagMap[locale]?.name}
                  </span>
                </div>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}