import { getAdminStats, getAdminStatsTimeseries } from "@/actions/admin-stats";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { ChartAreaInteractive } from "@/components/dashboard/chart-area-interactive";
import { DocumentTabs } from "@/components/dashboard/document-tabs";

export default async function AdminPage() {
  // Prefetch server-side for a no-flash first paint; fall back to client fetch
  // (via TanStack Query) if the API is briefly unavailable.
  const [stats, timeseries] = await Promise.all([
    getAdminStats().catch(() => undefined),
    getAdminStatsTimeseries("90d").catch(() => undefined),
  ]);

  return (
    <main className="flex-1 overflow-auto p-6 min-w-0">
      <DashboardStats initialData={stats} />

      <div className="mt-6">
        <ChartAreaInteractive initialData={timeseries} />
      </div>

      <DocumentTabs />
    </main>
  );
}
