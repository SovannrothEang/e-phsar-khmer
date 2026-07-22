"use client";

import { useState } from "react";
import { Link } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import { Subcategory } from "@/types/category";
import Image from "next/image";

type Props = {
  categorySlug: string;
  subcategories: Subcategory[];
  cols: number;
};

export default function SubcategoryGrid({
  categorySlug,
  subcategories,
  cols,
}: Props) {
  const LIMIT = 24;
  const searchParams = useSearchParams();
  const [showAll, setShowAll] = useState(false);

  const visibleItems = showAll
    ? subcategories
    : subcategories.slice(0, LIMIT);

  return (
    <div className="rounded ">
      <div
        className="text-center leading-normal grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        }}
      >
        {visibleItems.map((sub) => (
          <Link
            key={sub.slug}
            href={{
              pathname: "/category/[categorySlug]/[subcategorySlug]",
              params: {
                categorySlug,
                subcategorySlug: sub.slug,
              },
              query: Object.fromEntries(searchParams.entries()),
            }}
            className="block h-full group bg-card rounded cursor-pointer active:opacity-50 p-3"
          >
            <div className="mx-auto bg-blue-50 rounded-full w-16 h-16 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
              <Image
                src={sub.subcate}
                alt={sub.name}
                width={128} 
                height={128}   
                unoptimized    
                className="object-contain"/>
            </div>
            <p className="mt-3 text-[14px] truncate w-full block">
              {sub.name}
            </p>
          </Link>
        ))}
      </div>
      {/* SHOW MORE OUTSIDE GRID */}
      {subcategories.length > LIMIT && (
        <div className="flex justify-center mt-2">
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full max-w-6xl border rounded py-2.5 text-sm text-muted-foreground bg-card hover:bg-gray-200"
          >
            {showAll ? "Show Less" : "Show More"}
          </button>
        </div>
      )}

    </div>
  );
}