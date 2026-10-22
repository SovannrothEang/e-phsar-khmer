"use client";

import { useTranslations } from "next-intl";
import { IconMapPin, IconPhoneCall } from "@tabler/icons-react";
import CarrierBadge from "./CarrierBadge";
import ListingLocationMap from "./ListingLocationMap";
import { trackEvent } from "@/lib/insights/queue";

export default function ContactUser({
  user,
  district,
  province,
  coords,
  locationLine,
  addressLine,
  listingId,
}: {
  user: { phone?: string[] };
  district?: { name?: string };
  province?: { name?: string };
  /** The listing's saved map pin, when it was posted with one. */
  coords?: { lat: number; lng: number } | null;
  /** The listing's location as text (real listings carry it on the row). */
  locationLine?: string;
  /** The seller's street address — printed under the location. */
  addressLine?: string;
  /** Present on a real listing; drives call/show-contact tracking. */
  listingId?: string;
}) {
  const t = useTranslations("Post");
  const phone0 = user?.phone?.[0];
  const phone1 = user?.phone?.[1];
  const heading =
    locationLine ?? [district?.name, province?.name].filter(Boolean).join(", ");
  // The map link searches the most precise text we have, address included.
  const mapQuery = [heading, addressLine].filter(Boolean).join(", ");

  return (
    <>
      <div className="mt-4">
        <h1 className="text-sm text-foreground mb-3">{t("contactHint")}</h1>
        <h3 className="text-base font-medium flex items-center mb-2">
          <IconPhoneCall className="scale-80 mr-2 text-muted-foreground" />
          {t("contactPhones")}
        </h3>
        <div className="flex flex-wrap items-center gap-5 text-sm font-bold ml-[26px]">
          {phone1 ? (
            <span className="flex items-center text-[#118c28]">
              <CarrierBadge
                phone={phone1}
                className="mr-1"
                fallback={
                  <span className="bg-[#118c28] text-white text-[10px] w-[15px] h-[15px] flex items-center justify-center rounded-sm mr-2">
                    S
                  </span>
                }
              />
              <a
                href={`tel:${phone1}`}
                onClick={() => {
                  if (listingId) trackEvent(listingId, "call");
                }}
                className="hover:underline"
              >
                {phone1}
              </a>
            </span>
          ) : null}
          {phone0 ? (
            <span className="flex items-center text-[#f68b1e]">
              <CarrierBadge
                phone={phone0}
                className="mr-1"
                fallback={
                  <span className="bg-[#f68b1e] text-white text-[10px] w-[15px] h-[15px] flex items-center justify-center rounded-sm mr-2">
                    C
                  </span>
                }
              />
              <a
                href={`tel:${phone0}`}
                onClick={() => {
                  if (listingId) trackEvent(listingId, "call");
                }}
                className="hover:underline"
              >
                {phone0}
              </a>
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => {
            if (listingId) trackEvent(listingId, "show_contact");
          }}
          className="text-[#00a0e9] text-[13px] italic hover:underline mt-2 ml-[26px] inline-block"
        >
          {t("showPhone")}
        </button>
      </div>
      <div className="mt-4">
        <h3 className="text-base font-medium flex items-center mb-2">
          <IconMapPin className="scale-80 mr-2 text-muted-foreground" />
          {heading}
        </h3>
        {/* The street address sits on its own line under the location, and
            only when the seller gave one — no empty line otherwise. */}
        {addressLine ? (
          <p className="text-sm text-muted-foreground mb-2">{addressLine}</p>
        ) : null}
        <ListingLocationMap coords={coords ?? null} locationLine={mapQuery} />
      </div>
    </>
  );
}
