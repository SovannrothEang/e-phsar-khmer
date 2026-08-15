"use client";

import Image from "next/image";
import { Link } from "@/i18n/routing";
import { Post } from "@/lib/posts";
import { toSlug } from "@/lib/utils";
import { getProvinceById, getDistrictById, getUserById } from "@/lib/data";
import {
  DotIcon,
  ImageIcon,
  TruckIcon,
  HeartIcon,
  Play,
} from "lucide-react";
import { useState } from "react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { ThreeDotPost } from "../Card/ThreeDotPost";

export function GridCardPost({ post }: { post: Post }) {
  const [isLiked, setIsLiked] = useState(false);

  const user = getUserById(post.userId);
  if (!user) return null;

  const province = getProvinceById(post.proId);
  const district = getDistrictById(post.proId, post.disId);

  const discountAmount = post.oldPrice ? post.oldPrice - post.price : 0;

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
        <Image
          src={post.images[0]}
          alt={post.title}
          fill
          className="object-cover"
          priority={false}
        />
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
      <CardHeader>
        <CardTitle className="text-base truncate block">{post.title}</CardTitle>
        <CardDescription className="flex flex-col text-xs text-muted-foreground">
          <div className="flex items-center">
            <span className="shrink-0">
              {new Intl.DateTimeFormat("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(post.createdat))}
            </span>
            <DotIcon className="scale-120" />
            <span className="truncate">
              {province?.name}, {district?.name}
            </span>
          </div>
          <div className="text-sm font-medium text-muted-foreground">
            {post.condition}
          </div>
        </CardDescription>
        <div className="flex items-center justify-between">
          {/* LEFT: price */}
          <div className="flex items-center gap-3">
            <span className="text-red-600 font-semibold text-lg">
              ${post.price.toLocaleString()}
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

              const willLike = !isLiked;
              toast.promise(
                new Promise((resolve) =>
                  setTimeout(
                    () => resolve(willLike ? "Liked" : "Unliked"),
                    1000,
                  ),
                ),
                {
                  loading: "Processing...",
                  success: (msg) => `${msg} successfully`,
                  error: "Error",
                  position: "top-right",
                },
              );
              setIsLiked(willLike);
            }}
            className="h-9 w-9 z-30  rounded-full bg-card hover:bg-black/10 flex items-center justify-center cursor-pointer"
          >
            <HeartIcon
              className={`h-6 w-6 transition ${isLiked
                  ? "fill-blue-500 text-blue-500 scale-110"
                  : "text-gray-400 group-hover:text-blue-500 group-hover:scale-110"
                }`}
            />
          </button>
        </div>
      </CardHeader>
    </Card>
  );
}
