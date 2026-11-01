"use client";

import { Locale, usePathname, useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Image from "next/image";
import { Button } from "./ui/button";
import { useState } from "react";

type Props = {
  defaultValue: string;
  label: string;
};

type Language = {
  value: string;
  icon: string;
};

const languages: Language[] = [
  {
    value: "en",
    icon: "/flag/uk.png",
  },
  {
    value: "km",
    icon: "/flag/khmer.png",
  },
];

export default function LocalSelector({ defaultValue, label }: Props) {
  const t = useTranslations("Nav");
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [open, setOpen] = useState(false);

  const handleChange = (value: string) => {
    setOpen(false);
    router.replace(
      // @ts-expect-error -- TypeScript will validate that only known `params`
      // are used in combination with a given `pathname`. Since the two will
      // always match for the current route, we can skip runtime checks.
      { pathname, params },
      { locale: value as Locale },
    );
  };

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon-lg" className="rounded-full">
            <Image
              src={`${languages.find((lang) => lang.value === defaultValue)?.icon}`}
              alt={t(`languages.${defaultValue}`)}
              width={20}
              height={20}
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-50">
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={defaultValue}
            onValueChange={handleChange}
          >
            {languages.map((lang) => (
              <DropdownMenuRadioItem
                key={lang.value}
                value={lang.value}
                className="cursor-pointer"
              >
                <Image
                  src={`${lang.icon}`}
                  alt={t(`languages.${lang.value}`)}
                  width={20}
                  height={20}
                  className="rounded-md"
                />
                {t(`languages.${lang.value}`)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
