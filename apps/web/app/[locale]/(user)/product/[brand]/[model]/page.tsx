import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { GridCardPost } from "@/components/ads/GridCardPost";
import { ProductSpecGroups } from "@/components/product/ProductSpecGroups";
import { ProductSpecHeader } from "@/components/product/ProductSpecHeader";
import { getListingsFeed, toCardPost } from "@/lib/api/categories";
import { getProduct } from "@/lib/api/products";

type ProductPageParams = Promise<{ brand: string; model: string }>;

export async function generateMetadata({
  params,
}: {
  params: ProductPageParams;
}): Promise<Metadata> {
  const { brand, model } = await params;
  const [product, t] = await Promise.all([
    getProduct(brand, model),
    getTranslations("Product"),
  ]);
  if (!product) return { title: t("notFound") };
  return {
    title: t("metaTitle", {
      brand: product.brandName,
      model: product.modelName,
    }),
    description: t("metaDescription", {
      brand: product.brandName,
      model: product.modelName,
    }),
  };
}

export default async function ProductPage({
  params,
}: {
  params: ProductPageParams;
}) {
  const { brand, model } = await params;
  const locale = await getLocale();
  const [product, t] = await Promise.all([
    getProduct(brand, model),
    getTranslations("Product"),
  ]);
  if (!product) notFound();

  const feed = await getListingsFeed(
    { brand: product.brandName, model: product.modelName, limit: 4 },
    locale,
  );
  const posts = (feed?.items ?? []).map(toCardPost);

  return (
    <main className="product-type min-h-screen bg-muted pb-10">
      <div className="px-4 py-4">
        <Breadcrumbs
          className="mx-auto w-full max-w-7xl"
          items={[
            { label: t("home"), href: "/" },
            { label: `${product.brandName} ${product.modelName}` },
          ]}
        />
      </div>

      <div className="mx-auto w-full max-w-7xl space-y-4 px-4 xl:px-0">
        <ProductSpecHeader
          product={product}
          trustedBadge={t("trustedBadge")}
          trustedNote={t("trustedNote")}
        />

        <section className="rounded-sm border border-border bg-card p-6">
          <h2 className="type-section-title text-foreground">
            {t("specifications")}
          </h2>
          <ProductSpecGroups groups={product.specGroups} />
        </section>

        <section className="rounded-sm border border-border bg-card p-4">
          <h2 className="type-section-title text-foreground">
            {t("activeAds")}
          </h2>
          {posts.length > 0 ? (
            <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
              {posts.map((post) => (
                <GridCardPost key={post.postId} post={post} />
              ))}
            </div>
          ) : (
            <p className="mt-2 type-body-sm text-muted-foreground">
              {t("noActiveAds")}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
