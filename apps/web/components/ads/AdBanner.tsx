// src/app/components/ads/AdBanner.tsx

import Image from "next/image";
import type { FC } from "react";

interface AdBannerProps {
  imagePath: string;
  altText: string;
  link?: string;
  width?: number;
  height?: number;
}

const AdBanner: FC<AdBannerProps> = ({
  imagePath,
  altText,
  link,
  width = 970,
  height = 250,
}) => {
  const adContent = (
    <div className="flex justify-center w-full">
      <div
        style={{ width: `${width}px`, height: `${height}px` }}
        className="relative overflow-hidden "
      >
        <Image
          src={imagePath || "/placeholder.svg"}
          alt={altText}
          fill
          className="object-cover"
          loading="lazy"
        />
      </div>
    </div>
  );

  if (link) {
    return (
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        {adContent}
      </a>
    );
  }

  return adContent;
};

export default AdBanner;
