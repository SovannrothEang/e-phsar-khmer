"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Camera,
  CircleAlert,
  CreditCard,
  Megaphone,
  RefreshCw,
  Repeat,
  Video,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import {
  getMySubscriptions,
  type UserSubscription,
} from "@/actions/subscriptions";

const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_STYLE: Record<UserSubscription["status"], string> = {
  active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  expired: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  superseded: "bg-muted text-muted-foreground",
};

const STATUS_LABEL: Record<UserSubscription["status"], string> = {
  active: "Active",
  expired: "Expired",
  superseded: "Upgraded",
};

function money(value: string): string {
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

function Card({ subscription }: { subscription: UserSubscription }) {
  const active = subscription.status === "active";
  const started = new Date(subscription.subscribedAt).getTime();
  const ends = new Date(subscription.expiresAt).getTime();
  const [now] = useState(() => Date.now());
  const daysLeft = Math.max(0, Math.ceil((ends - now) / DAY_MS));
  const elapsed =
    ends > started
      ? Math.min(1, Math.max(0, (now - started) / (ends - started)))
      : 1;

  const limits: { label: string; value: number; Icon: LucideIcon }[] = [
    { label: "Photos", value: subscription.photos, Icon: Camera },
    { label: "Ads", value: subscription.ads, Icon: Megaphone },
    { label: "Renewals", value: subscription.renews, Icon: RefreshCw },
    { label: "Auto-renew", value: subscription.autoRenews, Icon: Repeat },
    { label: "Videos", value: subscription.videos, Icon: Video },
  ];

  return (
    <article
      className={`rounded-2xl bg-card p-5 shadow-sm ring-1 ${active ? "ring-[#00a0e9]/50" : "ring-border"} ${active ? "" : "opacity-90"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">
            {subscription.categoryName ?? "Premium package"}
          </p>
          <h3 className="mt-1 truncate text-lg font-semibold tracking-tight text-foreground">
            {subscription.packageName ??
              subscription.planName ??
              "Subscription"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {[subscription.planName, subscription.termName]
              .filter(Boolean)
              .join(" · ") || "Package term"}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[subscription.status]}`}
        >
          {STATUS_LABEL[subscription.status]}
        </span>
      </div>

      <ul className="mt-5 grid grid-cols-5 gap-2">
        {limits.map(({ label, value, Icon }) => (
          <li
            key={label}
            className="rounded-xl bg-muted px-1.5 py-2.5 text-center"
          >
            <Icon className="mx-auto size-3.5 text-muted-foreground" />
            <p className="mt-1 text-base font-semibold tabular-nums text-foreground">
              {value}
            </p>
            <p className="truncate text-[10px] leading-4 text-muted-foreground">
              {label}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-5">
        {active && (
          <div
            role="progressbar"
            aria-label="Time used"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(elapsed * 100)}
            className="h-1.5 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-[#00a0e9]"
              style={{ width: `${Math.round(elapsed * 100)}%` }}
            />
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">
            {active ? (
              <>
                <strong className="font-semibold tabular-nums text-foreground">
                  {daysLeft}
                </strong>{" "}
                {daysLeft === 1 ? "day" : "days"} left · ends{" "}
                {formatDate(subscription.expiresAt)}
              </>
            ) : (
              <>Ended {formatDate(subscription.expiresAt)}</>
            )}
          </span>
          <span className="font-semibold tabular-nums text-foreground">
            ${money(subscription.priceUsd)}
          </span>
        </div>
      </div>
    </article>
  );
}

export default function Subscription() {
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState<UserSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSubscriptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSubscriptions(await getMySubscriptions());
    } catch {
      setError("We couldn't load your subscriptions. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    getMySubscriptions()
      .then((items) => {
        if (mounted) setSubscriptions(items);
      })
      .catch(() => {
        if (mounted)
          setError("We couldn't load your subscriptions. Please try again.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const { current, history } = useMemo(
    () => ({
      current: subscriptions.filter((item) => item.status === "active"),
      history: subscriptions.filter((item) => item.status !== "active"),
    }),
    [subscriptions],
  );

  return (
    <div className="min-w-full bg-muted pb-12 pt-6">
      <main className="mx-auto max-w-5xl px-4">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Subscriptions
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading
                ? "Loading your plans…"
                : current.length > 0
                  ? `${current.length} active ${current.length === 1 ? "plan" : "plans"}`
                  : "Your plans, limits and expiry dates."}
            </p>
          </div>
          <Button
            onClick={() => router.push("/premium-account")}
            className="h-10 rounded-xl bg-[#00a0e9] px-4 text-sm font-semibold text-white hover:bg-[#008ccb]"
          >
            {current.length > 0 ? "Upgrade plan" : "Browse plans"}
            <ArrowRight className="ml-2 size-4" />
          </Button>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1].map((item) => (
              <div
                key={item}
                className="h-56 animate-pulse rounded-2xl bg-card ring-1 ring-border"
              />
            ))}
          </div>
        ) : error ? (
          <div
            role="alert"
            className="rounded-2xl bg-card p-10 text-center ring-1 ring-border"
          >
            <CircleAlert className="mx-auto size-7 text-amber-600" />
            <p className="mt-3 text-sm text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              onClick={() => void loadSubscriptions()}
              className="mt-4 h-10 rounded-xl"
            >
              <RefreshCw className="mr-2 size-4" /> Try again
            </Button>
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="rounded-2xl bg-card px-6 py-16 text-center ring-1 ring-border">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#00a0e9]/10 text-[#0089c8]">
              <CreditCard className="size-6" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-foreground">
              No subscriptions yet
            </h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Pick a package for your category. Once payment confirms, your plan
              shows up here.
            </p>
            <Button
              onClick={() => router.push("/premium-account")}
              className="mt-6 h-11 rounded-xl bg-[#00a0e9] px-5 text-sm font-semibold text-white hover:bg-[#008ccb]"
            >
              Explore plans <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            {current.length > 0 && (
              <section aria-label="Current plans">
                <div className="grid items-start gap-4 md:grid-cols-2">
                  {current.map((subscription) => (
                    <Card key={subscription.id} subscription={subscription} />
                  ))}
                </div>
              </section>
            )}
            {history.length > 0 && (
              <section aria-label="Past plans">
                <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
                  History
                </h2>
                <div className="grid items-start gap-4 md:grid-cols-2">
                  {history.map((subscription) => (
                    <Card key={subscription.id} subscription={subscription} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
