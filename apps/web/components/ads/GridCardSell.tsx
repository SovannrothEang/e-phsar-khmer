"use client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";

/**
 * The Sell promo that leads the browse grids.
 *
 * It is a grid sibling of `GridCardPost`, so a populated row stretches it to
 * the listing card's height; an empty feed has no sibling to stretch it, and
 * it collapsed to its own content (210px) instead of the listing card's box
 * (captain, 2026-11-19: "make it have its own size ... the exact size like
 * when it has data"). `min-h-[20.75rem]` is that box: 13rem photo band + 1rem
 * card gap + 1.5rem title + 0.25rem gap + 1.5rem meta row + 0.25rem gap +
 * 2.75rem price/heart row + 0.5rem card bottom padding. Recompute it if
 * `GridCardPost`'s box changes — with results present the row height still
 * wins (a card carrying a condition line is ~1.22rem taller).
 */
export function GridCardSell() {
  const router = useRouter();
  const t = useTranslations("Card");
  return (
    <Card className="mx-auto min-h-[20.75rem] w-full max-w-md flex flex-col bg-gradient-to-b from-[#00a0e9] to-[#00a0e9] text-white rounded-sm shadow-lg">
      <CardHeader>
        <CardTitle className="text-center py-2 ">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-center type-body px-2  opacity-90">{t("des")}</p>
      </CardContent>
      <CardFooter className="mt-auto p-3 border-none leading-relaxed ">
        <Button
          onClick={() => router.push({ pathname: "/post" })}
          size="sm"
          className="w-full bg-card rounded text-foreground px-18 py-4 type-nav hover:bg-muted cursor-pointer"
        >
          {t("button_post_ad")}
        </Button>
      </CardFooter>
    </Card>
  );
}
