"use client";

import Image from "next/image";
import { Link } from "@/i18n/routing";
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
import { FollowButton } from "@/components/profile/FollowButton";
import type { ListingContext } from "@/types/chat";

export default function ProfileSidebar({
  userId,
  user: userProp,
  listingId,
  listing,
  viewerId,
  initialFollowing = false,
}: {
  userId: string;
  user?: User;
  listingId?: string;
  /** Preview card for the ad, stashed for the chat page — see ContactSellerButton. */
  listing?: ListingContext | null;
  /** Signed-in viewer's id, if any — when it matches `userId` this is the
   *  viewer's own ad, so follow/message actions don't make sense. */
  viewerId?: string | null;
  /** Whether `viewerId` already follows the seller. */
  initialFollowing?: boolean;
}) {
  const user = userProp ?? getUserById(userId);
  if (!user) return null;
  const isOwnAd = !!viewerId && viewerId === userId;

  const phone0 = user.phone?.[0];
  const phone1 = user.phone?.[1];

  // Avatar + name + handle. It becomes a link to the seller's profile only
  // when there is a real handle to link to — the server joins it onto the
  // listing, and a seller whose owner is gone has none, so the card renders
  // the same identity without a link to nowhere.
  const identity = (
    <>
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
        <h2 className="font-medium text-lg leading-tight">{user?.name}</h2>
        {/* No handle, no row — the same rule the company, phone and email
            rows below already follow. */}
        {user?.username && (
          <p className="text-sm opacity-90">@{user.username}</p>
        )}
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
    </>
  );

  return (
    <div className="w-[400px] space-y-3">
      <div className="bg-card rounded-sm border border-border overflow-hidden shadow-sm">
        <div className="bg-[#00a0e9] p-4 hover:bg-[#00a0e9]/80  flex items-center justify-between">
          {user?.username ? (
            <Link
              href={{
                pathname: "/[username]",
                params: { username: user.username },
              }}
              className="flex items-center gap-3  cursor-pointer"
            >
              {identity}
            </Link>
          ) : (
            <div className="flex items-center gap-3">{identity}</div>
          )}

          {/* Nothing sits here on your own ad — the "Your Ad" badge that used
              to told the visitor a fact they could not act on, and it sat
              where every other listing offers a Follow. */}
          {!isOwnAd && (
            <FollowButton
              key={userId}
              userId={userId}
              initialFollowing={initialFollowing}
              viewerId={viewerId}
              variant="compact"
              className="bg-card text-foreground hover:bg-gray-100 h-7 mt-9 rounded-sm flex items-center cursor-pointer"
            />
          )}
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

          {isOwnAd ? (
            <div className="w-full bg-muted text-muted-foreground h-10 rounded-sm font-medium text-sm flex items-center justify-center text-center px-2">
              This is your own ad — buyers will see Message Seller here
            </div>
          ) : (
            <ContactSellerButton
              sellerId={userId}
              listingId={listingId}
              listing={listing}
              viewerId={viewerId}
              className="w-full bg-[#f68b1e] hover:bg-[#e57a10] text-white h-10 rounded-sm font-medium text-base cursor-pointer"
            />
          )}
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
