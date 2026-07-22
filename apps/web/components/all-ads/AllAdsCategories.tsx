import { Link } from "@/i18n/routing";
import Image from "next/image";
import { categories } from "@/lib/categories";
import { useTranslations } from "next-intl"

export default function AllAdsCategories() {
  const t =  useTranslations("HomePage.BrowseByCategory");
  return (
    <div>
      <ul className="bg-muted text-center grid grid-cols-6 text-md gap-2">
        {categories.map((category) => (
          <li key={String(category.slug)}>
            <Link
              href={{
                pathname: "/category/[categorySlug]",
                params: { categorySlug: category.slug }
              }}
              className="block h-full group bg-card rounded cursor-pointer active:opacity-50 pt-4 pb-4">
              <div className="mx-auto bg-blue-50 rounded-full w-16 h-16 group-hover:bg-blue-100 transition-colors">
                <Image
                  src={category.cateIcon}
                  alt={category.name}
                  width={120}
                  height={120}
                  unoptimized
                  className="object-contain"
                />
              </div>
              <p className="mt-3 text-sm ">
                {t(category.name)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div >
  );
}