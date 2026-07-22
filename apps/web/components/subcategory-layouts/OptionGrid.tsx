"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { BrandOption, BodyTypeOption, ModelOption } from "@/types/category";
import { useState } from "react";
type Option = BrandOption | BodyTypeOption | ModelOption;

type Props = {
  options: Option[];
  baseHref: string;
  paramKey: "brand" | "body_type" | "model";
};

export default function OptionGrid({
  options,
  baseHref,
  paramKey,
}: Props) {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const LIMIT = paramKey === "model" ? 18 : 20;
  const [showAll, setShowAll] = useState(false);
  const visibleOptions = showAll
    ? options
    : options.slice(0, LIMIT);
  const router = useRouter();

  const handleClick = (e: React.MouseEvent, slug: string) => {
    // Prevent the Link from performing a full navigation
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());

    if (paramKey === "brand") {
      params.set("ad_field", slug);
      params.delete("ad_model");
    }

    if (paramKey === "body_type") {
      params.set("ad_type", slug);
    }

    if (paramKey === "model") {
      params.set("ad_model", slug);
    }

    const targetPath = pathname || baseHref;
    //  stay on the same page, only update query
    router.replace(`${targetPath}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="bg-card rounded p-4 mb-4 pl-6">
      <div className={
        paramKey === "model"
          ? "grid grid-cols-3 md:grid-cols-6 gap-2"
          : "grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-y-6 gap-x-4"
      }>
        {visibleOptions.map((opt) => {
          const imageSrc = "image" in opt ? opt.image : undefined;
          const isModel = paramKey === "model";
          const targetPath = pathname || baseHref;

          const isSelected =
            (paramKey === "model" && searchParams.get("ad_model") === opt.slug) ||
            (paramKey === "brand" && searchParams.get("ad_field") === opt.slug) ||
            (paramKey === "body_type" && searchParams.get("ad_type") === opt.slug);

          return (
            <a
              key={opt.slug}
              href={`${targetPath}?${paramKey === "model" ? "ad_model" : paramKey === "body_type" ? "ad_type" : "ad_field"}=${opt.slug}`}
              onClick={(e) => handleClick(e, opt.slug)}
              className={
                isModel
                  ? `border py-2 px-1 text-xs text-center transition-colors flex items-center justify-center min-h-[40px] ${isSelected ? "text-blue-500 bg-blue-50 border-blue-100 font-medium" : "hover:bg-muted bg-card"
                  }`
                  : `flex flex-col items-center text-center group ${isSelected ? "text-blue-500 font-medium" : ""}`
              }
            >

              {isModel ? (
                <span>{opt.name}</span>
              ) : (
                <>
                  <div className="w-14 h-14 flex items-center justify-center rounded-full bg-blue-50 group-hover:bg-blue-100">
                    {imageSrc ? (
                      <Image
                        src={imageSrc}
                        alt={opt.name}
                        width={56} 
                        height={56} 
                        className="object-contain" 
                      />
                    ) : (
                      <span className="text-xs">{opt.name}</span>
                    )}
                  </div>
                  <span className="text-xs mt-2 block">{opt.name}</span>
                </>
              )}
            </a>
          );
        })}
      </div>
      {options.length > LIMIT && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full border rounded py-2 text-sm bg-muted hover:bg-gray-200"
          >
            {showAll ? "Show Less" : "Show More"}
          </button>
        </div>
      )}
    </div>
  );
}