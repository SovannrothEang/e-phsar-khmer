"use client";
import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { BadgeDollarSign } from "lucide-react";
import { Button } from "../ui/button";
import { useRouter } from "@/i18n/routing";
export default function Subscription() {
  const t = useTranslations("Me.subscriptions");
  const router = useRouter();
  return (
    <div className="min-w-full bg-muted pb-50 pt-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <h1 className="text-2xl font-medium text-foreground">{t("title")}</h1>

          <div className="flex items-center gap-3">
            <Select defaultValue="all">
              <SelectTrigger className="w-[140px] bg-card ">
                <SelectValue placeholder={t("typeAll")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("typeAll")}</SelectItem>
                <SelectItem value="ads">{t("ads")}</SelectItem>
                <SelectItem value="addons">{t("addons")}</SelectItem>
                <SelectItem value="account">{t("account")}</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="all">
              <SelectTrigger className="w-[140px] bg-card ">
                <SelectValue placeholder={t("statusAll")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("statusAll")}</SelectItem>
                <SelectItem value="expired">{t("expired")}</SelectItem>
                <SelectItem value="nearly">{t("nearly")}</SelectItem>
              </SelectContent>
            </Select>

            <Select defaultValue="old-new">
              <SelectTrigger className="w-[180px] bg-card ">
                <SelectValue placeholder={t("sortStart")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="old-new">{t("sortStartOldNew")}</SelectItem>
                <SelectItem value="new-old">{t("sortStartNewOld")}</SelectItem>
                <SelectItem value="end-old">{t("sortEndOldNew")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <main className="max-w-2xl mx-auto mt-4">
          <div className="bg-card rounded-sm shadow-sm  min-h-[450px] flex flex-col items-center justify-center p-8">
            <div className="w-32 h-32 bg-muted rounded-full flex items-center justify-center mb-8">
              <div className="relative">
                <BadgeDollarSign
                  className="w-12 h-12 text-muted-foreground"
                  strokeWidth={1.5}
                />
              </div>
            </div>

            <div className="text-center">
              <h2 className="text-xl font-medium text-foreground mb-2">
                {t("noResult")}
              </h2>
              <p className="text-muted-foreground text-sm mb-8">{t("empty")}</p>

              <Button
                onClick={() =>
                  router.push({
                    pathname: "/premium-account",
                    query: { id: "me" },
                  })
                }
                className="bg-orange-400 hover:bg-orange-600 text-card font-medium h-10 px-8 rounded-sm transition-colors cursor-pointer"
              >
                {t("subscribeNow")}
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
