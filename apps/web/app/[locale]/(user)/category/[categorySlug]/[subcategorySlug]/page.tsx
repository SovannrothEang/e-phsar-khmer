'use client'
import type { ComponentType } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Link } from "@/i18n/routing";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { IconHome, IconChevronRightFilled } from "@tabler/icons-react";
import { categories } from "@/lib/categories";
import {
  LSP_SUBCATEGORIES,
  LSPC_SUBCATEGORIES,
  LSPYCE_SUBCATEGORIES,
  LSPYC_SUBCATEGORIES,
  LS_SUBCATEGORIES,
  LSS_SUBCATEGORIES,
} from "@/lib/subcategoryGroups";
// ─── Subcategory header components ────────────────────────────────────────────
import LSPHeader    from "@/components/subcategory-layouts/LSPHeader";
import LSPCHeader   from "@/components/subcategory-layouts/LSPCHeader";
import LSPYCHeader  from "@/components/subcategory-layouts/LSPYCHeader";
import LSPCYEHeader from "@/components/subcategory-layouts/LSPYCEHeader";
import LSHeader     from "@/components/subcategory-layouts/LSHeader";
import LSSHeader    from "@/components/subcategory-layouts/LSSHeader";
// ─── Content & ads ────────────────────────────────────────────────────────────
import SubcategoryContent from "@/components/subcategory-layouts/SubcategoryContent";
import HighLightAds       from "@/components/ads/HighLightAds";
import NormalAd           from "@/components/ads/NormalAd";
import AdsPhoto           from "@/components/ads/AdsPhoto";
// ─── Header lookup map (avoids long if-else chain) ───────────────────────────
type HeaderProps = { title: string };
const buildMap = (
  slugs: string[],
  Component: ComponentType<HeaderProps>
): Record<string, ComponentType<HeaderProps>> =>
  Object.fromEntries(slugs.map((s) => [s, Component]));
const HEADER_MAP: Record<string, ComponentType<HeaderProps>> = {
  ...buildMap(LSP_SUBCATEGORIES,   LSPHeader),
  ...buildMap(LS_SUBCATEGORIES,    LSHeader),
  ...buildMap(LSS_SUBCATEGORIES,   LSSHeader),
  ...buildMap(LSPC_SUBCATEGORIES,  LSPCHeader),
  ...buildMap(LSPYCE_SUBCATEGORIES, LSPCYEHeader),
  ...buildMap(LSPYC_SUBCATEGORIES,  LSPYCHeader),
};
// ─── Ad block layout (deduped) ────────────────────────────────────────────────
const AD_BLOCKS: ComponentType[] = [
  NormalAd,
  AdsPhoto,
  HighLightAds,
  AdsPhoto,
  HighLightAds,
];
// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SubcategoryPage() {
  const { categorySlug, subcategorySlug } = useParams<{
    categorySlug: string;
    subcategorySlug: string;
  }>();
  const searchParams  = useSearchParams();
  const brand         = searchParams.get("ad_field");
  const bodyType      = searchParams.get("body_type");
  const isFiltered    = !!(brand || bodyType);
  // ── Data lookup ─────────────────────────────────────────────────────────────
  const category    = categories.find((c) => c.slug === categorySlug);
  const subcategory = category?.subcategories.find((s) => s.slug === subcategorySlug);
  if (!category || !subcategory) {
    return <div>Page not found</div>;
  }
  // ── Header component ────────────────────────────────────────────────────────
  const HeaderComponent: ComponentType<HeaderProps> =
    HEADER_MAP[subcategorySlug] ?? LSPHeader;
  // ── Active filter label ─────────────────────────────────────────────────────
  const filterLabel = (brand ?? bodyType)?.replace(/-/g, " ");
  return (
    <main className="min-h-screen flex flex-col bg-gray-100">
      {/* ── Top banner ad ─────────────────────────────────────────────────── */}
      <div className="w-full flex justify-center py-6">
        <div className="w-full max-w-4xl">
          <Link href="/">
            <AspectRatio ratio={4} className="bg-muted rounded-none cursor-pointer">
              <Image
                src="/ads/landforsale.jpg"
                alt="Land for sale advertisement"
                fill
                priority
                className="object-cover rounded-none"
              />
            </AspectRatio>
          </Link>
        </div>
      </div>
      {/* ── Breadcrumb + header ───────────────────────────────────────────── */}
      <div className="px-4 py-2">
        <div className="max-w-7xl mx-auto w-full pb-1">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-base" aria-label="Breadcrumb">
            <Link
              href="/"
              className="group flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-300 transition-colors duration-150"
            >
              <IconHome size={18} />
              <span>Home</span>
            </Link>
            <IconChevronRightFilled size={16} className="mt-1 text-gray-500" />
            <Link
              href={{
                pathname: "/category/[categorySlug]",
                params: { categorySlug: category.slug },
              }}
              className="text-gray-500 dark:text-gray-400 hover:text-blue-300 transition-colors duration-150"
            >
              {category.name}
            </Link>
            <IconChevronRightFilled size={16} className="mt-1 text-gray-500" />
            {isFiltered ? (
              <Link
                href={{
                  pathname: "/category/[categorySlug]/[subcategorySlug]",
                  params: {
                    categorySlug: category.slug,
                    subcategorySlug: subcategory.slug,
                  },
                }}
                className="text-gray-500 dark:text-gray-400 hover:text-blue-300 transition-colors duration-150"
              >
                {subcategory.name}
              </Link>
            ) : (
              <span className="text-gray-500 dark:text-gray-400">
                {subcategory.name} in Cambodia
              </span>
            )}
            {isFiltered && (
              <>
                <IconChevronRightFilled size={16} className="mt-1 text-gray-500" />
                <span className="text-gray-500 dark:text-gray-400 capitalize">
                  {filterLabel} in Cambodia
                </span>
              </>
            )}
          </nav>
          {/* Subcategory header */}
          <div className="mt-2">
            <HeaderComponent title={subcategory.name} />
          </div>
          {/* Main listing content */}
          <div className="py-2">
            <SubcategoryContent
              categorySlug={categorySlug}
              subcategorySlug={subcategorySlug}
              subcategory={subcategory}
            />
          </div>
          {/* ── Ad blocks ───────────────────────────────────────────────────── */}
          {AD_BLOCKS.map((AdComponent, index) => (
            <div key={index} className="max-w-7xl mx-auto w-full py-2">
              <AdComponent />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
