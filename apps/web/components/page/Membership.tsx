"use client";

import { IconChevronRight } from "@tabler/icons-react";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/routing";

const insights = [
  { label: "Photo", value: 8 },
  { label: "Videos", value: "None" },
  { label: "Cars for sale", value: 2 },
  { label: "Vehicles for rent", value: 2 },
  { label: "Motorcycles for sale", value: 2 },
  { label: "Fashion & Beauty", value: 50 },
  { label: "Foods", value: 50 },
  { label: "Other Ads", value: 5 },
  { label: "Renews", value: 5 },
  { label: "Auto-Renews", value: "None" },
];

export default function Membership() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-muted pb-2">
      <div className="max-w-7xl mx-auto py-4">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Profile", href: "/me" },
            { label: "Membership" },
          ]}
        />
      </div>
      <main className="max-w-4xl mx-auto px-4">
        <h1 className="text-2xl font-medium text-foreground mb-4">
          Membership
        </h1>
        <div className="bg-card border  rounded-sm  overflow-hidden">
          <div className="px-4 py-4">
            <h2 className="text-lg text-center font-medium text-foreground">
              Free
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
              <p className="text-lg font-semibold  px-4 pt-3">Need More?</p>
              <span className="text-sm px-4 block pb-3">
                Upgrade to he right plan that better suits your bussiness.
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
          Upgrade Now
        </Button>
      </main>
    </div>
  );
}
