"use client";

import { IconChevronRight } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/routing";

export default function Membership() {
  const t = useTranslations("Me.membership");
  const tMe = useTranslations("Me");
  const tSearch = useTranslations("Search");
  const router = useRouter();
  const insights = [
    { label: t("photo"), value: 8 },
    { label: t("videos"), value: t("none") },
    { label: t("carsForSale"), value: 2 },
    { label: t("vehiclesForRent"), value: 2 },
    { label: t("motorcyclesForSale"), value: 2 },
    { label: t("fashion"), value: 50 },
    { label: t("foods"), value: 50 },
    { label: t("otherAds"), value: 5 },
    { label: t("renews"), value: 5 },
    { label: t("autoRenews"), value: t("none") },
  ];
  return (
    <div className="min-h-screen bg-muted pb-2">
      <div className="max-w-7xl mx-auto py-4">
        <Breadcrumbs
          items={[
            { label: tSearch("home"), href: "/" },
            { label: tMe("profile"), href: "/me" },
            { label: t("title") },
          ]}
        />
      </div>
      <main className="max-w-4xl mx-auto px-4">
        <h1 className="text-2xl font-medium text-foreground mb-4">
          {t("title")}
        </h1>
        <div className="bg-card border  rounded-sm  overflow-hidden">
          <div className="px-4 py-4">
            <h2 className="text-lg text-center font-medium text-foreground">
              {t("free")}
            </h2>
          </div>
          <div className="divide-y divide-muted">
            {insights.map((item, index) => (
              <div
                key={index}
                className="px-4 py-4 flex items-start justify-between"
              >
                <div className="space-y-1">
                  <h3 className="text-sm text-foreground">{item.label}</h3>
                </div>
                <div className="text-sm text-foreground">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
        <Link
          href={{ pathname: "/premium-account", query: { id: "me" } }}
          className="block mt-4"
        >
          <div className="bg-card border flex items-center justify-between rounded-sm overflow-hidden mt-2">
            <div className="space-y-1">
              <p className="text-lg font-semibold  px-4 pt-3">
                {t("needMore")}
              </p>
              <span className="text-sm px-4 block pb-3">
                {t("upgradeText")}
              </span>
            </div>
            <div className="flex items-center justify-center mr-3">
              <IconChevronRight
                size={20}
                className="text-[#00a0e9] group-hover:translate-x-2 transition-transform"
              />
            </div>
          </div>
        </Link>
        <Button
          onClick={() =>
            router.push({ pathname: "/premium-account", query: { id: "me" } })
          }
          className="text-card text-center cursor-pointer w-full rounded-sm h-9 mt-4 bg-[#00a0e9] hover:bg-[#00a0e9]/80"
        >
          {t("upgradeNow")}
        </Button>
      </main>
    </div>
  );
}
