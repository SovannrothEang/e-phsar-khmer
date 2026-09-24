"use client";

import { UserPlus, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Link } from "@/i18n/routing";
import { useState } from "react";
import { toast } from "sonner";
import { getUserById } from "@/lib/data";
import { type User } from "@/lib/user";
import {
  IconBuilding,
  IconPhoneCall,
  IconWorld,
  IconMail,
} from "@tabler/icons-react";
import CarrierBadge from "./CarrierBadge";
import { ContactSellerButton } from "@/components/chat/contact-seller-button";

export default function ProfileSidebar({
  userId,
  user: userProp,
  listingId,
}: {
  userId: string;
  user?: User;
  listingId?: string;
}) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const user = userProp ?? getUserById(userId);
  if (!user) return null;

  const phone0 = user.phone?.[0];
  const phone1 = user.phone?.[1];

  const handleFollow = () => {
    setLoading(true);

    const action = new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 800);
    });

    toast.promise(action, {
      loading: isFollowing ? "Unfollowing..." : "Following...",
      position: "top-right",
      success: () => {
        setIsFollowing((prev) => !prev);
        setLoading(false);

        return isFollowing ? "Unfollow successful" : "Follow successful";
      },
      error: () => {
        setLoading(false);
        return "Something went wrong";
      },
    });
  };

  return (
    <div className="w-[400px] space-y-3">
      <div className="bg-card rounded-sm border border-border overflow-hidden shadow-sm">
        <div className="bg-[#00a0e9] p-4 hover:bg-[#00a0e9]/80  flex items-center justify-between">
          <Link
            href={{
              pathname: "/[username]",
              params: { username: user?.username },
            }}
            className="flex items-center gap-3  cursor-pointer"
          >
            <div className="relative h-16 w-16 rounded-full border-4 border-card overflow-hidden">
              <Image
                src={user?.avatar}
                alt="avatar"
                width={100}
                height={100}
                className="object-cover bg-card"
                priority
                unoptimized
              />
            </div>
            <div className="text-card">
              <h2 className="font-medium text-lg leading-tight">
                {user?.name}
              </h2>
              <p className="text-sm opacity-90">@{user?.username}</p>
              <p className="text-xs">
                Members Since{" "}
                {user?.joinDate &&
                  new Date(user.joinDate).toLocaleDateString("en-US", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
              </p>
            </div>
          </Link>

          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleFollow();
            }}
            disabled={loading}
            className="bg-card text-foreground hover:bg-gray-100 h-7 mt-9 rounded-sm flex items-center cursor-pointer"
          >
            {isFollowing ? (
              <UserCheck className="!w-4 !h-4" />
            ) : (
              <UserPlus className="!w-4 !h-4" />
            )}

            <span className="text-xs">
              {isFollowing ? "Following" : "Follow"}
            </span>
          </Button>
        </div>

        {/* Contact Info Section */}
        <div className="p-3 space-y-3 text-sm">
          {/* The jobs form's Company leads this list. Every row follows the
              same design — a muted icon square plus its text — and the first
              row is normally the username, so a job listing swaps in the
              employer instead (captain, 2026-09-24: "for job, this has company
              row as the first row, instead of username (or name)"). Plain
              text: the company is never a link. */}
          {user?.company ? (
            <>
              <div className="flex gap-2">
                <div className="bg-muted h-8 w-8 rounded-sm flex items-center justify-center flex-shrink-0">
                  <IconBuilding
                    size={18}
                    className="text-muted-foreground"
                    stroke={1.5}
                  />
                </div>
                <p className="truncate leading-tight mt-1">{user.company}</p>
              </div>
              <div className="border-t border-muted-foreground/30" />
            </>
          ) : null}
          <div className="flex gap-2">
            <div className="bg-muted h-8 w-8 rounded-sm flex items-center justify-center">
              <IconWorld
                size={18}
                className="text-muted-foreground"
                stroke={1.5}
              />
            </div>
            <Link
              href={{
                pathname: "/[username]",
                params: { username: user?.username },
              }}
              className="text-[#00a0e9] hover:underline truncate leading-tight mt-1"
            >
              {user?.userlink || "username"}
            </Link>
          </div>
          <div className="border-t border-muted-foreground/30" />
          {/* Phone Number — the row and its divider render only when the
              seller actually gave a number; a row whose only content is the
              "Show Phone Number" button is worse than no row. */}
          {phone0 || phone1 ? (
            <>
              <div className="flex gap-2">
                <div className="bg-muted h-8 w-8 rounded-sm flex items-center justify-center flex-shrink-0">
                  <IconPhoneCall size={18} className="text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <div className="flex gap-3">
                    {phone0 ? (
                      <span className="flex items-center gap-1 font-bold">
                        <CarrierBadge
                          phone={phone0}
                          fallback={
                            <span className="bg-orange-400 w-4 h-4 rounded-sm flex items-center justify-center text-[10px] text-white">
                              C
                            </span>
                          }
                        />
                        {phone0}
                      </span>
                    ) : null}
                    {phone1 ? (
                      <span className="flex items-center gap-1 font-bold">
                        <CarrierBadge
                          phone={phone1}
                          fallback={
                            <span className="bg-green-600 w-4 h-4 rounded-sm flex items-center justify-center text-[10px] text-white">
                              S
                            </span>
                          }
                        />
                        {phone1}
                      </span>
                    ) : null}
                  </div>
                  <button className="text-[#00a0e9] text-xs italic hover:underline cursor-pointer">
                    Show Phone Number
                  </button>
                </div>
              </div>
              <div className="border-t border-muted-foreground/30" />
            </>
          ) : null}
          {/* Email — same rule: no address, no row (captain, 2026-09-24:
              "if it has no data don't let it appear … I don't enter any then
              it still show email row"). */}
          {user?.email ? (
            <>
              <div className="flex gap-3">
                <div className="bg-muted h-8 w-8 rounded-sm flex items-center justify-center flex-shrink-0">
                  <IconMail size={18} className="text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">{user.email}</p>
                  <button className="text-[#00a0e9] text-xs italic hover:underline cursor-pointer">
                    Show Email Address
                  </button>
                </div>
              </div>
              <div className="border-t border-muted-foreground/30" />
            </>
          ) : null}

          <ContactSellerButton
            sellerId={userId}
            listingId={listingId}
            className="w-full bg-[#f68b1e] hover:bg-[#e57a10] text-white h-10 rounded-sm font-medium text-base cursor-pointer"
          />
        </div>
      </div>
      <div className="bg-card rounded-sm border border-border p-4 shadow-sm">
        <div className="flex items-center justify-center gap-2 mb-4 pt-3">
          <Image
            src="/user-img/warning.png"
            alt="warning icon"
            width={32}
            height={32}
            unoptimized
          />
          <h2 className="text-[#e3281b] text-lg font-bold">
            Safety Tips for Buyers
          </h2>
        </div>
        <ol className="space-y-3 text-sm text-foreground list-decimal pl-6 pb-3">
          <li className="px-2">Do not send money before receiving the goods</li>
          <li className="px-2">Check the item before you buy</li>
          <li className="px-2">Payment after receiving the goods</li>
          <li className="px-2">Meet the seller at a safe location</li>
        </ol>
      </div>
    </div>
  );
}
