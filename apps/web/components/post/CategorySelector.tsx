"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import DbImage from "@/components/common/DbImage";
import { getPostCategories } from "@/actions/post-categories";
import { Category, Subcategory } from "@/types/post-form";

// ─── Category Selector (Step 1) ───────────────────────────────────────────────
export function CategorySelector({
  onSelect,
}: {
  onSelect: (cat: Category, sub: Subcategory) => void;
}) {
  const t = useTranslations("PostAd");
  const locale = useLocale();
  const [hoveredCat, setHoveredCat] = useState<Category | null>(null);
  const [categories, setCategories] = useState<Category[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPostCategories(locale)
      .then((rows) => {
        if (!cancelled) setCategories(rows);
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCatEnter = (cat: Category) => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    setHoveredCat(cat);
  };

  const handlePanelLeave = () => {
    leaveTimer.current = setTimeout(() => setHoveredCat(null), 150);
  };

  const handlePanelEnter = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  };

  return (
    <div className="flex">
      <div className="w-64 flex-shrink-0 flex flex-col">
        <div className="px- py-3 flex-shrink-0">
          <span className="flex items-center gap-2 type-body  text-foreground">
            <span className="w-4 h-4 rounded-full bg-[#00a0e9] text-muted type-meta flex items-center justify-center">
              1
            </span>
            {t("chooseCategory")}
          </span>
        </div>
        <ul>
          {(categories ?? []).map((cat) => (
            <li
              key={cat.slug}
              onMouseEnter={() => handleCatEnter(cat)}
              onMouseLeave={handlePanelLeave}
              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-all border-l-2
                ${
                  hoveredCat?.slug === cat.slug
                    ? "bg-[#00a0e9]/10 border-l-[#00a0e9]"
                    : "border-l-transparent hover:bg-muted"
                }`}
            >
              <div className="w-8 h-8 relative flex-shrink-0">
                <DbImage
                  src={cat.cateIcon}
                  alt={cat.name}
                  width={32}
                  height={32}
                  className="object-contain"
                  fallback={
                    <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-muted type-button-sm text-muted-foreground">
                      {cat.name.charAt(0)}
                    </span>
                  }
                />
              </div>
              <span
                className={`type-body flex-1 ${hoveredCat?.slug === cat.slug ? "font-semibold text-[#00a0e9]" : "font-normal text-foreground"}`}
              >
                {cat.name}
              </span>
              <ChevronRight
                className={`w-4 h-4 flex-shrink-0 transition-colors ${hoveredCat?.slug === cat.slug ? "text-[#00a0e9]" : "text-muted-foreground"}`}
              />
            </li>
          ))}
        </ul>
      </div>

      {/* Vertical Separator */}
      <div className="w-px bg-secondary flex-shrink-0" />

      {/* Right: Subcategories - scroll only when > 15 items */}
      <div
        className="flex-1  flex flex-col"
        onMouseEnter={handlePanelEnter}
        onMouseLeave={handlePanelLeave}
      >
        <div className="px-6 py-3 flex-shrink-0">
          <span className="flex items-center gap-2 type-body text-muted-foreground">
            <span
              className={`w-4 h-4 rounded-full type-meta flex items-center justify-center ${hoveredCat ? "bg-[#00a0e9] text-white" : "bg-input text-foreground"}`}
            >
              2
            </span>
            {t("chooseSubcategory")}
          </span>
        </div>

        {hoveredCat ? (
          <ul
            className={
              hoveredCat.subcategories.length > 15 ? "overflow-y-auto" : ""
            }
            style={
              hoveredCat.subcategories.length > 15
                ? { maxHeight: "620px" }
                : undefined
            }
          >
            {hoveredCat.subcategories.map((sub) => (
              <li key={sub.slug}>
                <button
                  onClick={() => onSelect(hoveredCat, sub)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted transition-colors group text-left"
                >
                  <div className="w-8 h-8 relative flex-shrink-0">
                    <DbImage
                      src={sub.subcate}
                      alt={sub.name}
                      width={32}
                      height={32}
                      className="object-contain"
                      fallback={
                        <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-muted type-button-sm text-muted-foreground">
                          {sub.name.charAt(0)}
                        </span>
                      }
                    />
                  </div>
                  <span className="type-body text-foreground group-hover:text-[#00a0e9] group-hover:font-semibold flex-1 transition-colors">
                    {sub.name}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#00a0e9] flex-shrink-0 transition-colors" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground py-24">
            <ChevronRight className="w-8 h-8 text-gray-200 mb-2" />
            <p className="type-body">{t("hoverHint")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
