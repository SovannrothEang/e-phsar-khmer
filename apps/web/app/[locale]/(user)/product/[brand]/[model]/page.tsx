import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import DbImage from "@/components/common/DbImage";
import { GridCardPost } from "@/components/ads/GridCardPost";
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
    <main className="min-h-screen bg-muted pb-8">
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
        <header className="flex flex-col gap-4 rounded-sm border border-border bg-card p-4 sm:flex-row sm:items-center">
          <div className="flex size-28 shrink-0 items-center justify-center rounded-md bg-muted/40 p-3">
            <DbImage
              src={product.image ?? ""}
              alt={`${product.brandName} ${product.modelName}`}
              width={112}
              height={112}
              className="object-contain"
              fallback={
                <span className="type-page-title text-muted-foreground">
                  {product.brandName.charAt(0).toUpperCase()}
                </span>
              }
            />
          </div>
          <div className="min-w-0">
            <p className="type-meta text-muted-foreground">
              {product.brandName}
            </p>
            <h1 className="type-page-title text-foreground">
              {product.modelName}
            </h1>
            <p className="type-body-sm mt-1 text-muted-foreground">
              {t("trustedNote")}
            </p>
          </div>
        </header>

        <section className="rounded-sm border border-border bg-card p-4">
          <h2 className="type-section-title text-foreground">
            {t("specifications")}
          </h2>
          <div className="mt-4 space-y-6">
            {product.specGroups.map((group, groupIndex) => (
              <div key={`${group.title}-${groupIndex}`}>
                <h3 className="type-card-heading border-b border-border pb-2 text-foreground">
                  {group.title}
                </h3>
                <dl className="divide-y divide-border">
                  {group.rows.map((row, rowIndex) => (
                    <div
                      key={`${row.label}-${rowIndex}`}
                      className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-2 sm:gap-4"
                    >
                      <dt className="type-body-sm text-muted-foreground">
                        {row.label}
                      </dt>
                      <dd className="type-body-sm text-foreground">
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
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
