"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  CircleAlert,
  Megaphone,
  RefreshCw,
  Repeat,
  Sparkles,
  Video,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import {
  getMyEntitlements,
  getMySubscriptions,
  getSubscriptionCatalog,
  type EntitlementBucket,
  type PlanEntitlements,
  type SubscriptionCatalogItem,
  type UserSubscription,
} from "@/actions/subscriptions";
import {
  activeSubscriptions,
  currentSubscription,
  offerState,
  packageIdOf,
  priceFor,
} from "@/lib/subscription-pricing";

const DAY_MS = 24 * 60 * 60 * 1000;

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

type Limits = {
  photos: number;
  ads: number;
  renews: number;
  autoRenews: number;
  videos: number;
};

function benefits(limits: Limits): {
  label: string;
  value: number;
  Icon: LucideIcon;
}[] {
  return [
    { label: "Photos per ad", value: limits.photos, Icon: Camera },
    { label: "Active ads", value: limits.ads, Icon: Megaphone },
    { label: "Renewals", value: limits.renews, Icon: RefreshCw },
    { label: "Auto-renewals", value: limits.autoRenews, Icon: Repeat },
    { label: "Videos", value: limits.videos, Icon: Video },
  ];
}

function BenefitGrid({ limits }: { limits: Limits }) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {benefits(limits).map(({ label, value, Icon }) => (
        <li key={label} className="rounded-xl bg-muted px-3 py-3">
          <Icon className="size-4 text-muted-foreground" />
          <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">
            {value}
          </p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </li>
      ))}
    </ul>
  );
}

function UsageBar({
  used,
  limit,
  label = "Active ads used",
}: {
  used: number;
  limit: number;
  label?: string;
}) {
  const full = used >= limit;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums text-foreground">
          {used} / {limit}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${full ? "bg-amber-500" : "bg-[#00a0e9]"}`}
          style={{
            width: `${Math.min(100, Math.round((used / Math.max(1, limit)) * 100))}%`,
          }}
        />
      </div>
    </div>
  );
}

/** The free-plan caps the user has ads in ("Cars for sale 2/2", "Other ads 3/5"). */
function FreeAllowances({ buckets }: { buckets: EntitlementBucket[] }) {
  if (buckets.length === 0) return null;
  return (
    <div className="space-y-3">
      {buckets.map((bucket) => (
        <UsageBar
          key={bucket.key}
          used={bucket.used}
          limit={bucket.limits.ads}
          label={bucket.name}
        />
      ))}
    </div>
  );
}

function CurrentPlan({
  subscription,
  bucket,
  now,
}: {
  subscription: UserSubscription;
  /** This subscription's group allowance: its limits and ads used so far. */
  bucket: EntitlementBucket | null;
  now: number;
}) {
  const started = new Date(subscription.subscribedAt).getTime();
  const ends = new Date(subscription.expiresAt).getTime();
  const daysLeft = Math.max(0, Math.ceil((ends - now) / DAY_MS));
  const elapsed =
    ends > started
      ? Math.min(1, Math.max(0, (now - started) / (ends - started)))
      : 1;

  return (
    <section
      aria-label="Current plan"
      className="rounded-2xl bg-card p-6 shadow-sm ring-1 ring-[#00a0e9]/50"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <BadgeCheck className="size-3.5" /> Current plan
          </span>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
            {subscription.packageName ?? subscription.planName ?? "Premium"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {[
              subscription.categoryName,
              subscription.planName,
              subscription.termName,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tabular-nums text-foreground">
            {daysLeft}
          </p>
          <p className="text-xs text-muted-foreground">
            {daysLeft === 1 ? "day" : "days"} left
          </p>
        </div>
      </div>

      <div
        role="progressbar"
        aria-label="Time used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(elapsed * 100)}
        className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-[#00a0e9]"
          style={{ width: `${Math.round(elapsed * 100)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Started {formatDate(subscription.subscribedAt)} · ends{" "}
        {formatDate(subscription.expiresAt)} · paid $
        {money(subscription.priceUsd)}
      </p>

      <h3 className="mt-6 mb-3 text-sm font-semibold text-foreground">
        Your benefits
      </h3>
      <BenefitGrid limits={bucket?.limits ?? subscription} />
      {bucket && (
        <div className="mt-5">
          <UsageBar
            used={bucket.used}
            limit={bucket.limits.ads}
            label={`Active ads used in ${bucket.name}`}
          />
        </div>
      )}
    </section>
  );
}

