import { Link } from "@/i18n/routing";
import { ChevronRight } from "lucide-react";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";

const categories = [
  {
    name: "Auto",
    slug: "auto",
    decription:
      "Increase your listing up to 30 Ads, 10 renew & 20 auto-renew in category cars, motor, bike & rental.",
  },
  {
    name: "Food",
    slug: "food",
    decription:
      "Increase your listing up to 200 Ads, 20 renew & 20 auto-renew in food category.",
  },
  {
    name: "General",
    slug: "general",
    decription:
      "Increase your listing up to 200 Ads, 20 renew & 20 auto-renew in category phone, tablet, computer, electronic, furniture, decor & fashion.",
  },
  {
    name: "Property",
    slug: "property",
    decription:
      "Increase your listing up to 1000 Ads, 75 renew, 75 auto-renew, 2 featured Ads & 1 top Ads in category house, land, condo, apartment & rental.",
  },
  {
    name: "Services",
    slug: "services",
    decription:
      "Increase your listing up to 30 Ads, 10 renew & 20 auto-renew in service category.",
  },
];

export default function PremiumAccountPage() {
  return (
    <div className="min-h-screen bg-muted pb-10">
      <div className="max-w-7xl mx-auto py-4">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Profile", href: "/me" },
            { label: "Membership", href: { pathname: "/me/membership" } },
            { label: "Account" },
          ]}
        />
      </div>
      <main className="max-w-4xl mx-auto px-4">
        <div className="py-4 space-y-2">
          <h1 className="text-xl font-semibold">
            Increase your sales with Psa Khmer Premium Service!
          </h1>
          <span className=" text-sm text-foreground block py-1">
            Choose the right category for your ads and start selling faster.
          </span>

          {categories.map((cat) => (
            <div
              key={cat.slug}
              className="border bg-card rounded-sm p-4  py-3 pb-3 space-y-2 "
            >
              <h2 className="font-semibold text-lg ">{cat.name}</h2>
              <p className="text-sm text-foreground">{cat.decription}</p>

              <Link
                href={{
                  pathname: "/premium-account/[category]",
                  params: { category: cat.slug },
                  query: { id: "me" },
                }}
                className="text-[#00a0e9] text-sm font-semibold flex items-center underline"
              >
                Subscribe
                <ChevronRight size={16} className="block text-[#00a0e9]" />
              </Link>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
