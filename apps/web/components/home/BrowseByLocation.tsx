import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import { locations } from "@/lib/location";

export default async function BrowseByLocation() {
  const t = await getTranslations("HomePage.BrowseByLocation");
  return (
    <div className="bg-card rounded border border-border p-6">
      <h2 className="text-lg font-medium text-foreground mb-4">{t("title")}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-9 gap-y-3">
        {locations.map((province) => (
          <Link
            key={String(province.slug)}
            href={{
              pathname: "/all-ads",
              query: {
                province: province.slug,
              },
            }}
            className="text-foreground hover:text-[#0095ca] text-sm"
          >
            {t(province.name)}
          </Link>
        ))}
      </div>
    </div>
  );
}
