"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Settings,
  Camera,
  IdCard,
  Forward,
  Heart,
  Bookmark,
  FolderOpen,
  BriefcaseBusiness,
  Info,
  BadgeDollarSign,
  Loader2,
} from "lucide-react";
import { User } from "@/lib/user";
import { Button } from "../ui/button";
import { Link, useRouter } from "@/i18n/routing";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/sonner";
import { uploadUserPhoto } from "@/actions/user-photo";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/plugins/thumbnails.css";
import { useRef } from "react";
import "yet-another-react-lightbox/styles.css";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Lightbox, { FullscreenRef } from "yet-another-react-lightbox";

interface ProfileHeaderProps {
  user: User;
  isOwnProfile: boolean;
}

export function MyProfileHeader({ user, isOwnProfile }: ProfileHeaderProps) {
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState<string | null>(null);

  const [index, setIndex] = useState(0);
  const [avatarOverride, setAvatarOverride] = useState<string | null>(null);
  const [coverOverride, setCoverOverride] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const fullscreenRef = useRef<FullscreenRef>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // The profile page currently renders from a mock currentUser; these overrides
  // reflect an upload immediately. router.refresh() keeps server data in sync
  // once the page consumes real /users/me data (tracked follow-up).
  const displayedAvatar = avatarOverride ?? user.avatar;
  const displayedCover = coverOverride ?? user.cover;
  const handleImageClick = (src: string) => {
    setImage(src);
    setOpen(true);
  };

  async function handlePhotoUpload(kind: "avatar" | "cover", file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be 5MB or smaller");
      return;
    }
    const setUploading =
      kind === "avatar" ? setUploadingAvatar : setUploadingCover;
    setUploading(true);
    try {
      const res = await uploadUserPhoto(kind, file);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      const url =
        kind === "avatar" ? res.data.profilePhotoUrl : res.data.coverPhotoUrl;
      if (url) {
        if (kind === "avatar") setAvatarOverride(url);
        else setCoverOverride(url);
      }
      toast.success(`${kind === "avatar" ? "Avatar" : "Cover"} updated`);
      router.refresh();
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="bg-card">
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        ref={avatarInputRef}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handlePhotoUpload("avatar", file);
          e.target.value = "";
        }}
      />
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        ref={coverInputRef}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handlePhotoUpload("cover", file);
          e.target.value = "";
        }}
      />
      <div className="w-full mx-auto max-w-7xl">
        <div className=" bg-card">
          <div
            onClick={() => handleImageClick(displayedCover)}
            className="relative h-[500px] md:h-[450px] lg:h-[400px] xl:h-[350px] w-full bg-gradient from-blue-200 to-blue-100 cursor-pointer"
          >
            {displayedCover && (
              <Image
                src={displayedCover}
                alt="Cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                fill
                unoptimized
                className="object-cover rounded-b-lg"
              />
            )}
            {isOwnProfile && (
              <Button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  coverInputRef.current?.click();
                }}
                disabled={uploadingCover}
                className="absolute bottom-4 h-10 right-4 flex items-center gap-2 bg-card px-4 py-2 rounded-sm shadow-md hover:shadow-lg transition cursor-pointer"
              >
                {uploadingCover ? (
                  <Loader2 className="scale-135 text-foreground animate-spin" />
                ) : (
                  <Camera className="scale-135 text-foreground" />
                )}
                <span className="text-sm font-bold text-foreground">
                  {uploadingCover ? "Uploading..." : "Upload Cover"}
                </span>
              </Button>
            )}
          </div>
          <div className="px-6 pb-6">
            <div className="flex flex-col md:flex-row md:items-end gap-4 mt-1">
              <div
                onClick={() => handleImageClick(displayedAvatar)}
                className="relative cursor-pointer"
              >
                <Image
                  src={displayedAvatar}
                  alt={user.name}
                  width={120}
                  height={120}
                  unoptimized
                  className="w-32 h-32 rounded-full border-4 border-card shadow-lg -mt-24"
                />
                {isOwnProfile && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      avatarInputRef.current?.click();
                    }}
                    disabled={uploadingAvatar}
                    className="absolute bottom-1 right-2 bg-card text-foreground rounded-full h-8 w-8 flex items-center justify-center p-1 cursor-pointer"
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="scale-110 animate-spin" />
                    ) : (
                      <Camera className="scale-110" />
                    )}
                  </Button>
                )}
              </div>

              <div className="flex-1">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="">
                    <h1 className="text-xl font-medium ">{user.name}</h1>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-muted-foreground">@{user.username}</p>
                      <Button
                        variant="outline"
                        onClick={() => router.replace("/membership")}
                        className="h-6 rounded-full border-orange-500 text-orange-500 bg-transparent px-3 text-[10px] font-medium hover:bg-orange-500 hover:text-white transition-colors cursor-pointer"
                      >
                        Upgrade Account
                      </Button>
                    </div>
                    <div className="flex gap-4 mb-2">
                      <p className="text-sm">{user.following} Following</p>
                      <p className="text-sm">{user.follower} Followers</p>
                    </div>
                    <p className="text-sm text-muted-foreground ">
                      Joined {user.joinDate}
                    </p>
                  </div>

                  <div className="flex gap-2 flex-wrap md:flex-nowrap">
                    <Button className="flex items-center gap-2 px-4 h-11 bg-muted-foreground/60 hover:bg-gray-200 rounded-sm font-medium transition">
                      <IdCard className="scale-125" />
                      Resume (CV)
                    </Button>
                    <Button className="flex items-center gap-2 px-4 h-11 bg-muted-foreground/60 hover:bg-gray-200 rounded-sm font-medium transition">
                      <Forward className="scale-125" />
                    </Button>
                    <Button
                      onClick={() => router.replace("/settings")}
                      className="p-2 h-11 w-12 bg-muted-foreground/60 hover:bg-gray-200 rounded-sm transition cursor-pointer"
                    >
                      <Settings className="scale-125" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <hr className="border-border w-full" />
          <div className="flex items-center px-4 gap-4 h-14">
            <Tabs defaultValue="manage-ads">
              <TabsList variant="line">
                <TabsTrigger value="manage-ads">
                  <Link
                    href="/me"
                    className="flex items-center gap-2 px-4 h-11  font-medium transition"
                  >
                    <FolderOpen />
                    Manage Ads
                  </Link>
                </TabsTrigger>
                <TabsTrigger value="about">
                  <Link
                    href="/me/about"
                    className="flex items-center gap-2 px-4 h-11  font-medium transition"
                  >
                    <Info />
                    About
                  </Link>
                </TabsTrigger>
                <TabsTrigger value="jobs">
                  <Link
                    href="/me/job-applications"
                    className="flex items-center gap-2 px-4 h-11  font-medium transition"
                  >
                    <BriefcaseBusiness />
                    Jobs
                  </Link>
                </TabsTrigger>
                <TabsTrigger value="saved">
                  <Link
                    href="/me/saved"
                    className="flex items-center gap-2 px-4 h-11  font-medium transition"
                  >
                    <Bookmark />
                    Saved
                  </Link>
                </TabsTrigger>
                <TabsTrigger value="liked">
                  <Link
                    href="/me/likes"
                    className="flex items-center gap-2 px-4 h-11  font-medium transition"
                  >
                    <Heart />
                    Likes
                  </Link>
                </TabsTrigger>
                <TabsTrigger value="subscriptions">
                  <Link
                    href="/me/subscriptions"
                    className="flex items-center gap-2 px-4 h-11  font-medium transition"
                  >
                    <BadgeDollarSign />
                    Subscriptions
                  </Link>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Lightbox
              open={open}
              close={() => setOpen(false)}
              index={index}
              slides={image ? [{ src: image }] : []}
              plugins={[Zoom, Fullscreen]} // Cleaned up
              render={{
                buttonPrev: () => null,
                buttonNext: () => null,
              }}
              zoom={{
                maxZoomPixelRatio: 8, // High zoom limit
                doubleClickMaxStops: 3, // Three stages of zoom on double-click
              }}
              fullscreen={{ ref: fullscreenRef }}
              on={{
                view: ({ index: currentIndex }) => setIndex(currentIndex),
                // 4. Corrected Click Handler
                click: () => {
                  // Enter fullscreen when the main image is clicked
                  fullscreenRef.current?.enter();
                },
              }}
              animation={{ fade: 300 }}
              styles={{
                container: { backgroundColor: "rgba(0, 0, 0, .9)" },
                thumbnailsContainer: { backgroundColor: "rgba(0, 0, 0, 0.5)" },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
