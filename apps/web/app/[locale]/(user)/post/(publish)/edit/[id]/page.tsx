import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link, redirect } from "@/i18n/routing";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { EditPostClient } from "@/components/post/EditPostClient";
import { ApiError } from "@/lib/api/client";
import { getMyListingById } from "@/lib/api/my-ads";
import {
  getCategoryWithSubcategories,
  resolvePlaceSelection,
} from "@/lib/api/categories";
import { REAL_FORM_SUBCATEGORIES } from "@/lib/post-form-subcategories";
import type { ListingInitialValues } from "@/actions/listings";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Notice({ message, back }: { message: string; back: string }) {
  return (
    <div className="min-h-screen bg-muted">
      <div className="max-w-4xl mx-auto px-4 pt-8 pb-10">
        <div className="bg-card border rounded-sm p-6 shadow-sm text-center">
          <p className="type-body text-muted-foreground">{message}</p>
          <Link
            href="/me"
            className="mt-4 inline-block type-nav text-[#00a0e9] hover:underline"
          >
            {back}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const locale = await getLocale();
  const t = await getTranslations("EditAd");
  const tSearch = await getTranslations("Search");

  let listing;
  try {
    listing = await getMyListingById(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    if (err instanceof ApiError && err.status === 401) {
      return redirect({ href: "/login", locale });
    }
    return <Notice message={t("loadError")} back={t("backToManageAds")} />;
  }

  if (listing.moderatedAt) {
    return <Notice message={t("removedByAdmin")} back={t("backToManageAds")} />;
  }
  if (listing.status === "draft" || listing.status === "deleted") {
    return <Notice message={t("notAvailable")} back={t("backToManageAds")} />;
  }

  const categorySlug = listing.categorySlug;
  const subcategorySlug = listing.subcategorySlug;
  if (
    !categorySlug ||
    !subcategorySlug ||
    !REAL_FORM_SUBCATEGORIES.includes(subcategorySlug)
  ) {
    return (
      <Notice message={t("categoryUnsupported")} back={t("backToManageAds")} />
    );
  }

  const category = await getCategoryWithSubcategories(categorySlug, locale);
  const sub = category?.subcategories.find((s) => s.slug === subcategorySlug);
  if (!category || !sub) notFound();

  const place = await resolvePlaceSelection(
    listing.provinceId,
    listing.districtId,
    listing.communeId,
  );
  const lat = listing.latitude != null ? Number(listing.latitude) : null;
  const lng = listing.longitude != null ? Number(listing.longitude) : null;
  const coords =
    lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)
      ? { lat, lng }
      : null;

  const initialValues: ListingInitialValues = {
    categoryId: listing.categoryId,
    subcategoryId: listing.subcategoryId,
    title: listing.title,
    description: listing.description ?? "",
    price: listing.price ?? "",
    discountValue: listing.discountValue ?? "",
    discountType: listing.discountType ?? "percent",
    condition:
      listing.condition === "new"
        ? "New"
        : listing.condition === "used"
          ? "Used"
          : "",
    attributes: listing.attributes ?? {},
    place: {
      province: place.province,
      district: place.district,
      commune: place.commune,
    },
    address: listing.address ?? "",
    coords,
    deliveryFree: listing.deliveryFree,
    contactName: listing.contactName ?? "",
    contactPhones: [0, 1, 2].map((i) => listing.contactPhones[i] ?? ""),
    contactEmail: listing.contactEmail ?? "",
    // The form clears this at hydration when the linked page is unpublished or
    // outside the picker's slice; keeping the stored id here lets a save send
    // an explicit null for that clear.
    productModelId: listing.productModelId ?? "",
    photos: [...listing.photos]
      .sort((a, b) => a.sort - b.sort)
      .map((p) => ({ url: p.url, path: p.path })),
  };

  return (
    <div className="min-h-screen bg-muted">
      <div className="max-w-4xl mx-auto px-4 pt-8 pb-10">
        <Breadcrumbs
          className="mb-6"
          items={[
            { label: tSearch("home"), href: "/" },
            { label: t("breadcrumb") },
          ]}
        />

        <div className="bg-card border rounded-sm p-6 shadow-sm">
          <h1 className="type-page-title mb-1">{t("title")}</h1>
          <p className="type-body-sm text-muted-foreground mb-4">
            {t("keepDates")}
          </p>
          <EditPostClient
            listingId={listing.id}
            canViewPublic={
              listing.status === "active" || listing.status === "expired"
            }
            categorySlug={categorySlug}
            subcategorySlug={subcategorySlug}
            categoryName={category.name}
            subName={sub.name}
            initialValues={initialValues}
          />
        </div>
      </div>
    </div>
  );
}
