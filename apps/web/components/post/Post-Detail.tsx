"use client";
import { useEffect, useRef } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Truck } from "lucide-react";
import AdvertisementCarousel from "@/components/ads/AdvertisementCarousel";
import type { AdvertisementCard } from "@/lib/api/advertisements";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { IconClockHour4, IconMapPin } from "@tabler/icons-react";
import ProfileSidebar from "./Profile-Sidebar";
import {
  getPostById,
  getUserById,
  getProvinceById,
  getDistrictById,
  getCategoryById,
  getSubCategoryById,
  getBrandById,
  getModelById,
} from "@/lib/data";
import { notFound } from "next/navigation";
import LoanCalculator from "./LoanCalculator";
import ContactUser from "./ContactUser";
import { ThreeButton } from "./ThreeButton";
import PostImage from "./PostImage";
import { PostSocialActions } from "./PostSocialActions";
import { ApplyJobButton } from "./ApplyJobButton";
import type { ApplyResumeSummary } from "./ApplyJobDialog";
import ListingSpecs from "./ListingSpecs";
import type { BackendListing } from "@/lib/api/categories";
import type { Post } from "@/lib/posts";
import type { User } from "@/lib/user";
import type { ListingContext } from "@/types/chat";
import { applyDiscount, shortLocation } from "@/lib/utils";
import { trackEvent } from "@/lib/insights/queue";

/**
 * Real-listing data slotted into this template. The page (RSC) builds this from
 * `GET /listings/:id` + the categories list (breadcrumb) + the listing's own
 * contact fields (seller card), so the SAME design renders for real and mock
 * posts.
 */
export interface RealDetailData {
  listing: BackendListing;
  /** Km display values for the listing's attribute keys (taxType, bodyType, color, …). */
  valueLabels?: Record<string, string>;
  cate?: { slug: string; name: string };
  subcate?: { slug: string; name: string };
  brand?: { slug: string; name: string };
  model?: { slug: string; name: string };
  seller: User;
}

/**
 * What the Apply control needs beyond the listing itself — assembled by the
 * page only for a real, active job listing the viewer neither owns nor has
 * already applied to. Absent means "render no Apply control at all".
 */
export interface JobApplyState {
  /** The viewer's existing application id, when they already applied. */
  appliedApplicationId: string | null;
  resume: ApplyResumeSummary | null;
}

/** Adapt a backend listing into the template's local `Post` shape. */
function toPostView(l: BackendListing): Post {
  // Null is a real state — see `toCardPost`. A no-price listing must not be
  // shown as $0; the template prints "Negotiable" for it.
  const price =
    l.price !== null && Number.isFinite(Number(l.price))
      ? Number(l.price)
      : null;
  const discount =
    l.discountValue !== null && l.discountType !== null
      ? `${Number(l.discountValue)}${l.discountType === "percent" ? "%" : " $"}`.trim()
      : undefined;
  return {
    postId: l.id,
    userId: l.userId,
    title: l.title,
    images: l.photos.map((p) => p.url),
    imageCount: l.photos.length,
    // The listing price is the ORIGINAL; the discount applies on top — the
    // bold price is the final, the strikethrough is the original.
    price:
      price === null
        ? null
        : applyDiscount(price, l.discountValue, l.discountType),
    cateId: "",
    subId: "",
    brandId: undefined,
    modelId: undefined,
    oldPrice:
      price !== null && l.discountValue && l.discountType ? price : undefined,
    discount,
    description: l.description ?? "",
    createdat: new Date(l.createdAt),
    proId: "",
    disId: "",
    freeDelivery: l.deliveryFree,
    // Seeds the "N Likes" control; toggle responses update it from there.
    likeCount: l.likeCount ?? 0,
  };
}

/** Preview card handed to "Message seller" — see ContactSellerButton. */
function toListingContext(l: BackendListing): ListingContext {
  return {
    id: l.id,
    title: l.title,
    price: l.price,
    currency: l.currency ?? "USD",
    status: isListingStatus(l.status) ? l.status : "active",
    thumbnailUrl: l.photos[0]?.url ?? null,
  };
}

function isListingStatus(value: string): value is ListingContext["status"] {
  return (
    value === "draft" ||
    value === "active" ||
    value === "expired" ||
    value === "deleted"
  );
}

