"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, CircleAlert, RefreshCw } from "lucide-react";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { getMySubscriptions, getPublicFreePlan } from "@/actions/subscriptions";
import type { PublicFreePlan, UserSubscription } from "@/types/subscription";
import { activeSubscriptions } from "@/lib/subscription-pricing";

const STATUS_STYLE: Record<UserSubscription["status"], string> = {
  active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  expired: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  superseded: "bg-muted text-muted-foreground",
  revoked: "bg-red-500/10 text-red-700 dark:text-red-400",
};

const STATUS_LABEL: Record<UserSubscription["status"], string> = {
  active: "Active",
  expired: "Expired",
  superseded: "Upgraded",
  revoked: "Revoked",
};

function money(value: string | number): string {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

/** Zero reads as "None", like an unavailable feature. */
const amount = (value: number) => (value > 0 ? String(value) : "None");

type Row = { label: string; value: string };

/** One plan as a sheet: a centred title over label / value rows. */
function PlanSheet({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle?: string;
  rows: Row[];
}) {
  return (
    <section
      aria-label={`${title} plan`}
      className="overflow-hidden rounded-md bg-card ring-1 ring-border"
    >
      <header className="px-6 pt-8 pb-4 text-center">
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </header>
      <dl>
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-4 border-b border-border px-6 py-5 last:border-b-0"
          >
            <dt className="text-foreground">{row.label}</dt>
            <dd className="tabular-nums text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function freeRows(plan: PublicFreePlan): Row[] {
  return [
    { label: "Photos", value: amount(plan.photos) },
    { label: "Videos", value: amount(plan.videos) },
    ...plan.caps.map((cap) => ({ label: cap.name, value: amount(cap.ads) })),
    { label: "Other Ads", value: amount(plan.otherAds) },
    { label: "Renews", value: amount(plan.renews) },
    { label: "Auto-Renews", value: amount(plan.autoRenews) },
  ];
}

function subscriptionRows(subscription: UserSubscription): Row[] {
  return [
    { label: "Photos", value: amount(subscription.photos) },
    { label: "Videos", value: amount(subscription.videos) },
    { label: "Ads", value: amount(subscription.ads) },
    { label: "Renews", value: amount(subscription.renews) },
    { label: "Auto-Renews", value: amount(subscription.autoRenews) },
    { label: "Expires", value: formatDate(subscription.expiresAt) },
  ];
}

function HistoryCard({ subscription }: { subscription: UserSubscription }) {
  return (
    <article className="flex items-center justify-between gap-3 rounded-md bg-card p-4 ring-1 ring-border">
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">
          {subscription.packageName ?? subscription.planName ?? "Subscription"}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {[subscription.groupName, subscription.termName]
            .filter(Boolean)
            .join(" · ")}{" "}
          · {formatDate(subscription.subscribedAt)} –{" "}
          {formatDate(subscription.expiresAt)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-sm font-semibold tabular-nums text-foreground">
          ${money(subscription.priceUsd)}
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[subscription.status]}`}
        >
          {STATUS_LABEL[subscription.status]}
        </span>
      </div>
    </article>
  );
}

export default function Subscription() {
  const [subscriptions, setSubscriptions] = useState<UserSubscription[]>([]);
  const [freePlan, setFreePlan] = useState<PublicFreePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback(
    ([subs, free]: [
      PromiseSettledResult<UserSubscription[]>,
      PromiseSettledResult<PublicFreePlan>,
    ]) => {
      // Subscriptions decide which sheets render, so only they can fail the
      // page; the free plan degrades to a hidden sheet.
      if (subs.status === "fulfilled") setSubscriptions(subs.value);
      else setError("We couldn't load your membership. Please try again.");
      if (free.status === "fulfilled") setFreePlan(free.value);
      setLoading(false);
    },
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    apply(
      await Promise.allSettled([getMySubscriptions(), getPublicFreePlan()]),
    );
  }, [apply]);

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([getMySubscriptions(), getPublicFreePlan()]).then(
      (results) => {
        if (mounted) apply(results);
      },
    );
    return () => {
      mounted = false;
    };
  }, [apply]);

  // One live subscription per category, held side by side.
  const held = useMemo(
    () => activeSubscriptions(subscriptions),
    [subscriptions],
  );
  const history = useMemo(() => {
    const current = new Set(held.map((item) => item.id));
    return subscriptions.filter((item) => !current.has(item.id));
  }, [subscriptions, held]);

  return (
    <div className="min-w-full bg-background pb-12 pt-6">
      <main className="mx-auto max-w-5xl space-y-6 px-4">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Membership
        </h1>

        {loading ? (
          <div className="h-[34rem] animate-pulse rounded-md bg-card ring-1 ring-border" />
        ) : error ? (
          <div
            role="alert"
            className="rounded-md bg-card p-10 text-center ring-1 ring-border"
          >
            <CircleAlert className="mx-auto size-7 text-amber-600" />
            <p className="mt-3 text-sm text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              onClick={() => void load()}
              className="mt-4 h-10 rounded-md"
            >
              <RefreshCw className="mr-2 size-4" /> Try again
            </Button>
          </div>
        ) : (
          <>
            {held.map((subscription) => (
              <PlanSheet
                key={subscription.id}
                title={
                  subscription.packageName ?? subscription.planName ?? "Premium"
                }
                subtitle={[subscription.groupName, subscription.termName]
                  .filter(Boolean)
                  .join(" · ")}
                rows={subscriptionRows(subscription)}
              />
            ))}

            {freePlan && (
              <PlanSheet
                title="Free"
                subtitle={
                  held.length > 0
                    ? "For ads in categories your plans don't cover"
                    : undefined
                }
                rows={freeRows(freePlan)}
              />
            )}

            <Link
              href="/premium-account"
              className="flex items-center justify-between gap-4 rounded-md bg-card px-6 py-6 ring-1 ring-border transition-colors hover:ring-[#00a0e9]/60"
            >
              <span>
                <span className="block text-xl font-semibold text-foreground">
                  Need More?
                </span>
                <span className="mt-3 block text-foreground">
                  Upgrade to the right plan that better suits your business.
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-[#00a0e9]" />
            </Link>

            <Link
              href="/premium-account"
              className="flex h-14 items-center justify-center rounded-md bg-[#00a0e9] text-lg font-semibold text-white transition-colors hover:bg-[#008ccb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a0e9] focus-visible:ring-offset-2"
            >
              Upgrade Account
            </Link>

            {history.length > 0 && (
              <section aria-label="Past plans" className="pt-4">
                <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
                  History
                </h2>
                <div className="space-y-2">
                  {history.map((subscription) => (
                    <HistoryCard
                      key={subscription.id}
                      subscription={subscription}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
