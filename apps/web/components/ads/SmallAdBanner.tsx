// // src/app/components/ads/SmallAdBanner.tsx

// import Image from "next/image";
// import type { FC } from "react";

// interface SmallAdBannerProps {
//   imagePath: string;
//   altText: string;
//   link?: string;
//   width?: number;
//   height?: number;
// }

// const SmallAdBanner: FC<SmallAdBannerProps> = ({
//   imagePath,
//   altText,
//   link,
//  width = 1200,
//  height = 180,

// }) => {
//   const adContent = (
//     <div className="flex justify-center w-full">
//       <div className="relative w-full max-w-7xl">
//         <Image
//           src={imagePath || "/placeholder.svg"}
//           alt={altText}
//           width={width}
//           height={height}
//           className="w-full h-auto object-contain "
//           priority
//         />
//       </div>
//     </div>
//   );

//   if (link) {
//     return (
//       <a
//         href={link}
//         target="_blank"
//         rel="noopener noreferrer"
//         className="block"
//       >
//         {adContent}
//       </a>
//     );
//   }

//   return adContent;
// };

// export default SmallAdBanner;
// src/app/components/ads/SmallAdBanner.tsx

import Image from "next/image";
import type { FC } from "react";

interface SmallAdBannerProps {
  imagePath: string;
  altText: string;
  link?: string;
  width?: number;
  height?: number;
}

const SmallAdBanner: FC<SmallAdBannerProps> = ({
  imagePath,
  altText,
  link,
  width = 1200,
  height = 180,
}) => {
  const adContent = (
    <div className="flex justify-center w-full">
      <div className="relative w-full max-w-7xl overflow-hidden rounded-md">
        <Image
          src={imagePath || "/placeholder.svg"}
          alt={altText}
          width={width}
          height={height}
          className="w-full h-auto object-contain"
          // FIX: Remove priority, let it lazy load
          loading="lazy"
          // FIX: GIFs should usually be unoptimized to preserve animation and save CPU
          unoptimized={imagePath.endsWith(".gif")}
        />
      </div>
    </div>
  );

  if (link) {
    return (
      <a href={link} className="block transition-opacity hover:opacity-90">
        {adContent}
      </a>
    );
  }

  return adContent;
};

export default SmallAdBanner;
