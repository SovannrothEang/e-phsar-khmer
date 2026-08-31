import { IconMapPin, IconPhoneCall } from "@tabler/icons-react";
import { Button } from "../ui/button";
import CarrierBadge from "./CarrierBadge";

export default function ContactUser({
  user,
  district,
  province,
}: {
  user: { phone?: string[] };
  district?: { name?: string };
  province?: { name?: string };
}) {
  const phone0 = user?.phone?.[0];
  const phone1 = user?.phone?.[1];

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
          {district?.name}, {province?.name}
        </h3>
        <div className="relative w-full max-w-3xl h-[120px] bg-muted rounded-sm overflow-hidden flex items-center justify-center mx-6 cursor-pointer">
          <div className="absolute inset-0 bg-[url('https://maps.googleapis.com/maps/api/staticmap?center=11.5564,104.9282&zoom=15&size=800x400&sensor=false')] bg-cover bg-center opacity-50 grayscale" />
          <Button className="relative z-10 bg-card cursor-pointer shadow-sm h-9 text-sm flex items-center rounded-sm hover:bg-white/30 transition-colors">
            <IconMapPin className="scale-120 text-muted-foreground" />
            <p className="text-muted-foreground text-xs px-2">
              Show on Google Map
            </p>
          </Button>
        </div>
      </div>
    </>
  );
}
