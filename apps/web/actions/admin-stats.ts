"use server";

import { serverFetch } from "@/lib/api/client";
import type { AdminStats, StatsRange, TimeseriesPoint } from "@/lib/api/admin";

export async function getAdminStats(): Promise<AdminStats> {
  const { data } = await serverFetch<AdminStats>("/admin/stats");
  return data;
}

export async function getAdminStatsTimeseries(
  range: StatsRange = "90d",
): Promise<TimeseriesPoint[]> {
  const { data } = await serverFetch<TimeseriesPoint[]>(
    `/admin/stats/timeseries?range=${range}`,
  );
  return data;
}
