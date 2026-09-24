import { IconMapPin, IconPhoneCall } from "@tabler/icons-react";
import CarrierBadge from "./CarrierBadge";
import ListingLocationMap from "./ListingLocationMap";

export default function ContactUser({
  user,
  district,
  province,
  coords,
  locationLine,
}: {
  user: { phone?: string[] };
  district?: { name?: string };
  province?: { name?: string };
  /** The listing's saved map pin, when it was posted with one. */
  coords?: { lat: number; lng: number } | null;
  /** The listing's location as text (real listings carry it on the row). */
  locationLine?: string;
}) {
  const phone0 = user?.phone?.[0];
  const phone1 = user?.phone?.[1];
  const heading =
    locationLine ??
    [district?.name, province?.name].filter(Boolean).join(", ");

  return (
    <>
      <div className="mt-4">
        <h1 className="text-sm text-foreground mb-3">
          Please click on phone number to show and don&apos;t forget to mention
          that you found this ad on PsaKhmer.com.
        </h1>
        <h3 className="text-base font-medium flex items-center mb-2">
          <IconPhoneCall className="scale-80 mr-2 text-muted-foreground" />
          Contact Phones
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
              {phone1}
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
              {phone0}
            </span>
          ) : null}
        </div>
        <button className="text-[#00a0e9] text-[13px] italic hover:underline mt-2 ml-[26px] inline-block">
          Show Phone Number
        </button>
      </div>
      <div className="mt-4">
        <h3 className="text-base font-medium flex items-center mb-2">
          <IconMapPin className="scale-80 mr-2 text-muted-foreground" />
          {heading}
        </h3>
        <ListingLocationMap coords={coords ?? null} locationLine={heading} />
      </div>
    </>
  );
}
