// Shared admin API response types (plain module — safe to import anywhere).
// Mirrors the backend `AdminService` return shapes.

export type StatsRange = "7d" | "30d" | "90d";

export interface StatMetric {
  value: number;
  changePct: number;
  trend: "up" | "down";
}

export interface AdminStats {
  totalUsers: StatMetric;
  newUsers: StatMetric;
  totalListings: StatMetric;
  activeListings: StatMetric;
}

export interface TimeseriesPoint {
  date: string;
  newUsers: number;
  newListings: number;
}