export default function PostDetail({
  id,
  real,
  viewerId,
  sellerFollowing = false,
  jobApply = null,
  banners = [],
}: {
  id: string;
  real?: RealDetailData;
  /** Signed-in viewer's id, if any — lets the sidebar tell "your ad" apart
   *  from a stranger's and hide seller-contact actions accordingly. */
  viewerId?: string | null;
  /** Whether that viewer already follows the seller — seeds the sidebar toggle. */
  sellerFollowing?: boolean;
  /** Present only when this viewer may apply to *this* job listing. */
  jobApply?: JobApplyState | null;
  /** The `listing_detail` banners — fetched by the server page above this one. */
  banners?: AdvertisementCard[];
}) {
  const t = useTranslations();
  const format = useFormatter();
  const realListingId = real?.listing.id ?? null;
  const realListingOwnerId = real?.listing.userId ?? null;
  const viewTrackedFor = useRef<string | null>(null);

  // One view per listing per mounted detail page. The ref is keyed by id so
  // Strict Mode cannot double-count and client navigation between listings
  // still records the new one.
  useEffect(() => {
    if (!realListingId) return;
    if (viewerId && viewerId === realListingOwnerId) return;
    if (viewTrackedFor.current === realListingId) return;

    viewTrackedFor.current = realListingId;
    trackEvent(realListingId, "view");
  }, [realListingId, realListingOwnerId, viewerId]);

  const isReal = !!real;
  const post = isReal ? toPostView(real.listing) : getPostById(id);
  if (!post) return notFound();
  const user = isReal ? real.seller : getUserById(post.userId);
  if (!user) return null;
  const province = isReal ? undefined : getProvinceById(post.proId);
  const district = isReal ? undefined : getDistrictById(post.proId, post.disId);
  const cate = isReal ? real.cate : getCategoryById(post.cateId);
  const subcate = isReal ? real.subcate : getSubCategoryById(post.subId);
  const brand = isReal ? real.brand : getBrandById(post.brandId ?? "");
  const model = isReal ? real.model : getModelById(post.modelId ?? "");

  const hasBrand = !!brand;
  const hasModel = !!model;

  // The one listing family whose header differs: a job moves the like/share
  // pair beside the title and carries the Apply control (captain's mock,
  // 2026-10-16). Every other listing renders exactly as before.
  const isJobListing = isReal && cate?.slug === "jobs";

  // Mock listings have no matching row in the real `listings` table — attaching
  // their id would only 400 once a message actually tries to send it.
  const listingContext: ListingContext | null = isReal
    ? toListingContext(real.listing)
    : null;

  const displayId = isReal
    ? real.listing.id.slice(0, 8).toUpperCase()
    : post.postId;
  // Two forms of the same value, in two places: the ID row carries the card's
  // short `district, province`, while the contact block below spells the whole
  // location out with the street address on its own line (see ContactUser).
  const fullLocation = isReal
    ? (real.listing.location ?? undefined)
    : undefined;
  const addressLine = isReal ? (real.listing.address ?? undefined) : undefined;
  const locationLine = isReal
    ? (shortLocation(real.listing.location) ?? "")
    : [district?.name, province?.name].filter(Boolean).join(", ");

  // The pin the seller dropped when posting (numeric columns arrive as strings).
  const lat =
    isReal && real.listing.latitude != null
      ? Number(real.listing.latitude)
      : NaN;
  const lng =
    isReal && real.listing.longitude != null
      ? Number(real.listing.longitude)
      : NaN;
  const coords =
    Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;

  return (
    <main className="min-h-screen flex flex-col bg-muted block pt-6">
      {/* Ad Banner */}
      {banners.length > 0 && (
        <div className="max-w-4xl mx-auto w-full gap-4 px-4 pb-4">
          <div className="flex-1 space-y-2">
            <AdvertisementCarousel banners={banners} priority />
          </div>
        </div>
      )}
      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto w-full pb-2">
        <Breadcrumbs
          className="flex-wrap"
          items={[
            { label: t("Search.home"), href: "/" },
            ...(cate
              ? [
                  {
                    label: cate.name,
                    href: {
                      pathname: "/category/[categorySlug]" as const,
                      params: { categorySlug: cate.slug },
                    },
                  },
                ]
              : []),
            ...(subcate
              ? [
                  {
                    label: subcate.name,
                    href: {
                      pathname:
                        "/category/[categorySlug]/[subcategorySlug]" as const,
                      params: {
                        categorySlug: cate?.slug || "",
                        subcategorySlug: subcate.slug,
                      },
                    },
                  },
                ]
              : []),
            ...(hasBrand
              ? [
                  {
                    label: brand.name,
                    href: {
                      pathname:
                        "/category/[categorySlug]/[subcategorySlug]/[brandOrType]" as const,
                      params: {
                        categorySlug: cate?.slug || "",
                        subcategorySlug: subcate?.slug || "",
                        brandOrType: brand.slug,
                      },
                    },
                  },
                ]
              : []),
            ...(hasModel ? [{ label: model.name }] : []),
          ]}
        />
      </div>
      {/* Main content */}
      <div className="max-w-7xl mx-auto w-full mt-2 mb-10">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 w-full min-w-38 space-y-4">
            <div className="bg-card border rounded-sm overflow-hidden">
              {/* A job ad leads with its logo beside the details, not with a
                  full-bleed banner (the captain's mock): the strip of small
                  images is the gallery, the title/price/Apply block sits next
                  to it. Every other listing keeps the hero gallery above. */}
              <div
                className={
                  isJobListing
                    ? "flex flex-col sm:flex-row gap-3 p-3"
                    : undefined
                }
              >
                <PostImage
                  post={post}
                  showActions={!isJobListing}
                  variant={isJobListing ? "thumbs" : "hero"}
                />
                <div
                  className={
                    isJobListing ? "min-w-0 flex-1 sm:pt-0.5" : "px-4 pt-3 pb-0"
                  }
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <h1 className="type-page-title text-foreground flex-1 min-w-0">
                      {post.title}
                    </h1>
                    {isJobListing && (
                      <PostSocialActions
                        post={post}
                        className="flex gap-2 shrink-0"
                      />
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 type-meta text-foreground mt-2">
                    <p>ID {displayId}</p>
                    <div className="flex items-center">
                      <IconMapPin className="w-4 h-4 mr-1" />
                      {locationLine}
                    </div>
                    <div className="flex items-center">
                      <IconClockHour4 className="w-4 h-4 mr-1" />
                      {format.dateTime(post.createdat, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </div>
                  </div>
                  {post.freeDelivery && (
                    <div className="mt-3">
                      <span className="inline-flex items-center px-2 py-0.5 bg-blue-50 text-[#00a0e9] type-button-sm rounded-sm border border-blue-100">
                        <Truck className="w-3.5 h-3.5 mr-1" />{" "}
                        {t("Common.freeDelivery")}
                      </span>
                    </div>
                  )}
                  <div className="flex items-end justify-between gap-3 flex-wrap mt-3 pb-4">
                    <div className="flex items-end gap-2.5">
                      <span className="type-price text-[#e3281b]">
                        {post.price === null
                          ? t("Common.negotiable")
                          : `$${post.price}`}
                      </span>
                      {post.oldPrice && (
                        <span className="type-body-sm text-gray-400 line-through mb-0.5">
                          ${post.oldPrice}
                        </span>
                      )}
                      {post.discount && (
                        <span className="type-discount bg-[#fdf0e6] text-[#f68b1e] px-1.5 py-0.5 rounded-sm mb-1">
                          {post.discount}
                        </span>
                      )}
                    </div>
                    {jobApply && real && (
                      <ApplyJobButton
                        listingId={real.listing.id}
                        listingTitle={real.listing.title}
                        viewerId={viewerId ?? null}
                        resume={jobApply.resume}
                        appliedApplicationId={jobApply.appliedApplicationId}
                      />
                    )}
                  </div>
                </div>
              </div>
              <hr className="border" />
              {/* Description */}
              <div className="p-4">
                <h2 className="type-section-title text-foreground mb-4">
                  {t("Post.description")}
                </h2>
                {isReal && (
                  <ListingSpecs
                    cate={real.cate}
                    subcate={real.subcate}
                    brand={real.brand}
                    model={real.model}
                    attributes={real.listing.attributes}
                    valueLabels={real.valueLabels}
                    condition={real.listing.condition}
                  />
                )}
                <p className="whitespace-pre-line type-body">
                  {post.description}
                </p>
                <ContactUser
                  user={user}
                  district={district}
                  province={province}
                  coords={coords}
                  locationLine={isReal ? fullLocation : undefined}
                  addressLine={addressLine}
                  listingId={real?.listing.id}
                />
                <div className="border-t border-muted-foreground/20 mt-4" />
                <ThreeButton post={post} viewerId={viewerId} />
              </div>
            </div>
            {/* Disclaimer */}
            <div className="bg-card border-l-3 border-l-[#f68b1e] rounded-r-sm p-4 type-body-sm shadow-sm">
              <h3 className="text-[#f68b1e] type-card-heading mb-2">
                ការមិនទទួលខុសត្រូវ / Disclaimer
              </h3>
              <p className="type-body-sm text-foreground">
                យើងខ្ញុំមិនគ្រប់គ្រងមាតិកា
                ដែលបានបង្ហោះឡើងដោយសមាជិកឡើយ។ដូច្នេះយើងមិនទទួលខុសត្រូវលើការផ្សាយផលិតផលនេះទេ
                ហើយក៏មិនធានាចំពោះបញ្ហាដែលទាក់ទងដោយផ្ទាល់ ឬ ប្រយោលទៅនឹងសកម្មភាព ឬ
                អសកម្មណាមួយឡើយ។
              </p>
              <p className="type-body-sm text-foreground mt-2">
                We does not control the content posted by members and therefore
                assumes no responsibility and disclaims any liability for any
                consequence relating directly or indirectly to any action or
                inaction.
              </p>
            </div>
            {/* Loan Calculator */}
            <LoanCalculator />
            {/* <p className="text-xl font-medium">Related posts</p>
            <div>
                <GridCardPost post={post} />
            </div> */}
          </div>
          {/* Sidebar */}
          <aside className="w-full md:w-[400px] shrink-0">
            <div className="sticky top-20 space-y-2">
              <ProfileSidebar
                userId={post.userId}
                user={user}
                listingId={listingContext ? listingContext.id : undefined}
                listing={listingContext}
                viewerId={viewerId}
                initialFollowing={sellerFollowing}
              />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
