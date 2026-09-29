"use client";
import { Link } from "@/i18n/routing";
import Image from "next/image";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { IconHome } from "@tabler/icons-react";
import { ChevronRight, Truck } from "lucide-react";
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
import ListingSpecs from "./ListingSpecs";
import type { BackendListing } from "@/lib/api/categories";
import type { Post } from "@/lib/posts";
import type { User } from "@/lib/user";
import type { ListingContext } from "@/types/chat";
import { applyDiscount } from "@/lib/utils";

/**
 * Real-listing data slotted into this template. The page (RSC) builds this from
 * `GET /listings/:id` + the categories list (breadcrumb) + the listing's own
 * contact fields (seller card), so the SAME design renders for real and mock
 * posts.
 */
export interface RealDetailData {
  listing: BackendListing;
  cate?: { slug: string; name: string };
  subcate?: { slug: string; name: string };
  brand?: { slug: string; name: string };
  model?: { slug: string; name: string };
  seller: User;
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
}: {
  id: string;
  real?: RealDetailData;
  /** Signed-in viewer's id, if any — lets the sidebar tell "your ad" apart
   *  from a stranger's and hide seller-contact actions accordingly. */
  viewerId?: string | null;
}) {
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

  // Mock listings have no matching row in the real `listings` table — attaching
  // their id would only 400 once a message actually tries to send it.
  const listingContext: ListingContext | null = isReal
    ? toListingContext(real.listing)
    : null;

  const displayId = isReal
    ? real.listing.id.slice(0, 8).toUpperCase()
    : post.postId;
  const locationLine = isReal
    ? [real.listing.location, real.listing.address].filter(Boolean).join(", ")
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
      <div className="max-w-4xl mx-auto w-full gap-4 px-4 pb-4">
        <div className="flex-1 space-y-2">
          <Link href="/" target="_blank">
            <AspectRatio
              ratio={4}
              className="bg-muted rounded-none cursor-pointer"
            >
              <Image
                src="/ads/landforsale.jpg"
                alt="Photo"
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                loading="eager"
                className="object-cover rounded-none"
                unoptimized={true}
              />
            </AspectRatio>
          </Link>
        </div>
      </div>
      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto w-full pb-2">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <Link
            href="/"
            className="group flex items-center transition-colors duration-150 hover:text-[#00a0e9]"
          >
            <IconHome size={18} className="group-hover:text-[#00a0e9]" />
            <span className="pl-1.5">Home</span>
          </Link>
          {cate && (
            <>
              <ChevronRight size={14} />
              <Link
                href={{
                  pathname: "/category/[categorySlug]",
                  params: { categorySlug: cate.slug },
                }}
                className="hover:text-[#00a0e9]"
              >
                {cate.name}
              </Link>
            </>
          )}
          {subcate && (
            <>
              <ChevronRight size={14} />
              <Link
                href={{
                  pathname: "/category/[categorySlug]/[subcategorySlug]",
                  params: {
                    categorySlug: cate?.slug || "",
                    subcategorySlug: subcate.slug,
                  },
                }}
                className="hover:text-[#00a0e9]"
              >
                {subcate.name}
              </Link>
            </>
          )}
          {hasBrand && (
            <>
              <ChevronRight size={14} />
              <Link
                href={{
                  pathname:
                    "/category/[categorySlug]/[subcategorySlug]/[brandOrType]",
                  params: {
                    categorySlug: cate?.slug || "",
                    subcategorySlug: subcate?.slug || "",
                    brandOrType: brand.slug,
                  },
                }}
                className="hover:text-[#00a0e9]"
              >
                {brand.name}
              </Link>
            </>
          )}
          {hasModel && (
            <>
              <ChevronRight size={14} />
              <span>{model.name}</span>
            </>
          )}
        </nav>
      </div>
      {/* Main content */}
      <div className="max-w-7xl mx-auto w-full mt-2 mb-10">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 w-full min-w-38 space-y-4">
            <div className="bg-card border rounded-sm overflow-hidden">
              <PostImage post={post} />
              <div className="px-4 pt-3 pb-0">
                <h1 className="text-xl md:text-3xl font-medium text-foreground leading-snug">
                  {post.title}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-[13px] text-foreground mt-2">
                  <p>ID {displayId}</p>
                  <div className="flex items-center">
                    <IconMapPin className="w-4 h-4 mr-1" />
                    {locationLine}
                  </div>
                  <div className="flex items-center">
                    <IconClockHour4 className="w-4 h-4 mr-1" />
                    {post.createdat.toLocaleString()}
                  </div>
                </div>
                {post.freeDelivery && (
                  <div className="mt-3">
                    <span className="inline-flex items-center px-2 py-0.5 bg-blue-50 text-[#00a0e9] text-xs font-medium rounded-sm border border-blue-100">
                      <Truck className="w-3.5 h-3.5 mr-1" /> Free Delivery
                    </span>
                  </div>
                )}
                <div className="flex items-end gap-2.5 mt-3 pb-4">
                  <span className="text-xl md:text-2xl font-medium text-[#e3281b] leading-none">
                    {post.price === null ? "Negotiable" : `$${post.price}`}
                  </span>
                  {post.oldPrice && (
                    <span className="text-sm text-gray-400 line-through mb-0.5">
                      ${post.oldPrice}
                    </span>
                  )}
                  {post.discount && (
                    <span className="text-sm bg-[#fdf0e6] text-[#f68b1e] px-1.5 py-0.5 rounded-sm mb-1">
                      {post.discount}
                    </span>
                  )}
                </div>
              </div>
              <hr className="border" />
              {/* Description */}
              <div className="p-4">
                <h2 className="text-xl font-semibold text-foreground mb-4">
                  Description
                </h2>
                {isReal && (
                  <ListingSpecs
                    cate={real.cate}
                    subcate={real.subcate}
                    brand={real.brand}
                    model={real.model}
                    attributes={real.listing.attributes}
                    condition={real.listing.condition}
                  />
                )}
                <p className="whitespace-pre-line leading-10">
                  {post.description}
                </p>
                <ContactUser
                  user={user}
                  district={district}
                  province={province}
                  coords={coords}
                  locationLine={isReal ? locationLine : undefined}
                />
                <div className="border-t border-muted-foreground/20 mt-4" />
                <ThreeButton post={post} />
              </div>
            </div>
            {/* Disclaimer */}
            <div className="bg-card border-l-3 border-l-[#f68b1e] rounded-r-sm p-4 text-sm shadow-sm">
              <h3 className="text-[#f68b1e] font-semibold text-sm mb-2">
                ការមិនទទួលខុសត្រូវ / Disclaimer
              </h3>
              <p className="text-sm text-foreground !leading-relaxed">
                យើងខ្ញុំមិនគ្រប់គ្រងមាតិកា
                ដែលបានបង្ហោះឡើងដោយសមាជិកឡើយ។ដូច្នេះយើងមិនទទួលខុសត្រូវលើការផ្សាយផលិតផលនេះទេ
                ហើយក៏មិនធានាចំពោះបញ្ហាដែលទាក់ទងដោយផ្ទាល់ ឬ ប្រយោលទៅនឹងសកម្មភាព ឬ
                អសកម្មណាមួយឡើយ។
              </p>
              <p className="text-sm text-foreground leading-relaxed mt-2">
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
              />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
