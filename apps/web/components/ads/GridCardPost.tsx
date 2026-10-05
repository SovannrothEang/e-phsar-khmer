"use client";

import DbImage from "@/components/common/DbImage";
import { Link } from "@/i18n/routing";
import { Post } from "@/lib/posts";
import { toSlug } from "@/lib/utils";
import { getProvinceById, getDistrictById } from "@/lib/data";
import { DotIcon, ImageIcon, TruckIcon, HeartIcon, Play } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useReactions } from "@/components/reactions/reactions-provider";
import { ThreeDotPost } from "../Card/ThreeDotPost";

export function GridCardPost({ post }: { post: Post }) {
  const reactions = useReactions();
  const listingId = String(post.postId);
  // No photo at all, or a stored photo missing from storage → empty area. The
  // DB is the only image source: no static stand-in, no broken <img>.
  const photo = post.images[0];
  const emptyPhoto = (
    <div className="absolute inset-0 flex items-center justify-center">
      <ImageIcon className="h-8 w-8 text-zinc-400" aria-hidden />
    </div>
  );

  const province = getProvinceById(post.proId);
  const district = getDistrictById(post.proId, post.disId);

  // `oldPrice` only exists alongside a real price, but a "Negotiable" listing
  // has none — guard it rather than letting the subtraction see null.
  const discountAmount =
    post.oldPrice && post.price !== null ? post.oldPrice - post.price : 0;

  const discountPercent = post.oldPrice
    ? Math.round((discountAmount / post.oldPrice) * 100)
    : 0;

  return (
    <Card className="relative select-none cursor-pointer  min-w-[260px] bg-card rounded-sm shadow-sm hover:shadow-md transition overflow-hidden pt-0 border-none">
      <Link
        // @ts-expect-error dynamic marketplace slug isn't in the routing pathnames
        href={`/${toSlug(post.title)}-adid-${post.postId}`}
        className="absolute inset-0 z-20"
      />
      <div className="relative h-52 w-full bg-zinc-100">
        {photo ? (
          <DbImage
            src={photo}
            alt={post.title}
            fill
            className="object-cover"
            priority={false}
            unoptimized
            fallback={emptyPhoto}
          />
        ) : (
          emptyPhoto
        )}
        {post.oldPrice && (
          <div className="absolute top-2 left-2 z-30 flex flex-col items-start gap-1">
            {/* % OFF */}
            <span className="bg-red-600 text-white text-[11px] font-bold px-2 py-0.5 rounded">
              -{discountPercent}%
            </span>
            {/* $ OFF */}
            <span className="bg-black/70 text-white text-[10px] px-2 py-0.5 rounded">
              ${discountAmount.toLocaleString()} OFF
            </span>
          </div>
        )}
        <div className="absolute top-2 right-2 z-30">
          <ThreeDotPost post={post} />
        </div>
        {/* Container positioned in the bottom right corner */}
        <div className="absolute bottom-2 right-2 flex flex-row-reverse items-center gap-1.5 pointer-events-none">
          {/* 1. Image Count Badge */}
          {post.images && post.images.length > 1 && (
            <span className="bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1 whitespace-nowrap">
              <ImageIcon size={14} />
              <span>{post.images.length}</span>
            </span>
          )}
          {/* 2. Free Delivery Badge */}
          {post.freeDelivery && (
            <span className="bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1 whitespace-nowrap">
              <TruckIcon size={14} />
              <span>Free Delivery</span>
            </span>
          )}
          {post.video && (
            <span className="bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1 whitespace-nowrap">
              <Play size={14} />
            </span>
          )}
        </div>
      </div>
      <CardHeader className="flex flex-1 flex-col items-stretch">
        <CardTitle className="text-base truncate block">{post.title}</CardTitle>
        {/* `min-w-0`: CardHeader is a grid, and a grid item's `min-width: auto`
            would let the location row size the track wider than the card — then
            the card's `overflow-hidden` clips the ellipsis and the heart. With
            it the track stays at the card's width and `truncate` does its job
            (ListCardPost already carries the same guard). */}
        <CardDescription className="flex min-w-0 flex-col text-xs text-muted-foreground">
          <div className="flex min-w-0 items-center">
            <span className="shrink-0">
              {new Intl.DateTimeFormat("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(post.createdat))}
            </span>
            <DotIcon className="scale-120" />
            <span className="truncate">
              {post.location ??
                [district?.name, province?.name].filter(Boolean).join(", ")}
            </span>
          </div>
          <div className="text-sm font-medium text-muted-foreground">
            {post.condition}
          </div>
        </CardDescription>
        {/* `mt-auto`: with the header stretched (flex-1), the price + heart row
            pins to the card's bottom — so cards in a row line up even when one
            has no condition line (captain, 2026-10-06). */}
        <div className="mt-auto flex items-center justify-between">
          {/* LEFT: price */}
          <div className="flex items-center gap-3">
            <span className="text-red-600 font-semibold text-lg">
              {post.price === null
                ? "Negotiable"
                : `$${post.price.toLocaleString()}`}
            </span>
            {post.oldPrice && (
              <span className="text-base text-zinc-400 italic line-through">
                ${post.oldPrice.toLocaleString()}
              </span>
            )}
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              reactions.toggleLike(listingId);
            }}
            disabled={reactions.isPending(listingId)}
            className="group/heart h-9 w-9 z-30  rounded-full bg-card hover:bg-gray-500 flex items-center justify-center cursor-pointer"
          >
            <HeartIcon
              className={`h-6 w-6 transition ${
                reactions.isLiked(listingId)
                  ? "fill-red-500 text-red-500 scale-110"
                  : "text-gray-400 group-hover/heart:text-white"
              }`}
            />
          </button>
        </div>
      </CardHeader>
    </Card>
  );
}
