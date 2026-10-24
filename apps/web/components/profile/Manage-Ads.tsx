"use client";
import { SearchIcon, ImagePlus, Funnel } from "lucide-react";
import { Field } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/routing";
import { GridCardPost } from "@/components/ads/GridCardPost";
import { loadMyAds } from "@/actions/my-ads";
import type { PlanEntitlements } from "@/types/subscription";
import type { Post } from "@/lib/posts";

type Tab = "active" | "expired";

interface TabState {
  tab: Tab;
  items: Post[];
  page: number;
  hasMore: boolean;
  error: string | null;
}

// Allowances are per bucket (a held group, or a free category cap), so the
// account totals are sums over the buckets the user actually has.
function adsSummary(plan: PlanEntitlements): string {
  const allowance = plan.buckets.reduce((sum, b) => sum + b.limits.ads, 0);
  return `${plan.usage.ads}/${plan.buckets.length > 0 ? allowance : plan.limits.ads}`;
}

function renewsSummary(plan: PlanEntitlements): string {
  const values = plan.buckets.map((b) => b.limits.renews);
  const low = Math.min(plan.limits.renews, ...values);
  const high = Math.max(plan.limits.renews, ...values);
  return low === high ? `${low} per ad` : `${low}–${high} per ad`;
}

export default function ManageAds() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("active");
  // What the last fetch returned, tagged with the tab it belongs to. A result
  // for another tab counts as "still loading" — derived at render, so the
  // effect never has to reset state synchronously when the tab changes.
  const [loaded, setLoaded] = useState<TabState | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [plan, setPlan] = useState<PlanEntitlements | null>(null);
  const [counts, setCounts] = useState<Partial<Record<Tab, number>>>({});

  const current = loaded?.tab === activeTab ? loaded : null;
  const items = current?.items ?? null;
  const error = current?.error ?? null;
  const hasMore = current?.hasMore ?? false;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const result = await loadMyAds(activeTab, 1);
      if (cancelled) return;
      setLoaded({
        tab: activeTab,
        items: result.items,
        page: 1,
        hasMore: result.hasMore,
        error: result.error ?? null,
      });
      setCounts((c) => ({ ...c, ...result.counts }));
      if (result.plan) setPlan(result.plan);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const loadMore = () => {
    if (loadingMore || !current) return;
    setLoadingMore(true);
    const tab = activeTab;
    const next = current.page + 1;

    void (async () => {
      const result = await loadMyAds(tab, next);
      setLoadingMore(false);
      setLoaded((prev) => {
        // The user switched tabs while this page was in flight.
        if (!prev || prev.tab !== tab) return prev;
        if (result.error) return { ...prev, error: result.error };
        const seen = new Set(prev.items.map((p) => p.postId));
        return {
          ...prev,
          items: [
            ...prev.items,
            ...result.items.filter((p) => !seen.has(p.postId)),
          ],
          page: next,
          hasMore: result.hasMore,
        };
      });
    })();
  };

  return (
    <div className="min-h-screen bg-muted pt-4">
      <div className="max-w-7xl mx-auto bg-card rounded-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border">
          <h1 className="text-foreground text-xl py-2 px-4 pt-6">Manage Ads</h1>
          <hr />
          <div className="flex items-center justify-end gap-3 py-2 pt-6 px-6">
            <Field className="flex-1">
              <InputGroup>
                <InputGroupInput
                  id="inline-start-input"
                  placeholder="Search..."
                  className="h-11 border-gray-200 focus:ring-0"
                />
                <InputGroupAddon align="inline-end">
                  <SearchIcon className="text-muted-foreground w-5 h-5 mr-2" />
                </InputGroupAddon>
              </InputGroup>
            </Field>
            <Button
              variant="outline"
              className="h-10 rounded-sm px-5 border-muted-foreground text-foreground hover:text-foreground font-medium"
            >
              <Funnel className="scale-120" />
              Filter
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10 px-4">
          <div className="bg-muted h-20 w-full rounded-md p-6 text-center text-primary font-medium cursor-pointer hover:bg-muted/80 transition-colors flex flex-col justify-center gap-1">
            Total Ads
            <p className="text-lg text-foreground">
              {plan ? adsSummary(plan) : "–"}
            </p>
          </div>
          <div className="bg-muted h-20 w-full text-center p-6 rounded-md text-foreground font-medium cursor-pointer hover:bg-muted/80 transition-colors flex flex-col justify-center gap-1">
            Renews
            <p className="text-lg text-foreground">
              {plan ? renewsSummary(plan) : "–"}
            </p>
          </div>
        </div>
        <div className="bg-muted rounded-md mb-12 mx-4 p-2 flex">
          <button
            onClick={() => setActiveTab("active")}
            className={`flex-1 h-10 rounded-md text-base font-semibold transition-all cursor-pointer ${
              activeTab === "active"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent/50"
            }`}
          >
            Active{" "}
            <span className="text-[#00a0e9]">({counts.active ?? 0})</span>
          </button>
          <button
            onClick={() => setActiveTab("expired")}
            className={`flex-1 h-10 rounded-md text-base font-semibold transition-all cursor-pointer ${
              activeTab === "expired"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent/50"
            }`}
          >
            Expired{" "}
            <span className="text-[#00a0e9]">({counts.expired ?? 0})</span>
          </button>
        </div>
        {error || items === null ? (
          <div className="flex items-center justify-center px-4 text-center min-h-[400px]">
            <p className="text-sm text-muted-foreground">
              {error ?? "Loading…"}
            </p>
          </div>
        ) : items.length > 0 ? (
          <div className="px-4 pb-8">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {items.map((post) => (
                <GridCardPost key={post.postId} post={post} />
              ))}
            </div>
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="rounded-sm border bg-card px-6 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60 cursor-pointer"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-4 text-center min-h-[400px]">
            <div className="bg-muted w-36 h-36 rounded-full flex items-center justify-center ">
              <ImagePlus className="w-16 h-16 text-muted-foreground stroke-1" />
            </div>

            <h2 className="text-lg font-medium text-foreground mb-3">
              No Result!
            </h2>

            {activeTab === "active" ? (
              <div className="flex flex-col items-center gap-8">
                <p className="text-muted-foreground text-sm">
                  Oops! You don&apos;t have any active ads.
                </p>
                <Button
                  onClick={() => router.push("/post")}
                  className="bg-[#f28e1c] hover:bg-[#d17a15] text-white font-semibold text-sm px-6 py-5   rounded-sm transition-colors cursor-pointer"
                >
                  Sell your stuff
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                You don&apos;t have any expired ads yet.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
