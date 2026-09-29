"use client";
import { useState, useRef } from "react";
import DbImage from "@/components/common/DbImage";
import { Button } from "../ui/button";
import { IconHeartPlus, IconShare3 } from "@tabler/icons-react";
import Lightbox, { FullscreenRef } from "yet-another-react-lightbox";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import Slideshow from "yet-another-react-lightbox/plugins/slideshow";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";
import { Post } from "@/lib/posts";
import ShareModal from "@/components/share/ShareModel";
import { toSlug } from "@/lib/utils";

const MAX_THUMBS = 7;

export default function PostImage({
  post,
}: {
  post: Pick<Post, "images" | "title" | "postId">;
}) {
  const [shareOpen, setShareOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [, setSelectedImage] = useState(0);

  const images = post?.images ?? [];
  const slides = images
    .filter((src) => typeof src === "string" && src.length > 0)
    .map((src) => ({ src }));

  const fullscreenRef = useRef<FullscreenRef>(null);
  const count = images.length;

  const handleImageClick = (idx: number) => {
    setSelectedImage(idx);
    setLightboxIndex(idx);
    setOpen(true);
  };

  // Overlay buttons — shown on main image
  const overlayButtons = (
    <div className="absolute top-3 right-3 flex gap-2 z-10">
      <Button className="bg-card text-sm font-medium px-2 py-1.5 h-10 w-26 rounded-sm flex items-center shadow-sm hover:bg-white/80 transition-colors cursor-pointer">
        <IconHeartPlus className="scale-145 text-foreground" stroke={2} />
        <p className="text-foreground pl-1 pt-0.5">0 Likes</p>
      </Button>
      <Button
        onClick={(e) => {
          e.stopPropagation();
          setShareOpen(true);
        }}
        className="bg-card px-2 py-1.5 h-10 w-15 rounded-sm flex items-center shadow-sm hover:bg-white/80 transition-colors cursor-pointer"
      >
        <IconShare3 className="scale-160 text-foreground" stroke={1.5} />
      </Button>
    </div>
  );

  const renderGrid = () => {
    if (count === 0) return null;

    if (count === 1)
      return (
        <div
          className="relative w-full aspect-[15/10] cursor-pointer overflow-hidden rounded-t-xs bg-muted"
          onClick={() => handleImageClick(0)}
        >
          <DbImage
            src={images[0]}
            alt="post-0"
            fill
            className="object-cover"
            unoptimized
            loading="eager"
          />
          {overlayButtons}
        </div>
      );

    if (count === 2)
      return (
        <div className="relative flex gap-0.5 aspect-[15/10] rounded-t-xs overflow-hidden">
          {/* overlay buttons always top right */}
          <div className="absolute top-3 right-3 flex gap-2 z-20">
            <Button className="bg-card text-sm font-medium px-2 py-1.5 h-10 w-26 rounded-sm flex items-center shadow-sm hover:bg-white/80 transition-colors cursor-pointer">
              <IconHeartPlus className="scale-145 text-foreground" stroke={2} />
              <p className="text-foreground pl-1 pt-0.5">0 Likes</p>
            </Button>

            <Button
              onClick={(e) => {
                e.stopPropagation();
                setShareOpen(true);
              }}
              className="bg-card px-2 py-1.5 h-10 w-15 rounded-sm flex items-center shadow-sm hover:bg-white/80 transition-colors cursor-pointer"
            >
              <IconShare3 className="scale-160 text-foreground" stroke={1.5} />
            </Button>
          </div>
          <div
            className="relative flex-1 cursor-pointer bg-muted"
            onClick={() => handleImageClick(0)}
          >
            <DbImage
              src={images[0]}
              alt="post-0"
              fill
              className="object-cover"
              unoptimized
              loading="eager"
            />
          </div>
          <div
            className="relative flex-1 cursor-pointer bg-muted"
            onClick={() => handleImageClick(1)}
          >
            <DbImage
              src={images[1]}
              alt="post-1"
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        </div>
      );

    if (count === 3)
      return (
        <div className="flex flex-col gap-1 aspect-[13/10] rounded-t-xs overflow-hidden">
          <div
            className="relative flex-[2] cursor-pointer bg-muted"
            onClick={() => handleImageClick(0)}
          >
            <DbImage
              src={images[0]}
              alt="post-0"
              fill
              className="object-cover"
              unoptimized
              loading="eager"
            />
            {overlayButtons}
          </div>
          <div className="flex flex-1 gap-1">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="relative flex-1 cursor-pointer bg-muted"
                onClick={() => handleImageClick(i)}
              >
                <DbImage
                  src={images[i]}
                  alt={`post-${i}`}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ))}
          </div>
        </div>
      );

    if (count === 4)
      return (
        <div className="flex flex-col gap-1 aspect-[13/10] rounded-t-xs overflow-hidden">
          <div
            className="relative flex-[3] cursor-pointer bg-muted"
            onClick={() => handleImageClick(0)}
          >
            <DbImage
              src={images[0]}
              alt="post-0"
              fill
              className="object-cover"
              unoptimized
              loading="eager"
            />
            {overlayButtons}
          </div>
          <div className="flex flex-1 gap-1">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="relative flex-1 cursor-pointer bg-muted"
                onClick={() => handleImageClick(i)}
              >
                <DbImage
                  src={images[i]}
                  alt={`post-${i}`}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ))}
          </div>
        </div>
      );

    if (count === 5)
      return (
        <div className="flex flex-col gap-1 aspect-[12/9] rounded-t-xs overflow-hidden">
          <div
            className="relative flex-[4] cursor-pointer bg-muted"
            onClick={() => handleImageClick(0)}
          >
            <DbImage
              src={images[0]}
              alt="post-0"
              fill
              className="object-cover"
              unoptimized
              loading="eager"
            />
            {overlayButtons}
          </div>
          <div className="flex flex-1 gap-1">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="relative flex-1 cursor-pointer bg-muted"
                onClick={() => handleImageClick(i)}
              >
                <DbImage
                  src={images[i]}
                  alt={`post-${i}`}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ))}
          </div>
        </div>
      );

    if (count === 6)
      return (
        <div className="flex flex-col gap-1 aspect-[11/8] rounded-t-xs overflow-hidden">
          <div
            className="relative flex-[5] cursor-pointer bg-muted"
            onClick={() => handleImageClick(0)}
          >
            <DbImage
              src={images[0]}
              alt="post-0"
              fill
              className="object-cover"
              unoptimized
              loading="eager"
            />
            {overlayButtons}
          </div>
          <div className="flex flex-1 gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="relative flex-1 cursor-pointer bg-muted"
                onClick={() => handleImageClick(i)}
              >
                <DbImage
                  src={images[i]}
                  alt={`post-${i}`}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ))}
          </div>
        </div>
      );

    if (count === 7)
      return (
        <div className="flex flex-col gap-1 aspect-[11/8] rounded-t-xs overflow-hidden">
          <div
            className="relative flex-[5] cursor-pointer bg-muted"
            onClick={() => handleImageClick(0)}
          >
            <DbImage
              src={images[0]}
              alt="post-0"
              fill
              className="object-cover"
              unoptimized
              loading="eager"
            />
            {overlayButtons}
          </div>
          <div className="flex flex-1 gap-1">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="relative flex-1 cursor-pointer bg-muted"
                onClick={() => handleImageClick(i)}
              >
                <DbImage
                  src={images[i]}
                  alt={`post-${i}`}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ))}
          </div>
        </div>
      );

    if (count === 8)
      return (
        <div className="flex flex-col gap-1 aspect-[11/8] rounded-t-xs overflow-hidden">
          <div
            className="relative flex-[6] cursor-pointer bg-muted"
            onClick={() => handleImageClick(0)}
          >
            <DbImage
              src={images[0]}
              alt="post-0"
              fill
              className="object-cover"
              unoptimized
              loading="eager"
            />
            {overlayButtons}
          </div>
          <div className="flex flex-1 gap-1">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div
                key={i}
                className="relative flex-1 cursor-pointer bg-muted"
                onClick={() => handleImageClick(i)}
              >
                <DbImage
                  src={images[i]}
                  alt={`post-${i}`}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ))}
          </div>
        </div>
      );

    // 9+ images — main + scrollable thumbnail strip
    const thumbImages = images.slice(1, MAX_THUMBS + 1);
    const remaining = Math.max(images.length - (MAX_THUMBS + 1), 0);

    return (
      <div className="flex flex-col gap-1 aspect-[11/8] rounded-t-xs overflow-hidden">
        <div
          className="relative flex-[6] cursor-pointer bg-muted"
          onClick={() => handleImageClick(0)}
        >
          <DbImage
            src={images[0]}
            alt="post-0"
            fill
            className="object-cover"
            unoptimized
            loading="eager"
          />
          {overlayButtons}
        </div>
        <div className="flex flex-1 gap-1">
          {thumbImages.map((img, idx) => {
            const isLast = idx === thumbImages.length - 1;
            const showOverlay = isLast && remaining > 0;

            return (
              <div
                key={idx}
                className="relative flex-1 cursor-pointer overflow-hidden bg-muted h-[60px] md:h-[100px]"
                onClick={() => handleImageClick(idx + 1)}
              >
                <DbImage
                  src={img}
                  alt={`thumb-${idx}`}
                  fill
                  sizes="18vw"
                  className="object-cover"
                  unoptimized
                />

                {showOverlay && (
                  <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                    <span className="text-white font-medium text-lg md:text-2xl">
                      +{remaining}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  return (
    <>
      {renderGrid()}
      <Lightbox
        open={open}
        close={() => setOpen(false)}
        index={lightboxIndex}
        slides={slides}
        plugins={[Thumbnails, Fullscreen, Slideshow, Zoom]}
        slideshow={{ autoplay: false, delay: 2000 }}
        zoom={{ maxZoomPixelRatio: 8, doubleClickMaxStops: 3 }}
        thumbnails={{
          position: "bottom",
          width: 56,
          height: 56,
          gap: 6,
          border: 2,
          borderRadius: 4,
          padding: 2,
          imageFit: "cover",
          vignette: false,
          showToggle: false,
        }}
        fullscreen={{ ref: fullscreenRef }}
        on={{
          view: ({ index: currentIndex }) => {
            setLightboxIndex(currentIndex);
            setSelectedImage(currentIndex);
          },
        }}
        animation={{ fade: 300, zoom: 300 }}
        render={{
          // "1 / 18" counter in top-left like Khmer24
          iconPrev: () => (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-6 h-6"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          ),
          iconNext: () => (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-6 h-6"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          ),
          // Counter badge top-left
          slideHeader: () => (
            <div className="absolute top-4 left-4 z-50 bg-black/50 text-white text-sm font-semibold px-3 py-1 rounded-full backdrop-blur-sm">
              {lightboxIndex + 1} / {slides.length}
            </div>
          ),
        }}
        styles={{
          container: { backgroundColor: "rgba(0,0,0,.92)" },
          thumbnailsContainer: { backgroundColor: "rgba(0,0,0,.92)" },
          thumbnail: {
            border: "2px solid transparent",
            opacity: 0.5,
            transition: "opacity 0.2s, transform 0.2s, border-color 0.2s",
          },
        }}
      />
      <style>{`
        /* Active thumbnail — bright border + full opacity + slightly bigger */
        .yarl__thumbnails_thumbnail[data-active="true"] {
          opacity: 1 !important;
          border-color: #ffffff !important;
          transform: scaleY(1.12);
          z-index: 1;
        }
        /* Inactive thumbnails — dimmed */
        .yarl__thumbnails_thumbnail:not([data-active="true"]) {
          opacity: 0.45 !important;
          border-color: transparent !important;
        }
        /* Hover on inactive */
        .yarl__thumbnails_thumbnail:not([data-active="true"]):hover {
          opacity: 0.8 !important;
        }
      `}</style>
      <ShareModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        url={`https://psakhmer.online/${toSlug(post.title)}-adid-${post.postId}`}
      />
    </>
  );
}
