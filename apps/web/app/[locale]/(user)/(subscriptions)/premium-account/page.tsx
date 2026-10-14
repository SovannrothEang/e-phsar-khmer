import {
  ArrowRight,
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
  getSubscriptionCatalog,
  type SubscriptionCatalogItem,
} from "@/actions/subscriptions";

const categoryIcons: Record<string, LucideIcon> = {
  auto: CarFront,
  food: Utensils,
  general: Grid2X2,
  property: House,
  services: BriefcaseBusiness,
};

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
  const catalog = await getSubscriptionCatalog().catch(() => []);
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
          <Link href="/me/membership" className="hover:text-foreground">
            Membership
          </Link>
          <span aria-hidden>/</span>
          <span className="text-foreground">Premium plans</span>
        </nav>

        <header className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-border sm:p-10">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#00a0e9]/10 px-3 py-1 text-xs font-semibold text-[#0089c8]">
            <Sparkles className="size-3.5" /> Premium membership
          </span>
          <h1 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Sell more with a plan that fits your business
          </h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
            More photos, more active ads and more renewals. Pay once with Bakong
            KHQR — no card needed.
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
                Choose where you want to grow your listings.
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
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                        {category.packages.size}{" "}
                        {category.packages.size === 1 ? "package" : "packages"}
                      </span>
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
      </div>
    </div>
  );
}
