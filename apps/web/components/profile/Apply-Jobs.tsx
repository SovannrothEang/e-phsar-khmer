"use client";

import * as React from "react";
import { BriefcaseBusiness } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "@/i18n/routing";
import { useRouter } from "@/i18n/routing";
import { Button } from "../ui/button";
import { JobApplicationRow } from "./JobApplicationRow";
import { loadMyAppliedJobs } from "@/actions/applications";
import type { AppliedJob, JobApplicationStatus } from "@/types/applications";

const STATUS_FILTERS: { value: "all" | JobApplicationStatus; label: string }[] =
  [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "viewed", label: "Viewed" },
    { value: "hired", label: "Hired" },
    { value: "rejected", label: "Rejected" },
  ];

/**
 * `/me/applied-jobs` — the jobs this account applied to, fetched in the
 * browser through a server action (the list is JWT-scoped, so only the server
 * holds the cookies).
 *
 * The shell is the design this page shipped with; what changed is that the
 * rows are real. An empty list and a failed one stay visibly different: an
 * outage must never read as "you haven't applied to anything".
 */
export default function AppliedJobs() {
  const router = useRouter();
  const [status, setStatus] = React.useState<"all" | JobApplicationStatus>(
    "all",
  );
  const [sort, setSort] = React.useState<"newest" | "oldest">("newest");
  const [items, setItems] = React.useState<AppliedJob[] | null>(null);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      setItems(null);
      const result = await loadMyAppliedJobs({
        page: 1,
        status: status === "all" ? undefined : status,
      });
      if (cancelled) return;
      setItems(result.items);
      setHasMore(result.hasMore);
      setError(result.error ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  const loadMore = () => {
    if (loadingMore) return;
    setLoadingMore(true);
    void (async () => {
      const next = page + 1;
      const result = await loadMyAppliedJobs({
        page: next,
        status: status === "all" ? undefined : status,
      });
      setLoadingMore(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      setPage(next);
      setHasMore(result.hasMore);
      setItems((current) => [
        ...(current ?? []),
        ...result.items.filter(
          (row) => !(current ?? []).some((seen) => seen.id === row.id),
        ),
      ]);
    })();
  };

  const rows = React.useMemo(() => {
    const list = [...(items ?? [])];
    list.sort((a, b) => {
      const at = Date.parse(a.createdAt);
      const bt = Date.parse(b.createdAt);
      return sort === "newest" ? bt - at : at - bt;
    });
    return list;
  }, [items, sort]);

  return (
    <div className="min-w-full bg-muted pb-50 pt-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-medium text-foreground mb-6">Jobs</h1>
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
          <div className="flex items-center">
            <Tabs defaultValue="applied">
              <TabsList variant="line">
                <TabsTrigger value="applications" className="asChild">
                  <Link href={{ pathname: "/me/job-applications" }}>
                    Applications
                  </Link>
                </TabsTrigger>
                <TabsTrigger value="applied" className="asChild">
                  <Link href={{ pathname: "/me/applied-jobs" }}>Applied</Link>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex items-center gap-3">
            <Select
              value={status}
              onValueChange={(value) =>
                setStatus(value as "all" | JobApplicationStatus)
              }
            >
              <SelectTrigger className="w-[180px] bg-card">
                <SelectValue placeholder="Status: All" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="cursor-pointer"
                  >
                    {option.value === "all"
                      ? "Status: All"
                      : `Status: ${option.label}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={sort}
              onValueChange={(value) => setSort(value as "newest" | "oldest")}
            >
              <SelectTrigger className="w-[180px] bg-card">
                <SelectValue placeholder="Sort: Newest" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest" className="cursor-pointer">
                  Sort: Newest
                </SelectItem>
                <SelectItem value="oldest" className="cursor-pointer">
                  Sort: Oldest
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {error ? (
          <main className="max-w-2xl mx-auto mt-4">
            <div className="bg-card rounded-sm shadow-sm min-h-[240px] flex flex-col items-center justify-center p-8 text-center">
              <h2 className="text-lg font-medium text-foreground mb-2">
                Couldn&apos;t load your applications
              </h2>
              <p className="text-muted-foreground text-sm">{error}</p>
            </div>
          </main>
        ) : items === null ? (
          <main className="max-w-2xl mx-auto mt-4">
            <div className="bg-card rounded-sm shadow-sm min-h-[240px]" />
          </main>
        ) : rows.length === 0 ? (
          <main className="max-w-2xl mx-auto mt-4">
            <div className="bg-card rounded-sm shadow-sm min-h-[450px] flex flex-col items-center justify-center p-8">
              <div className="w-32 h-32 bg-muted rounded-full flex items-center justify-center mb-8">
                <div className="relative">
                  <BriefcaseBusiness
                    className="w-12 h-12 text-muted-foreground"
                    strokeWidth={1.5}
                  />
                </div>
              </div>

              <div className="text-center">
                <h2 className="text-xl font-medium text-foreground mb-2">
                  No Result!
                </h2>
                <p className="text-muted-foreground text-sm mb-8">
                  You don&apos;t have any job applied right now.
                </p>
                <Button
                  onClick={() =>
                    router.push({
                      pathname: "/category/[categorySlug]",
                      params: { categorySlug: "jobs" },
                    })
                  }
                  className="bg-orange-400 hover:bg-orange-600 text-card font-medium h-10 px-8 rounded-sm transition-colors cursor-pointer"
                >
                  See Job Available
                </Button>
              </div>
            </div>
          </main>
        ) : (
          <main className="w-full">
            <div className="bg-card rounded-sm shadow-sm px-6 py-2">
              <ul>
                {rows.map((row) => (
                  <JobApplicationRow
                    key={row.id}
                    view="applied"
                    listing={row.listing}
                    status={row.status}
                    createdAt={row.createdAt}
                    title={row.listing.title || "This job"}
                    subtitle={
                      [
                        row.listing.company,
                        row.poster.username ? `@${row.poster.username}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || null
                    }
                  />
                ))}
              </ul>
            </div>
            {hasMore ? (
              <div className="flex justify-center pt-6">
                <Button
                  onClick={loadMore}
                  disabled={loadingMore}
                  variant="outline"
                  className="cursor-pointer"
                >
                  {loadingMore ? "Loading..." : "Load more"}
                </Button>
              </div>
            ) : null}
          </main>
        )}
      </div>
    </div>
  );
}
