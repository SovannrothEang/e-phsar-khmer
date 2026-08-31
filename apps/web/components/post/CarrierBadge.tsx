import Image from "next/image";
import type { ReactNode } from "react";
import { carrierIconPath } from "@/utils/telecom";

export default function CarrierBadge({
  phone,
  fallback,
  className = "",
}: {
  phone?: string;
  fallback: ReactNode;
  className?: string;
}) {
  const src = phone ? carrierIconPath(phone) : null;
  if (!src) return <>{fallback}</>;
  return (
    <Image
      src={src}
      alt=""
      width={32}
      height={16}
      unoptimized
      className={`object-contain h-4 w-8 shrink-0 ${className}`}
    />
  );
}
