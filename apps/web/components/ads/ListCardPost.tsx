"use client";

import DbImage from "@/components/common/DbImage";
import { Link } from "@/i18n/routing";
import { Post } from "@/lib/posts";
import { toSlug } from "@/lib/utils";
import {
  DotIcon,
  ImageIcon,
  TruckIcon,
  HeartIcon,
  EllipsisVertical,
  User,
  BookmarkIcon,
  Forward,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { useReactions } from "@/components/reactions/reactions-provider";

export function ListCardPost({ post }: { post: Post }) {
  // See GridCardPost — a "Negotiable" listing has no price to subtract from.
  const discountAmount =
    post.oldPrice && post.price !== null ? post.oldPrice - post.price : 0;

  const reactions = useReactions();
  const listingId = String(post.postId);
  // No photo at all, or a stored photo missing from storage → empty area (the
  // DB is the only image source: no static stand-in, no broken <img>).
  const photo = post.images[0];
  const emptyPhoto = (
    <div className="absolute inset-0 flex items-center justify-center">
      <ImageIcon className="h-8 w-8 text-zinc-400" aria-hidden />
    </div>
  );
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <>
      <div className="relative flex items-stretch bg-card rounded-sm hover:bg-muted/20 transition-colors border cursor-pointer select-none w-full mt-4">
        {/* Full-card link */}
        <Link
          // @ts-expect-error dynamic marketplace slug isn't in the routing pathnames
          href={`/${toSlug(post.title)}-adid-${post.postId}`}
          className="absolute inset-0 z-10"
        />

        {/* ── LEFT: Image ── */}
        <div className="relative shrink-0 w-[200px] h-[180px] ">
          {photo ? (
            <DbImage
              src={photo}
              alt={post.title}
              fill
              className="object-cover rounded-l-sm"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              loading="eager"
              unoptimized
              fallback={emptyPhoto}
            />
          ) : (
            emptyPhoto
          )}

          {/* Discount badge — single pill, top-left, orange like khmer24 */}
          {post.oldPrice && (
            <div className="absolute top-2 left-2 z-20 flex flex-col items-start gap-0.5">
              <span className="bg-amber-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full leading-tight">
                ${discountAmount.toLocaleString()}
              </span>
              <span className="bg-amber-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full leading-tight">
                Off
              </span>
            </div>
          )}

          {/* ⋮ menu — top-right of image */}
          <div className="absolute top-1.5 right-1.5 z-20">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="bg-card/80 hover:bg-background text-foreground rounded-full p-1.5 transition-colors shadow outline-none cursor-pointer"
                >
                  <EllipsisVertical size={14} />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                className="w-40 rounded-lg p-1 shadow-lg border-muted z-50"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenuItem asChild>
                  <Link
                    // @ts-expect-error "/profile" isn't declared in the i18n pathnames
                    href={"/profile"}
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer"
                  >
                    <User size={15} />
                    <span>View Profile</span>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem
                  asChild
                  onSelect={(e) => e.preventDefault()}
                  className="p-0"
                >
                  <Toggle
                    pressed={reactions.isSaved(listingId)}
                    onPressedChange={() => reactions.toggleSave(listingId)}
                    disabled={reactions.isPending(listingId)}
                    className="flex w-full items-center justify-start gap-3 px-3 py-2 text-sm transition-colors data-[state=on]:text-blue-500 hover:bg-muted outline-none border-none rounded-sm"
                  >
                    <BookmarkIcon
                      size={15}
                      className={
                        reactions.isSaved(listingId)
                          ? "fill-blue-500 text-blue-500"
                          : ""
                      }
                    />
                    <span>
                      {reactions.isSaved(listingId) ? "Unsave" : "Save"}
                    </span>
                  </Toggle>
                </DropdownMenuItem>

                <DropdownMenuItem
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer"
                  onSelect={(e) => {
                    e.preventDefault();
                    setShareOpen(true);
                  }}
                >
                  <Forward size={15} />
                  <span>Share</span>
                </DropdownMenuItem>

                <DropdownMenuItem className="flex items-center gap-3 px-3 py-2 cursor-pointer text-destructive focus:text-destructive">
                  <AlertTriangle size={15} />
                  <span>Report</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Image count — bottom-right */}
          {post.images.length > 1 && (
            <span className="absolute bottom-1.5 right-1.5 z-20 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
              <ImageIcon size={10} />
              <span>{post.images.length - 1}</span>
            </span>
          )}
        </div>

        {/* ── MIDDLE: Text content ── */}
        <div className="flex flex-col flex-1 min-w-0 px-4 py-3 justify-between">
          <div className="flex flex-col gap-1">
            {/* Title — allow 2 lines like khmer24 */}
            <p className="text-[15px] font-semibold leading-snug line-clamp-2 text-foreground">
              {post.title}
            </p>

            {/* Time · Location */}
            <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <span className="shrink-0">
                {new Date(post.createdat).toLocaleString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <DotIcon className="shrink-0 w-3 h-3" />
              <span className="truncate">
                {post.location ?? `${post.proId},${post.disId}`}
              </span>
            </div>

            {/* Condition · Year · etc */}
            <p className="text-xs text-muted-foreground">{post.condition}</p>

            {/* Free delivery — styled like khmer24: icon + text, muted blue */}
            {post.freeDelivery && (
              <span className="inline-flex items-center gap-1 text-xs text-sky-600 w-fit mt-0.5">
                <TruckIcon size={12} />
                <span>Free Delivery</span>
              </span>
            )}
          </div>

          {/* Price row */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-red-500 font-bold text-lg leading-none">
              {post.price === null
                ? "Negotiable"
                : `$${post.price.toLocaleString()}`}
            </span>
            {post.oldPrice && (
              <span className="text-sm text-zinc-400 line-through">
                ${post.oldPrice.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* ── RIGHT: Heart — bottom-aligned with the price row (captain,
            2026-10-06: centered, it floated mid-card on tall cards) ── */}
        <div className="flex items-end pb-3 pr-4 z-20">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              reactions.toggleLike(listingId);
            }}
            disabled={reactions.isPending(listingId)}
            className="group/heart h-11 w-11 shrink-0 flex items-center justify-center rounded-full hover:bg-gray-500 transition-colors outline-none cursor-pointer"
          >
            <HeartIcon
              className={`h-5 w-5 transition-transform ${
                reactions.isLiked(listingId)
                  ? "fill-red-500 text-red-500 scale-110"
                  : "text-muted-foreground group-hover/heart:text-white"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Share dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent
          className="sm:max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>Share link</DialogTitle>
            <DialogDescription>
              Anyone who has this link will be able to view this.
            </DialogDescription>
          </DialogHeader>
          <div className="grid flex-1 gap-2">
            <Input
              id="link"
              defaultValue={`${typeof window !== "undefined" ? window.location.origin : ""}/${toSlug(post.title)}-adid-${post.postId}`}
              readOnly
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
