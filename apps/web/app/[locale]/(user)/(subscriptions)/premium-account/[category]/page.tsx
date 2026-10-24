"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowRight, ChevronRight, CircleCheck, Home } from "lucide-react";
import { Link } from "@/i18n/routing";
import {
  getMySubscriptions,
  getSubscriptionCatalog,
} from "@/actions/subscriptions";
import type {
  SubscriptionCatalogItem,
  UserSubscription,
} from "@/types/subscription";
import {
  currentSubscription,
  offerState,
  packageIdOf,
  priceFor,
  type OfferState,
} from "@/lib/subscription-pricing";

function money(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
}

const UNIT: Record<SubscriptionCatalogItem["durationUnit"], [string, string]> =
  {
    day: ["Day", "Days"],
    month: ["Month", "Months"],
    year: ["Year", "Years"],
  };

function unitLabel(item: SubscriptionCatalogItem): string {
  return UNIT[item.durationUnit][item.durationValue === 1 ? 0 : 1];
}

/** "- 20 %" for a percent discount, "- $5" for an amount; null when none. */
function discountLabel(item: SubscriptionCatalogItem): string | null {
  const value = Number(item.discount);
  if (!(value > 0)) return null;
  return item.discountType === "percent"
    ? `- ${money(value)} %`
    : `- $${money(value)}`;
}

function DiscountBadge({
  item,
  className = "",
}: {
  item: SubscriptionCatalogItem;
  className?: string;
}) {
  const label = discountLabel(item);
  if (!label) return null;
  return (
    <span
      className={`rounded-sm bg-red-600/85 px-1.5 py-0.5 text-xs font-semibold text-white ${className}`}
    >
      {label}
    </span>
  );
}

/** Original price struck through (when discounted) next to the final price. */
function Price({
  item,
  className = "",
}: {
  item: SubscriptionCatalogItem;
  className?: string;
}) {
  const final = priceFor(item);
  const original = Number(item.price);
  return (
    <span className={`tabular-nums ${className}`}>
      {final < original && (
        <span className="mr-2 italic text-muted-foreground line-through">
          ${money(original)}
        </span>
      )}
      <span className="text-[#00a0e9]">${money(final)}</span>
    </span>
  );
}

function Benefits({ item }: { item: SubscriptionCatalogItem }) {
  const rows: [string, number][] = [
    ["Photos", item.photos],
    ["Ads", item.ads],
    ["Renews", item.renews],
    ["Auto-Renews", item.autoRenews],
    ["Videos", item.videos],
  ];
  return (
    <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
      {rows.map(([label, value]) => (
        <li key={label} className="flex items-center gap-2">
          <CircleCheck className="size-4" strokeWidth={1.75} />
          {label} {value}
        </li>
      ))}
    </ul>
  );
}

