"use client";

import { Locale, usePathname, useRouter } from "@/i18n/routing";
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
  label: string;
  icon: string;
};

const languages: Language[] = [
  {
    value: "en",
    label: "English",
    icon: "/flag/uk.png",
  },
  {
    value: "km",
    label: "Khmer",
    icon: "/flag/khmer.png",
  },
  {
    value: "zh",
    label: "Chinese",
    icon: "/flag/zh.png",
  },
  {
    value: "ko",
    label: "Korean",
    icon: "/flag/south-korea.png",
  },
  {
    value: "id",
    label: "Indonesia",
    icon: "/flag/indonesia.png",
  },
  {
    value: "vi",
    label: "Vietnamese",
    icon: "/flag/vietnam.png",
  },
];

export default function LocalSelector({ defaultValue, label }: Props) {
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
              alt={defaultValue}
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
                  alt={lang.label}
                  width={20}
                  height={20}
                  className="rounded-md"
                />
                {lang.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
