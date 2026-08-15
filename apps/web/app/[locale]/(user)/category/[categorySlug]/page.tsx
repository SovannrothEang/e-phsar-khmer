'use client'

import { useParams } from "next/navigation";
import { Link } from "@/i18n/routing";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { categories } from "@/lib/categories";
import { AspectRatio } from "@/components/ui/aspect-ratio"
import { IconHome, IconChevronRightFilled } from '@tabler/icons-react';
import CommonCategoryLayout from "@/components/category-layouts/CommonCategoryLayout";
import ServicesCategoryLayout from "@/components/category-layouts/ServicesCategoryLayout";
import JobsCategoryLayout from "@/components/category-layouts/JobsCategoryLayout";
import CarsCategoryLayout from "@/components/category-layouts/CarsCategoryLayout";
import SubcategoryGrid from "@/components/category-layouts/SubcategoryGrid";
import HighLightAds from "@/components/ads/HighLightAds";
import NormalAd from "@/components/ads/NormalAd";
import { useSearchParams } from "next/navigation";
import OptionGrid from "@/components/subcategory-layouts/OptionGrid";
export default function CategoryPage() {
  const { categorySlug } = useParams<{ categorySlug: string }>();
  const searchParams = useSearchParams();
  const filterBarRef = useRef<HTMLDivElement>(null);
  const [, setIsSticky] = useState(false);

  const SUBCATEGORY_LAYOUT: Record<string, number> = {
    "cars-and-vehicles": 5,
    "phones-tablets": 5,
    "computers-accessories": 7,
    "electronics-appliances": 6,
    "house-land": 6,
    "jobs": 8,
    "services": 8,
    "fashion-beauty": 6,
    "furniture-decor": 5,
    "books-sports-hobbies": 7,
    "pets": 7,
    "foods": 5,
  }
   const COMMON_CATEGORIES = [
    "phones-tablets",
    "computers-accessories",
    "electronics-appliances",
    "house-land",
    "fashion-beauty",
    "furniture-decor",
    "books-sports-hobbies",
    "pets",
    "foods",
  ];
  
  // Categories with special layouts
   const CARS_CATEGORIES = ["cars-and-vehicles"];
   const SERVICES_CATEGORIES = ["services"];
   const JOBS_CATEGORIES = ["jobs"];

  const adField = searchParams.get("ad_field");

  let Layout;

  if (COMMON_CATEGORIES.includes(categorySlug)) {
    Layout = CommonCategoryLayout;
  } else if (SERVICES_CATEGORIES.includes(categorySlug)) {
    Layout = ServicesCategoryLayout;
  } else if (JOBS_CATEGORIES.includes(categorySlug)) {
    Layout = JobsCategoryLayout;
  } else if (CARS_CATEGORIES.includes(categorySlug)) {
    Layout = CarsCategoryLayout;
  } else {
    Layout = CommonCategoryLayout;
  }

  useEffect(() => {
    const handleScroll = () => {
      if (!filterBarRef.current) return;
      const offsetTop =
        filterBarRef.current.getBoundingClientRect().top + window.scrollY;
      setIsSticky(window.scrollY > offsetTop - 16);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const category = categories.find((cat) => cat.slug === categorySlug);

  if (!category) {
    return (
      <div className="container mx-auto px-4 py-8">Category not found</div>
    );
  }

  //  FIXED
  const cols = SUBCATEGORY_LAYOUT[category.slug] ?? 6;

  return (
    <main className="min-h-screen flex flex-col bg-muted">
      <div className="w-full flex justify-center py-6">
        <div className="w-full max-w-4xl">
          <Link href="/" target="_blank">
            <AspectRatio ratio={4} className="bg-muted rounded-none cursor-pointer">
              <Image
                src="/ads/landforsale.jpg"
                alt="Photo"
                fill
                priority
                className="object-cover rounded-none"
              />
            </AspectRatio>
          </Link>
        </div>
      </div>

      <div className="px-4 py-2">
        <div className="max-w-7xl mx-auto w-full pb-1">
          <nav className="flex items-center gap-2 text-base">
            <Link
              href="/"
              className="group flex items-center transition-colors duration-150 text-gray-500 dark:text-gray-400 hover:text-blue-300">
              <IconHome size={18} className="text-gray-500 dark:text-gray-400 group-hover:text-blue-300" />
              <span className="text-gray-500 dark:text-gray-400 group-hover:text-blue-300 pl-1.5">Home</span>
            </Link>
            <IconChevronRightFilled size={16} className="block mt-1 text-gray-500" />
            <h1 className="text-gray-500 dark:text-gray-400">{category.name} <span>in Cambodia</span></h1>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto w-full pb-2">
        <div className="mb-3">
          <Layout category={category} />
        </div>
        <SubcategoryGrid
          categorySlug={category.slug}
          subcategories={category.subcategories}
          cols={cols}
        />
        {category.slug === "Jobs" && !adField && category.subcategories[0]?.bodyTypes && (
          <div className="mt-2">
            <OptionGrid
              options={category.subcategories[0].bodyTypes}
              baseHref={`/category/${category.slug}`}
              paramKey="brand"
            />
          </div>
        )}
      </div>
      {/*  SMALL BANNER — SAME WIDTH AS CATEGORY CARD */}
      <div className="max-w-7xl mx-auto px-4 py-1 relative z-20">
        {/* <SmallAdBanner
          imagePath="/ads/carforsale.gif"
          altText="Car For Sale Banner"
          link="/"
        /> */}
      </div>
      <div className="px-6 py-8 md:px-12 md:py-1">
        <div className="max-w-6xl mx-auto w-full pb-1">
          <NormalAd />
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-2 relative z-20">
        {/* <SmallAdBanner
          imagePath="/ads/jobfinder.png"
          altText="Job Finder Banner"
          link="/"
        /> */}
      </div>
      <div className="px-6 py-8 md:px-12 md:py-1">
        <div className="max-w-7xl mx-auto w-full  pb-1">
          <NormalAd />
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-2 relative z-20">
        {/* <SmallAdBanner
          imagePath="/ads/findproduct.png"
          altText="Find Product Banner"
          link="/"
        /> */}
      </div>
      <div className="px-6 py-8 md:px-12 md:py-4">
        <div className="max-w-6xl mx-auto w-full px-8 pb-1">
          {/* <AdsPhoto /> */}
        </div>
      </div>
      <div className="px-6 py-8 md:px-12 md:py-4">
        <div className="max-w-6xl mx-auto w-full px-8 pb-1">
          <HighLightAds />
        </div>
      </div>
      <div className="px-6 py-8 md:px-12 md:py-4">
        <div className="max-w-6xl mx-auto w-full px-8 pb-1">
          {/* <AdsPhoto /> */}
        </div>
      </div>
      <div className="px-6 py-8 md:px-12 md:py-4">
        <div className="max-w-6xl mx-auto w-full px-8 pb-1">
          <HighLightAds />
        </div>
      </div>
    </main>
  );
}
