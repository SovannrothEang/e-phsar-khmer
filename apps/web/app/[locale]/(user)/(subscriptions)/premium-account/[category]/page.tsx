"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Megaphone,
  PackageOpen,
  RefreshCw,
  Repeat,
  Video,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import {
  getSubscriptionCatalog,
  type SubscriptionCatalogItem,
} from "@/actions/subscriptions";

function priceFor(item: SubscriptionCatalogItem): number {
  const price = Number(item.price);
  const discount = Number(item.discount);
  const final =
    item.discountType === "percent"
      ? price * (1 - discount / 100)
      : price - discount;
  return Math.max(0, Math.round(final * 100) / 100);
}

function money(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function duration(item: SubscriptionCatalogItem): string {
  return `${item.durationValue} ${item.durationUnit}${item.durationValue === 1 ? "" : "s"}`;
}

export default function PremiumPlanPage() {
  const params = useParams<{ category: string }>();
  const categorySlug = params.category;
  const [catalog, setCatalog] = useState<SubscriptionCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
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
    () => catalog.filter((item) => item.categorySlug === categorySlug),
    [catalog, categorySlug],
  );
  const packages = useMemo(() => {
    const grouped = new Map<string, SubscriptionCatalogItem[]>();
    for (const offer of offers) {
      const current = grouped.get(offer.packageId) ?? [];
      current.push(offer);
      grouped.set(offer.packageId, current);
    }
    return [...grouped.values()].map((items) =>
      items.sort((a, b) => priceFor(a) - priceFor(b)),
    );
  }, [offers]);
  const categoryName = offers[0]?.categoryName ?? categorySlug;
  const categoryDescription = offers[0]?.categoryDescription;

  return (
    <div className="min-h-screen bg-muted pb-16">
      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        <nav
          aria-label="Breadcrumb"
          className="mb-6 flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Link href="/" className="hover:text-foreground">
            Home
          </Link>
          <span aria-hidden>/</span>
          <Link href="/premium-account" className="hover:text-foreground">
            Premium plans
          </Link>
          <span aria-hidden>/</span>
          <span className="text-foreground">{categoryName}</span>
        </nav>

        <header className="mb-8">
          <Link
            href="/premium-account"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> All categories
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {categoryName} plans
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-muted-foreground">
            {categoryDescription ||
              `Compare ${categoryName.toLowerCase()} packages and pick the billing term that suits you.`}
          </p>
        </header>

        {loading && (
          <div className="grid gap-5 md:grid-cols-2">
            {[0, 1].map((item) => (
              <div
                key={item}
                className="h-96 animate-pulse rounded-2xl bg-card ring-1 ring-border"
              />
            ))}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-2xl bg-card p-5 text-sm text-destructive ring-1 ring-destructive/30"
          >
            {error}
          </div>
        )}

        {!loading && !error && packages.length === 0 && (
          <div className="rounded-2xl bg-card p-12 text-center ring-1 ring-border">
            <PackageOpen className="mx-auto size-8 text-muted-foreground" />
            <h2 className="mt-3 font-semibold text-foreground">
              No packages available
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

        {!loading && !error && packages.length > 0 && (
          <div className="grid items-start gap-5 md:grid-cols-2">
            {packages.map((packageOffers) => {
              const base = packageOffers[0];
              const selected =
                packageOffers.find(
                  (term) => term.termId === picked[base.packageId],
                ) ?? base;
              const final = priceFor(selected);
              const original = Number(selected.price);
              const discounted = final < original;
              const savePct = discounted
                ? Math.round((1 - final / original) * 100)
                : 0;
              const features = [
                { label: "photos per ad", value: base.photos, Icon: Camera },
                { label: "active ads", value: base.ads, Icon: Megaphone },
                { label: "renewals", value: base.renews, Icon: RefreshCw },
                {
                  label: "auto-renewals",
                  value: base.autoRenews,
                  Icon: Repeat,
                },
                { label: "videos", value: base.videos, Icon: Video },
              ];

              return (
                <article
                  key={base.packageId}
                  className="flex flex-col rounded-2xl bg-card p-6 shadow-sm ring-1 ring-border"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="inline-flex rounded-full bg-[#00a0e9]/10 px-2.5 py-1 text-xs font-semibold text-[#0089c8]">
                        {base.planName}
                      </span>
                      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                        {base.packageName}
                      </h2>
                    </div>
                    {savePct > 0 && (
                      <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        Save {savePct}%
                      </span>
                    )}
                  </div>

                  <div
                    role="radiogroup"
                    aria-label={`Billing term for ${base.packageName}`}
                    className="mt-5 flex flex-wrap gap-1.5 rounded-xl bg-muted p-1"
                  >
                    {packageOffers.map((term) => {
                      const active = term.termId === selected.termId;
                      return (
                        <button
                          key={term.termId}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() =>
                            setPicked((current) => ({
                              ...current,
                              [base.packageId]: term.termId,
                            }))
                          }
                          className={`min-w-0 flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a0e9] ${
                            active
                              ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {term.termName}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-6 flex items-baseline gap-2">
                    <span className="text-4xl font-semibold tabular-nums tracking-tight text-foreground">
                      ${money(final)}
                    </span>
                    {discounted && (
                      <span className="text-base tabular-nums text-muted-foreground line-through">
                        ${money(original)}
                      </span>
                    )}
                    <span className="text-sm text-muted-foreground">
                      / {duration(selected)}
                    </span>
                  </div>

                  <ul className="mt-6 space-y-3 border-t border-border pt-6">
                    {features.map(({ label, value, Icon }) => (
                      <li
                        key={label}
                        className="flex items-center gap-3 text-sm"
                      >
                        <span className="flex size-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                          <Check className="size-3.5" strokeWidth={3} />
                        </span>
                        <Icon className="size-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          <strong className="font-semibold text-foreground">
                            {value}
                          </strong>{" "}
                          {label}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={{
                      pathname: "/checkout",
                      query: { termId: selected.termId },
                    }}
                    className="mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#00a0e9] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#008ccb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a0e9] focus-visible:ring-offset-2"
                  >
                    Choose {base.packageName}
                    <ArrowRight className="size-4" />
                  </Link>
                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    Activates after Bakong payment confirms.
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