/** The selected plan's terms: one radio row per term, price on the right. */
function TermRows({
  terms,
  selectedTermId,
  onPick,
}: {
  terms: SubscriptionCatalogItem[];
  selectedTermId: string;
  onPick: (termId: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Term"
      className="mt-2 overflow-hidden rounded-md bg-muted ring-1 ring-border"
    >
      {terms.map((term) => {
        const checked = term.termId === selectedTermId;
        return (
          <button
            key={term.termId}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={(e) => {
              e.stopPropagation();
              onPick(term.termId);
            }}
            className={`flex w-full items-center gap-4 border-b border-border px-6 py-5 text-left last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#00a0e9] ${
              checked ? "bg-background/60" : "hover:bg-background/40"
            }`}
          >
            <span
              aria-hidden
              className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                checked ? "border-[#00a0e9]" : "border-muted-foreground/60"
              }`}
            >
              {checked && (
                <span className="size-2.5 rounded-full bg-[#00a0e9]" />
              )}
            </span>
            <span className="text-lg font-semibold text-foreground">
              {term.termName}
            </span>
            <DiscountBadge item={term} />
            <Price item={term} className="ml-auto text-lg font-semibold" />
          </button>
        );
      })}
    </div>
  );
}

/** An unselected plan's terms: compact tiles; picking one selects the plan. */
function TermTiles({
  terms,
  onPick,
}: {
  terms: SubscriptionCatalogItem[];
  onPick: (termId: string) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-10">
      {terms.map((term) => (
        <button
          key={term.termId}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPick(term.termId);
          }}
          className="relative flex size-28 flex-col items-center justify-center rounded-md bg-muted text-foreground ring-1 ring-border transition-colors hover:ring-[#00a0e9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a0e9]"
        >
          <DiscountBadge item={term} className="absolute right-0 top-0" />
          <span className="text-3xl font-bold leading-none">
            {term.durationValue}
          </span>
          <span className="mt-1 text-lg">{unitLabel(term)}</span>
        </button>
      ))}
    </div>
  );
}

function SummaryBar({
  plan,
  term,
  state,
  active,
}: {
  plan: SubscriptionCatalogItem;
  term: SubscriptionCatalogItem;
  state: OfferState;
  active: UserSubscription | null;
}) {
  const button =
    "flex h-14 w-full items-center justify-center gap-2 rounded-md text-lg font-semibold";
  return (
    <section
      aria-label="Your selection"
      className="sticky bottom-4 mt-6 rounded-md bg-card p-6 shadow-lg ring-1 ring-border"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl text-foreground">
          {plan.packageName} {term.termName}
        </h2>
        <DiscountBadge item={term} />
        <Price item={term} className="ml-auto text-2xl" />
      </div>
      {state.kind === "upgrade" && (
        <p className="mt-2 text-sm text-muted-foreground">
          Upgrade from your current plan: you pay{" "}
          <strong className="text-foreground">${money(state.due)}</strong> today
          — prorated to your end date, minus ${money(state.credit)} unused
          credit.
        </p>
      )}
      <div className="mt-4">
        {state.kind === "current" ? (
          <Link
            href="/me/subscriptions"
            className={`${button} bg-muted text-muted-foreground`}
          >
            Your current plan
            {active &&
              ` · until ${new Date(active.expiresAt).toLocaleDateString()}`}
          </Link>
        ) : state.kind === "unavailable" ? (
          <span
            aria-disabled
            className={`${button} cursor-not-allowed bg-muted text-muted-foreground`}
          >
            Not an upgrade from your plan
          </span>
        ) : (
          <Link
            href={{ pathname: "/checkout", query: { termId: term.termId } }}
            className={`${button} bg-[#f68b1e] text-white transition-colors hover:bg-[#e07d15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f68b1e] focus-visible:ring-offset-2`}
          >
            {state.kind === "upgrade" ? "Upgrade Now" : "Subscribe Now"}
          </Link>
        )}
      </div>
    </section>
  );
}

export default function PremiumPlanPage() {
  const params = useParams<{ category: string }>();
  const categorySlug = params.category;
  const [catalog, setCatalog] = useState<SubscriptionCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<UserSubscription[]>([]);
  // The plan being looked at, and the term picked on each plan.
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(
    null,
  );
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let mounted = true;
    // Fail soft: without the user's plan every offer reads as a new purchase,
    // and checkout still re-checks on the server.
    getMySubscriptions()
      .then((items) => {
        if (mounted) setSubscriptions(items);
      })
      .catch(() => {});
    getSubscriptionCatalog()
      .then((items) => {
        if (mounted) setCatalog(items);
      })
      .catch(() => {
        if (mounted) setError("We couldn't load plans. Please try again.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const offers = useMemo(
    () => catalog.filter((item) => item.groupSlug === categorySlug),
    [catalog, categorySlug],
  );
  // The catalog arrives in admin sort order (plans, then terms), which is the
  // order the terms are shown in — the first term is the plan's default.
  const packages = useMemo(() => {
    const grouped = new Map<string, SubscriptionCatalogItem[]>();
    for (const offer of offers) {
      const current = grouped.get(offer.packageId) ?? [];
      current.push(offer);
      grouped.set(offer.packageId, current);
    }
    return [...grouped.values()];
  }, [offers]);
  // Only this group's subscription matters here: buying into another
  // group is a separate, side-by-side subscription, never an upgrade.
  const active = currentSubscription(subscriptions, offers[0]?.groupId ?? null);
  const activePackageId = packageIdOf(active, catalog);
  const groupName = offers[0]?.groupName ?? categorySlug;

  const selectedTerms =
    packages.find((terms) => terms[0].packageId === selectedPackageId) ??
    packages[0];
  const selectedTerm = selectedTerms
    ? (selectedTerms.find(
        (term) => term.termId === picked[selectedTerms[0].packageId],
      ) ?? selectedTerms[0])
    : null;

  const pick = (packageId: string, termId?: string) => {
    setSelectedPackageId(packageId);
    if (termId) setPicked((current) => ({ ...current, [packageId]: termId }));
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
        <nav
          aria-label="Breadcrumb"
          className="mb-8 flex flex-wrap items-center gap-2 text-base text-foreground"
        >
          <Link href="/" className="flex items-center gap-2 hover:underline">
            <Home className="size-4" /> Home
          </Link>
          <ChevronRight className="size-4 text-muted-foreground" />
          <Link href="/me" className="hover:underline">
            Profile
          </Link>
          <ChevronRight className="size-4 text-muted-foreground" />
          <Link href="/me/subscriptions" className="hover:underline">
            Membership
          </Link>
          <ChevronRight className="size-4 text-muted-foreground" />
          <Link href="/premium-account" className="hover:underline">
            Premium Account
          </Link>
          <ChevronRight className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">{groupName}</span>
        </nav>

        <h1 className="mb-6 text-2xl font-semibold text-foreground">
          Choose the right plan for your business
        </h1>

        {loading && (
          <div className="h-96 animate-pulse rounded-md bg-card ring-1 ring-border" />
        )}

        {error && (
          <div
            role="alert"
            className="rounded-md bg-card p-5 text-sm text-destructive ring-1 ring-destructive/30"
          >
            {error}
          </div>
        )}

        {!loading && !error && packages.length === 0 && (
          <div className="rounded-md bg-card p-12 text-center ring-1 ring-border">
            <h2 className="font-semibold text-foreground">
              No plans available
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse another category or check back later.
            </p>
            <Link
              href="/premium-account"
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[#0089c8] hover:underline"
            >
              Browse categories <ArrowRight className="size-4" />
            </Link>
          </div>
        )}

        {!loading && !error && selectedTerms && selectedTerm && (
          <>
            <div className="space-y-6">
              {packages.map((terms) => {
                const base = terms[0];
                const isSelected =
                  base.packageId === selectedTerms[0].packageId;
                const isCurrent = base.packageId === activePackageId;
                return (
                  <article
                    key={base.packageId}
                    onClick={() => !isSelected && pick(base.packageId)}
                    className={`rounded-md bg-card p-8 ${
                      isSelected
                        ? "ring-2 ring-[#00a0e9]"
                        : "cursor-pointer ring-1 ring-border hover:ring-[#00a0e9]/50"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-xl font-semibold text-foreground">
                        {base.packageName}
                      </h2>
                      {isCurrent && (
                        <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          Current plan
                        </span>
                      )}
                    </div>
                    <p className="mt-3 font-semibold text-foreground">
                      Start From {money(Number(base.price))} $ For{" "}
                      {base.termName}
                    </p>
                    <Benefits item={base} />
                    <h3 className="mt-6 text-lg text-foreground">Term</h3>
                    {isSelected ? (
                      <TermRows
                        terms={terms}
                        selectedTermId={selectedTerm.termId}
                        onPick={(termId) => pick(base.packageId, termId)}
                      />
                    ) : (
                      <TermTiles
                        terms={terms}
                        onPick={(termId) => pick(base.packageId, termId)}
                      />
                    )}
                  </article>
                );
              })}
            </div>

            <SummaryBar
              plan={selectedTerms[0]}
              term={selectedTerm}
              state={offerState(selectedTerm, active, activePackageId, now)}
              active={active}
            />
          </>
        )}
      </div>
    </div>
  );
}
