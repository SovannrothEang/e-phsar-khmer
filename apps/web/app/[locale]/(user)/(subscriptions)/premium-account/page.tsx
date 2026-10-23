import { BadgeCheck, ChevronRight, Home } from "lucide-react";
import { Link } from "@/i18n/routing";
import {
  getMySubscriptions,
  getSubscriptionCatalog,
} from "@/actions/subscriptions";
import { activeSubscriptions, daysUntil } from "@/lib/subscription-pricing";

export default async function PremiumAccountPage() {
  const [catalog, subscriptions] = await Promise.all([
    getSubscriptionCatalog().catch(() => []),
    getMySubscriptions().catch(() => []),
  ]);
  // One subscription per group, held side by side.
  const heldByGroup = new Map(
    activeSubscriptions(subscriptions).flatMap((item) =>
      item.groupId ? [[item.groupId, item]] : [],
    ),
  );

  // The catalog arrives in admin sort order, so first-seen order is the
  // order the groups are listed in.
  const groups = new Map<
    string,
    { id: string; name: string; slug: string; description: string | null }
  >();
  for (const item of catalog) {
    if (!groups.has(item.groupId)) {
      groups.set(item.groupId, {
        id: item.groupId,
        name: item.groupName,
        slug: item.groupSlug,
        description: item.groupDescription,
      });
    }
  }

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
          <span className="text-muted-foreground">Premium Account</span>
        </nav>

        <h1 className="text-2xl font-semibold text-foreground">
          Increase your sales with PSA Khmer Premium Service!
        </h1>
        <p className="mt-3 text-foreground">
          Choose the right category for your ads and start selling faster.
        </p>

        {groups.size === 0 ? (
          <div className="mt-6 rounded-md bg-card p-12 text-center ring-1 ring-border">
            <h2 className="font-semibold text-foreground">
              No plans available
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Please check back later.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {[...groups.values()].map((group) => {
              const mine = heldByGroup.get(group.id);
              return (
                <article
                  key={group.id}
                  className="rounded-md bg-card px-6 py-6 ring-1 ring-border"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold text-foreground">
                      {group.name}
                    </h2>
                    {mine && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        <BadgeCheck className="size-3.5" />
                        {mine.packageName ?? mine.planName ?? "Active"} ·{" "}
                        {daysUntil(mine.expiresAt)} days left
                      </span>
                    )}
                  </div>
                  {group.description && (
                    <p className="mt-4 text-foreground">{group.description}</p>
                  )}
                  <Link
                    href={{
                      pathname: "/premium-account/[category]",
                      params: { category: group.slug },
                    }}
                    className="mt-5 inline-flex items-center gap-1 font-medium text-[#00a0e9] underline underline-offset-4 hover:text-[#0089c8]"
                  >
                    {mine ? "Upgrade" : "Subscribe"}
                    <ChevronRight className="size-4" />
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
