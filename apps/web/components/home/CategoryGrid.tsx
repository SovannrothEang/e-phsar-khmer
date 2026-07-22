import { Link } from "@/i18n/routing";
import Image from "next/image";
import { categories } from "@/lib/categories";
import { getTranslations } from "next-intl/server";

export default async function CategoryGrid() {

  const t = await getTranslations("HomePage.BrowseByCategory");

  return (
    <div className="w-full flex justify-center mt-4">
      <div className="w-full max-w-7xl bg-card border rounded-sm pt-4 pb-8">
        <h2 className="text-lg font-medium text-foreground mb-6 px-4">
          {t("title")}
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-y-8 gap-x-8 px-2">
          {categories.map((category) => (
            <Link
              key={String(category.slug)}
              href={{
                pathname: "/category/[categorySlug]",
                params: { categorySlug: category.slug }
              }}
              className="flex flex-col items-center text-center group"
            >
              <div className="w-16 h-16 flex items-center justify-center rounded-full bg-blue-100 group-hover:bg-blue-200 transition">
                <Image
                  src={category.cateIcon}
                  alt={category.name}
                  width={120}
                  height={120}
                  unoptimized
                  className="object-contain"  
                />
              </div>
              <span className="mt-4 text-sm text-foreground  leading-tight">
                {t(category.name)}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}