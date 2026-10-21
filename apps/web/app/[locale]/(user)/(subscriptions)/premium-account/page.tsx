import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CarFront,
  Grid2X2,
  House,
  QrCode,
  ShieldCheck,
  Sparkles,
  Utensils,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "@/i18n/routing";
import {
  getMySubscriptions,
  getSubscriptionCatalog,
} from "@/actions/subscriptions";
import {
  activeSubscriptions,
  daysUntil,
  priceFor,
} from "@/lib/subscription-pricing";

const categoryIcons: Record<string, LucideIcon> = {
  auto: CarFront,
  food: Utensils,
  general: Grid2X2,
  property: House,
  service: BriefcaseBusiness,
  services: BriefcaseBusiness,
};

function money(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const steps = [
  {
    Icon: Sparkles,
    title: "Pick a package",
    text: "Choose a category, a package and how long you want it.",
  },
  {
    Icon: QrCode,
    title: "Pay with KHQR",
    text: "Scan with Bakong or any supported banking app.",
  },
  {
    Icon: Zap,
    title: "Start using it",
    text: "Your plan switches on as soon as payment confirms.",
  },
];

export default async function PremiumAccountPage() {
  const [catalog, subscriptions] = await Promise.all([
    getSubscriptionCatalog().catch(() => []),
    getMySubscriptions().catch(() => []),
  ]);
  // One subscription per category, held side by side.
  const held = activeSubscriptions(subscriptions);
  const heldByCategory = new Map(
    held.flatMap((item) => (item.categoryId ? [[item.categoryId, item]] : [])),
  );
  const active = held[0] ?? null;
  const activeCategory = active?.termId
    ? catalog.find((item) => item.termId === active.termId)
    : undefined;
  const daysLeft = active ? daysUntil(active.expiresAt) : 0;
  const categoryMap = new Map<
    string,
    {
      id: string;
      name: string;
      slug: string;
      description: string | null;
      terms: number;
      from: number;
      packages: Set<string>;
    }
  >();

  for (const item of catalog) {
    const category = categoryMap.get(item.categoryId) ?? {
      id: item.categoryId,
      name: item.categoryName,
      slug: item.categorySlug,
      description: item.categoryDescription,
      terms: 0,
      from: Number.POSITIVE_INFINITY,
      packages: new Set<string>(),
    };
    category.terms += 1;
    category.from = Math.min(category.from, priceFor(item));
    category.packages.add(item.packageId);
    categoryMap.set(item.categoryId, category);
  }

  const categories = [...categoryMap.values()];

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
          <Link href="/me/subscriptions" className="hover:text-foreground">
            Subscriptions
          </Link>
          <span aria-hidden>/</span>
          <span className="text-foreground">Premium plans</span>
        </nav>

        {active ? (
          <header className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-[#00a0e9]/50 sm:p-10">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <BadgeCheck className="size-3.5" /> You&apos;re a premium member
            </span>
            <h1 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {active.packageName ?? active.planName ?? "Premium"} is active
            </h1>
            <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
              {[active.categoryName, active.planName, active.termName]
                .filter(Boolean)
                .join(" · ")}
              {" — "}
              <strong className="font-semibold tabular-nums text-foreground">
                {daysLeft}
              </strong>{" "}
              {daysLeft === 1 ? "day" : "days"} left. Need more? Upgrade to a
              bigger package and pay only the difference for the time remaining.
            </p>
            {held.length > 1 && (
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Also active:{" "}
                {held
                  .slice(1)
                  .map(
                    (item) =>
                      `${[item.categoryName, item.packageName ?? item.planName].filter(Boolean).join(" ")} (${daysUntil(item.expiresAt)} days left)`,
                  )
                  .join(", ")}
              </p>
            )}
            <ul className="mt-6 flex flex-wrap gap-2 text-sm">
              {(
                [
                  ["photos per ad", active.photos],
                  ["active ads", active.ads],
                  ["renewals", active.renews],
                  ["auto-renewals", active.autoRenews],
                  ["videos", active.videos],
                ] as const
              ).map(([label, value]) => (
                <li
                  key={label}
                  className="rounded-full bg-muted px-3 py-1 text-muted-foreground"
                >
                  <strong className="font-semibold tabular-nums text-foreground">
                    {value}
                  </strong>{" "}
                  {label}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              {activeCategory && (
                <Link
                  href={{
                    pathname: "/premium-account/[category]",
                    params: { category: activeCategory.categorySlug },
                  }}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#00a0e9] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#008ccb]"
                >
                  Upgrade my plan <ArrowRight className="size-4" />
                </Link>
              )}
              <Link
                href="/me/subscriptions"
                className="inline-flex h-11 items-center rounded-xl px-5 text-sm font-semibold text-foreground ring-1 ring-border transition-colors hover:bg-muted"
              >
                Manage subscription
              </Link>
            </div>
          </header>
        ) : (
          <header className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-border sm:p-10">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#00a0e9]/10 px-3 py-1 text-xs font-semibold text-[#0089c8]">
              <Sparkles className="size-3.5" /> Premium membership
            </span>
            <h1 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Sell more with a plan that fits your business
            </h1>
            <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
              More photos, more active ads and more renewals. Pay once with
              Bakong KHQR — no card needed.
            </p>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-600" /> Confirmed by
                Bakong before activation
              </span>
              <span className="inline-flex items-center gap-2">
                <Zap className="size-4 text-amber-500" /> Upgrade any time, pay
                only the difference
              </span>
            </div>
          </header>
        )}

        <section className="mt-10" aria-labelledby="browse-heading">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2
                id="browse-heading"
                className="text-xl font-semibold tracking-tight text-foreground"
              >
                Browse by category
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Each category is its own subscription — hold several at once,
                and upgrade any of them for the time it has left.
              </p>
            </div>
            <span className="text-sm text-muted-foreground">
              {categories.length}{" "}
              {categories.length === 1 ? "category" : "categories"}
            </span>
          </div>

          {categories.length === 0 ? (
            <div className="rounded-2xl bg-card p-12 text-center ring-1 ring-border">
              <BriefcaseBusiness className="mx-auto size-8 text-muted-foreground" />
              <h3 className="mt-3 font-semibold text-foreground">
                No plans available
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Please check back later.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category) => {
                const Icon = categoryIcons[category.slug] ?? Grid2X2;
                const mine = heldByCategory.get(category.id);
                return (
                  <Link
                    key={category.id}
                    href={{
                      pathname: "/premium-account/[category]",
                      params: { category: category.slug },
                    }}
                    className="group flex flex-col rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border transition duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-[#00a0e9]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a0e9]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex size-11 items-center justify-center rounded-xl bg-[#00a0e9]/10 text-[#0089c8] transition-colors group-hover:bg-[#00a0e9] group-hover:text-white">
                        <Icon className="size-5" />
                      </span>
                      {mine ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          <BadgeCheck className="size-3.5" />
                          {mine.packageName ?? mine.planName ?? "Active"}
                        </span>
                      ) : (
                        <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                          {category.packages.size}{" "}
                          {category.packages.size === 1
                            ? "package"
                            : "packages"}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-5 text-lg font-semibold text-foreground">
                      {category.name}
                    </h3>
                    <p className="mt-1 line-clamp-2 min-h-11 text-sm leading-5 text-muted-foreground">
                      {category.description ||
                        `Compare ${category.name.toLowerCase()} packages and billing terms.`}
                    </p>
                    <div className="mt-5 flex items-end justify-between border-t border-border pt-4">
                      <div>
                        <p className="text-xs text-muted-foreground">From</p>
                        <p className="text-xl font-semibold tabular-nums text-foreground">
                          ${money(category.from)}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-[#0089c8]">
                        View plans
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {!active && (
          <section className="mt-12" aria-labelledby="how-heading">
            <h2
              id="how-heading"
              className="text-xl font-semibold tracking-tight text-foreground"
            >
              How it works
            </h2>
            <ol className="mt-4 grid gap-4 sm:grid-cols-3">
              {steps.map(({ Icon, title, text }, index) => (
                <li
                  key={title}
                  className="rounded-2xl bg-card p-5 ring-1 ring-border"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-full bg-muted text-foreground">
                      <Icon className="size-4" />
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">
                      Step {index + 1}
                    </span>
                  </div>
                  <h3 className="mt-3 font-medium text-foreground">{title}</h3>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    {text}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}
