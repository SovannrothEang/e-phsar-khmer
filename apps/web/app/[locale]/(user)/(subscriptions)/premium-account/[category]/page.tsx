"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { CircleCheck, House, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/routing";

const plansData = {
  auto: { photos: 24, ads: 30, renews: 10, auto_renews: 20, videos: 10 },
  food: { photos: 24, ads: 200, renews: 10, auto_renews: 20, videos: 20 },
  general: { photos: 24, ads: 200, renews: 20, auto_renews: 20, videos: 20 },
  property: { photos: 24, ads: 200, renews: 20, auto_renews: 20, videos: 20 },
  services: { photos: 24, ads: 30, renews: 10, auto_renews: 20, videos: 10 },
};

export default function PremiumPlanPage() {
  const params = useParams();

  const [selectedTerm, setSelectedTerm] = useState<"6months" | "1year">(
    "6months",
  );

  const category = (params.category as string) || "services";
  const data = plansData[category as keyof typeof plansData] || plansData.auto;

  const price6Months = 60;
  const price1Year = 100;
  const originalPrice1Year = 120;
  const savings = originalPrice1Year - price1Year;

  const currentPrice = selectedTerm === "6months" ? price6Months : price1Year;

  return (
    <div className="min-h-screen bg-muted pb-10 pt-4">
      <div className="max-w-7xl mx-auto ">
        {/* Breadcrumbs */}
        <nav className="flex items-center space-x-1 text-sm ">
          <Link
            href="/"
            className="group flex items-center transition-colors duration-150 text-foreground  group-hover:text-gray-300"
          >
            <House
              size={16}
              className="text-foreground  group-hover:text-gray-300"
            />
            <span className="text-foreground  group-hover:text-gray-300 pl-1.5">
              Home
            </span>
          </Link>
          <ChevronRight size={16} className="block text-gray-500" />
          <Link
            href="/"
            className="group flex items-center transition-colors duration-150 text-gray-500 dark:text-gray-400 hover:text-blue-300"
          >
            <span className="text-foreground  group-hover:text-gray-300 pl-1.5">
              Profile
            </span>
          </Link>
          <ChevronRight size={16} className="block text-gray-500" />
          <Link
            href={{ pathname: "/membership" }}
            className="group flex items-center transition-colors duration-150 text-gray-500 dark:text-gray-400 hover:text-blue-300"
          >
            <span className="text-foreground  group-hover:text-gray-300 pl-1.5">
              Membership
            </span>
          </Link>
          <ChevronRight size={16} className="block text-gray-500" />
          <Link
            href={{ pathname: "/premium-account", query: { id: "me" } }}
            className="group flex items-center transition-colors duration-150 text-gray-500 dark:text-gray-400 hover:text-blue-300"
          >
            <span className="text-foreground  group-hover:text-gray-300 pl-1.5">
              Premium Account
            </span>
          </Link>
          <ChevronRight size={16} className="block text-gray-500" />
          <h1 className="text-gray-500 dark:text-gray-400 capitalize">
            {category}
          </h1>
        </nav>
      </div>

      <main className="max-w-4xl mx-auto px-4">
        <h1 className="text-xl font-semibold text-foreground mb-4 mt-6">
          Choose the right plan for your bussiness
        </h1>
        <div className="bg-card border-2 border-sky-400 rounded-md p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Bronze</h2>
            <p className="text-base font-medium mt-2">
              Start From 60 $ For 6 Months
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-1 mb-4">
            {Object.entries(data).map(([key, val]) => (
              <li
                key={key}
                className="flex items-center gap-2 text-sm text-gray-600"
              >
                <CircleCheck size={16} className="text-sky-400" />
                <span className="capitalize">
                  {key} {val}
                </span>
              </li>
            ))}
          </ul>

          <div className="space-y-1">
            <p className="text-sm">Term</p>

            <div className="border bg-card rounded-sm overflow-hidden">
              {/* ===== 6 MONTHS ===== */}
              <label
                className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-all
                  ${
                    selectedTerm === "6months" ? "bg-muted" : "hover:bg-muted"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    checked={selectedTerm === "6months"}
                    onChange={() => setSelectedTerm("6months")}
                    className="w-4 h-4 accent-sky-500"
                  />
                  <span className="font-semibold">6 Months</span>
                </div>

                <span className="text-sky-600 font-medium">
                  ${price6Months}
                </span>
              </label>

              <div className="border-t" />

              <label
                className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-all
                ${selectedTerm === "1year" ? "bg-muted" : "hover:bg-muted"}`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    checked={selectedTerm === "1year"}
                    onChange={() => setSelectedTerm("1year")}
                    className="w-4 h-4 accent-sky-500"
                  />

                  <div className="flex items-center gap-2">
                    <span className="font-semibold">1 Year</span>

                    {/* DISCOUNT BADGE */}
                    <span className="bg-red-100 text-red-500 text-[10px] font-bold px-1.5 py-0.5 rounded">
                      -${savings}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  {/* OLD PRICE */}
                  <span className="line-through italic text-foreground text-base mr-2">
                    ${originalPrice1Year}
                  </span>

                  {/* NEW PRICE */}
                  <span className="text-sky-600 font-medium ">
                    ${price1Year}
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>
        <div className="mt-4 bg-card border rounded-sm p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-foreground">
              Bronze {selectedTerm === "6months" ? "6 Months" : "1 Year"}
              {selectedTerm === "1year" && (
                <span className="ml-2 bg-red-100 text-red-500 text-sm px-2 py-0.5 rounded">
                  -{savings} $
                </span>
              )}
            </span>
            <span className="text-sky-600 text-lg">
              {selectedTerm === "1year" && (
                <span className="line-through italic text-gray-500 line-through text-lg mr-2">
                  ${originalPrice1Year}
                </span>
              )}
              ${currentPrice}
            </span>
          </div>

          <Link
            href={{
              pathname: "/checkout",
              query: { id: "me" },
            }}
            className="block w-full bg-orange-500  hover:bg-orange-600 text-card text-center text-sm py-2.5 rounded-sm font-semibold transition-colors"
          >
            Subscribe Now
          </Link>
        </div>
      </main>
    </div>
  );
}
