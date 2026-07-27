"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdminStats } from "@/actions/admin-stats";
import type { AdminStats, StatMetric } from "@/lib/api/admin";
import { StatCard } from "./stat-card";

const EMPTY: StatMetric = { value: 0, changePct: 0, trend: "up" };

const CARDS: {
  key: keyof AdminStats;
  title: string;
  up: string;
  down: string;
  subtext: string;
}[] = [
  {
    key: "newUsers",
    title: "New Users",
    up: "Trending up this period",
    down: "Down this period",
    subtext: "New signups in the last 30 days",
  },
  {
    key: "activeListings",
    title: "Active Posts",
    up: "More active listings",
    down: "Fewer active listings",
    subtext: "Currently active listings",
  },
  {
    key: "totalListings",
    title: "Total Posts",
    up: "Growing catalog",
    down: "Slower this period",
    subtext: "All listings created",
  },
  {
    key: "totalUsers",
    title: "Total Users",
    up: "Steady growth",
    down: "Slower growth",
    subtext: "All active accounts",
  },
];

function fmtValue(n: number): string {
  return n.toLocaleString("en-US");
}

function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n}%`;
}

export function DashboardStats({ initialData }: { initialData?: AdminStats }) {
  const { data } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: getAdminStats,
    initialData,
  });

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {CARDS.map((card) => {
        const metric = data?.[card.key] ?? EMPTY;
        return (
          <StatCard
            key={card.title}
            title={card.title}
            value={fmtValue(metric.value)}
            change={fmtPct(metric.changePct)}
            trend={metric.trend}
            description={metric.trend === "up" ? card.up : card.down}
            subtext={card.subtext}
          />
        );
      })}
    </div>
  );
}