function FreePlan({ entitlements }: { entitlements: PlanEntitlements }) {
  return (
    <section
      aria-label="Current plan"
      className="rounded-2xl bg-card p-6 shadow-sm ring-1 ring-border"
    >
      <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
        Current plan
      </span>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
        Free
      </h2>
      <p className="text-sm text-muted-foreground">
        The limits every account starts with.
      </p>
      <h3 className="mt-6 mb-3 text-sm font-semibold text-foreground">
        Your benefits
      </h3>
      <BenefitGrid limits={entitlements.limits} />
      <p className="mt-5 mb-3 text-xs text-muted-foreground">
        Free ads are capped per category; &ldquo;Other ads&rdquo; covers every
        category without a cap of its own.
      </p>
      <FreeAllowances
        buckets={entitlements.buckets.filter((b) => b.kind === "free")}
      />
    </section>
  );
}

function UpgradeOptions({
  catalog,
  subscriptions,
  now,
}: {
  catalog: SubscriptionCatalogItem[];
  subscriptions: UserSubscription[];
  now: number;
}) {
  const categories = useMemo(() => {
    const byCategory = new Map<
      string,
      {
        id: string;
        name: string;
        slug: string;
        packages: SubscriptionCatalogItem[][];
      }
    >();
    const byPackage = new Map<string, SubscriptionCatalogItem[]>();
    for (const item of catalog) {
      const terms = byPackage.get(item.packageId) ?? [];
      terms.push(item);
      byPackage.set(item.packageId, terms);
    }
    for (const terms of byPackage.values()) {
      const first = terms[0];
      const category = byCategory.get(first.categoryId) ?? {
        id: first.categoryId,
        name: first.categoryName,
        slug: first.categorySlug,
        packages: [],
      };
      category.packages.push(terms);
      byCategory.set(first.categoryId, category);
    }
    return [...byCategory.values()];
  }, [catalog]);

  if (categories.length === 0) return null;

  return (
    <section aria-labelledby="upgrade-heading">
      <div className="mb-3">
        <h2
          id="upgrade-heading"
          className="text-lg font-semibold tracking-tight text-foreground"
        >
          Premium plans
        </h2>
        <p className="text-sm text-muted-foreground">
          Each category is its own subscription. Upgrading one keeps its end
          date — you pay only the difference for the time left.
        </p>
      </div>
      <div className="space-y-6">
        {categories.map((category) => {
          // Only this category's subscription can be upgraded from here;
          // the others are separate, side-by-side subscriptions.
          const active = currentSubscription(subscriptions, category.id);
          const activePackageId = packageIdOf(active, catalog);
          return (
            <div key={category.slug}>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                {category.name}
              </h3>
              <div className="grid items-stretch gap-4 md:grid-cols-2">
                {category.packages.map((terms) => {
                  const base = terms[0];
                  const states = terms.map((term) =>
                    offerState(term, active, activePackageId, now),
                  );
                  const inUse = states.some((s) => s.kind === "current");
                  const dues = states.flatMap((s) =>
                    s.kind === "upgrade" || s.kind === "new" ? [s.due] : [],
                  );
                  const from = dues.length > 0 ? Math.min(...dues) : null;
                  const lowestPrice = Math.min(...terms.map(priceFor));

                  return (
                    <article
                      key={base.packageId}
                      className={`flex flex-col rounded-2xl bg-card p-5 shadow-sm ${
                        inUse
                          ? "ring-2 ring-emerald-500/60"
                          : "ring-1 ring-border"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[#0089c8]">
                            {base.planName}
                          </p>
                          <h4 className="mt-1 truncate text-lg font-semibold text-foreground">
                            {base.packageName}
                          </h4>
                        </div>
                        {inUse ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            <BadgeCheck className="size-3.5" /> In use
                          </span>
                        ) : (
                          <span className="shrink-0 text-right">
                            <span className="block text-xs text-muted-foreground">
                              From
                            </span>
                            <span className="font-semibold tabular-nums text-foreground">
                              ${money(lowestPrice)}
                            </span>
                          </span>
                        )}
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">
                        {base.photos} photos · {base.ads} ads · {base.renews}{" "}
                        renewals · {base.autoRenews} auto-renewals ·{" "}
                        {base.videos} videos
                      </p>
                      <div className="mt-auto pt-5">
                        {inUse ? (
                          <p className="flex h-10 items-center justify-center rounded-xl bg-muted text-sm font-medium text-muted-foreground">
                            Your current package
                          </p>
                        ) : from === null ? (
                          <p
                            aria-disabled
                            className="flex h-10 items-center justify-center rounded-xl bg-muted text-sm font-medium text-muted-foreground"
                          >
                            Not an upgrade from your plan
                          </p>
                        ) : (
                          <Link
                            href={{
                              pathname: "/premium-account/[category]",
                              params: { category: base.categorySlug },
                            }}
                            className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[#00a0e9] text-sm font-semibold text-white transition-colors hover:bg-[#008ccb]"
                          >
                            {active
                              ? `Upgrade · from $${money(from)} today`
                              : `Choose ${base.packageName}`}
                            <ArrowRight className="size-4" />
                          </Link>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function HistoryCard({ subscription }: { subscription: UserSubscription }) {
  return (
    <article className="flex items-center justify-between gap-3 rounded-xl bg-card p-4 ring-1 ring-border">
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">
          {subscription.packageName ?? subscription.planName ?? "Subscription"}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {[subscription.categoryName, subscription.termName]
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
  const [catalog, setCatalog] = useState<SubscriptionCatalogItem[]>([]);
  const [entitlements, setEntitlements] = useState<PlanEntitlements | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Subscriptions decide which screen renders, so only they can fail the
    // page; entitlements and the catalog degrade to hidden sections.
    const [subs, ents, offers] = await Promise.allSettled([
      getMySubscriptions(),
      getMyEntitlements(),
      getSubscriptionCatalog(),
    ]);
    if (subs.status === "fulfilled") setSubscriptions(subs.value);
    else setError("We couldn't load your subscriptions. Please try again.");
    if (ents.status === "fulfilled") setEntitlements(ents.value);
    if (offers.status === "fulfilled") setCatalog(offers.value);
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([
      getMySubscriptions(),
      getMyEntitlements(),
      getSubscriptionCatalog(),
    ]).then(([subs, ents, offers]) => {
      if (!mounted) return;
      if (subs.status === "fulfilled") setSubscriptions(subs.value);
      else setError("We couldn't load your subscriptions. Please try again.");
      if (ents.status === "fulfilled") setEntitlements(ents.value);
      if (offers.status === "fulfilled") setCatalog(offers.value);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // One live subscription per category, held side by side.
  const held = useMemo(
    () => activeSubscriptions(subscriptions),
    [subscriptions],
  );
  const history = useMemo(() => {
    const current = new Set(held.map((item) => item.id));
    return subscriptions.filter((item) => !current.has(item.id));
  }, [subscriptions, held]);
  const freeBuckets =
    entitlements?.buckets.filter((bucket) => bucket.kind === "free") ?? [];

  return (
    <div className="min-w-full bg-muted pb-12 pt-6">
      <main className="mx-auto max-w-5xl space-y-8 px-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Subscriptions
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your plan, its benefits and how to get more.
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="h-72 animate-pulse rounded-2xl bg-card ring-1 ring-border" />
            <div className="grid gap-4 md:grid-cols-2">
              {[0, 1].map((item) => (
                <div
                  key={item}
                  className="h-40 animate-pulse rounded-2xl bg-card ring-1 ring-border"
                />
              ))}
            </div>
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
              onClick={() => void load()}
              className="mt-4 h-10 rounded-xl"
            >
              <RefreshCw className="mr-2 size-4" /> Try again
            </Button>
          </div>
        ) : (
          <>
            {held.length > 0 ? (
              <>
                {held.map((subscription) => (
                  <CurrentPlan
                    key={subscription.id}
                    subscription={subscription}
                    bucket={
                      entitlements?.buckets.find(
                        (bucket) =>
                          bucket.kind === "group" &&
                          bucket.groupId === subscription.categoryId,
                      ) ?? null
                    }
                    now={now}
                  />
                ))}
                {freeBuckets.length > 0 && (
                  <section
                    aria-label="Free plan allowances"
                    className="rounded-2xl bg-card p-6 ring-1 ring-border"
                  >
                    <h2 className="mb-1 text-sm font-semibold text-foreground">
                      Everywhere else: the free plan
                    </h2>
                    <p className="mb-4 text-xs text-muted-foreground">
                      Ads in categories your plans don&apos;t cover use the free
                      caps.
                    </p>
                    <FreeAllowances buckets={freeBuckets} />
                  </section>
                )}
              </>
            ) : entitlements ? (
              <FreePlan entitlements={entitlements} />
            ) : null}

            {held.length === 0 && (
              <Link
                href="/premium-account"
                className="group flex items-center justify-between gap-4 rounded-2xl bg-card p-5 ring-1 ring-border transition-colors hover:ring-[#00a0e9]/60"
              >
                <span className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-[#00a0e9]/10 text-[#0089c8]">
                    <Sparkles className="size-5" />
                  </span>
                  <span>
                    <span className="block font-semibold text-foreground">
                      Need more?
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      Upgrade to the plan that better suits your business.
                    </span>
                  </span>
                </span>
                <ArrowRight className="size-5 text-[#0089c8] transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}

            <UpgradeOptions
              catalog={catalog}
              subscriptions={subscriptions}
              now={now}
            />

            {history.length > 0 && (
              <section aria-label="Past plans">
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
