// "use client"

// import Image from "next/image"
// import { useState } from "react"
// import { IconChevronRight } from "@tabler/icons-react"
// import { categories } from "@/lib/categories"
// import { Link } from "@/i18n/routing"
// import { IconHome } from '@tabler/icons-react';
// import clsx from "clsx"
// import { Separator } from "@/components/ui/separator"

// export default function SellPage() {
//   const [activeCategory, setActiveCategory] = useState(categories[0])

//   return (
//     <div className="pt-6 bg-muted">
//       <div className="max-w-4xl mx-auto w-full pb-60">
//         <nav className="flex items-center gap-2 text-base pb-6">
//           <Link
//             href="/"
//             className="group flex items-center transition-colors duration-150 text-gray-500 dark:text-gray-400 hover:text-blue-300"
//           >
//             <IconHome
//               size={18}
//               className="text-foreground dark:text-gray-400 group-hover:text-blue-300"
//             />
//             <span className="text-foreground dark:text-gray-400 group-hover:text-blue-300 pl-1.5">
//               Home
//             </span>
//           </Link>
//           <IconChevronRight size={16} className="block mt-1 text-gray-500" />
//           <h1 className="text-gray-500 dark:text-gray-400">Post</h1>
//         </nav>
//         <div className="w-full max-w-4xl rounded-sm border bg-card overflow-hidden">
//           {/* Header */}
//           <div className="border-b px-5 py-6">
//             <h2 className="text-3xl font-semibold text-foreground">
//               Post an Ad
//             </h2>
//             <div className="mt-4 flex items-center gap-3 text-sm">
//               <div className="flex items-center gap-2 text-sm text-foreground">
//                 <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/40">
//                   1
//                 </div>
//                 Choose a category
//               </div>
//               <IconChevronRight size={14} className="text-muted-foreground" />
//               <div className="flex items-center gap-2 text-sm text-foreground">
//                 <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/40">
//                   2
//                 </div>
//                 Fill Information
//               </div>
//             </div>
//             <Separator className="mt-2" />
//             <p className="text-base font-semibold pt-4">Category</p>
//             {/* Body */}
//             <div className="grid grid-cols-2">
//               {/* LEFT CATEGORY */}
//               <div className="border-r">
//                 <div className="py-4 px-6">
//                   <div className="flex items-center gap-2 text-sm text-foreground">
//                     <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/40">
//                       1
//                     </div>
//                     Choose a category
//                   </div>
//                   <div className="max-h-[860px] pt-4 pb-4">
//                     {categories.map((category) => {
//                       const active = activeCategory.slug === category.slug
//                       return (
//                         <button
//                           key={category.slug}
//                           onMouseEnter={() => setActiveCategory(category)}
//                           className={clsx(
//                             "flex w-full items-center justify-between px-5 py-3 transition-colors duration-100 cursor-pointer",
//                             active
//                               ? "bg-sky-50 dark:bg-sky-950/30"
//                               : "hover:bg-muted/60"
//                           )}
//                         >
//                           <div className="flex items-center gap-4">
//                             <Image
//                               src={category.cateIcon}
//                               alt={category.name}
//                               width={42}
//                               height={42}
//                               className="object-contain shrink-0"
//                               unoptimized
//                             />
//                             <span
//                               className={clsx(
//                                 "text-sm",
//                                 active
//                                   ? "font-semibold text-sky-600 dark:text-sky-400"
//                                   : "text-foreground"
//                               )}
//                             >
//                               {category.name}
//                             </span>
//                           </div>
//                           <IconChevronRight
//                             size={18}
//                             className={clsx(
//                               active
//                                 ? "text-sky-500"
//                                 : "text-muted-foreground"
//                             )}
//                           />
//                         </button>
//                       )
//                     })}
//                   </div>
//                 </div>
//               </div>
//               {/* RIGHT SUBCATEGORY */}
//               <div className="py-4">
//                 <div className="flex items-center gap-2 text-foreground text-sm px-4">
//                   <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/40">
//                     2
//                   </div>
//                   Select a subcategory
//                 </div>
//                 <div className="max-h-[800px] overflow-y-auto pt-4 pb-4">
//                   {activeCategory.subcategories?.map((sub) => (
//                     <button
//                       onClick={() => { }}
//                       key={sub.slug}
//                       className="flex w-full items-center justify-between px-5 py-3 hover:bg-muted/60 transition-colors duration-100 cursor-pointer"
//                     >
//                       <div className="flex items-center gap-4">
//                         <Image
//                           src={sub.subcate}
//                           alt={sub.name}
//                           width={38}
//                           height={38}
//                           className="object-contain shrink-0"
//                           unoptimized
//                         />
//                         <span className="text-sm text-foreground">
//                           {sub.name}
//                         </span>
//                       </div>
//                       <IconChevronRight
//                         size={18}
//                         className="text-muted-foreground"
//                       />
//                     </button>
//                   ))}
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   )
// }

"use client"

import { useState } from "react"
import {
  CategorySelecter,
  PostForm
} from "@/components/post/PostForm"
import type {
  Category,
  Subcategory
} from "@/types/category"
import { IconChevronRight, IconHome } from "@tabler/icons-react"
import { Link } from "@/i18n/routing"
import { Separator } from "@/components/ui/separator"

export default function SellPage() {
  const [step, setStep] = useState<1 | 2>(1)

  const [selectedCategory, setSelectedCategory] =
    useState<Category | null>(null)

  const [selectedSub, setSelectedSub] =
    useState<Subcategory | null>(null)

  const handleSelect = (
    cat: Category,
    sub: Subcategory
  ) => {
    setSelectedCategory(cat)
    setSelectedSub(sub)
    setStep(2)
  }

  const handleBack = () => {
    setStep(1)
    setSelectedCategory(null)
    setSelectedSub(null)
  }

  return (
    <>
      <div className="pt-6 bg-muted">
        <div className="max-w-4xl mx-auto w-full pb-60">
          <nav className="flex items-center gap-2 text-base pb-6">
            <Link
              href="/"
              className="group flex items-center transition-colors duration-150 text-gray-500 dark:text-gray-400 hover:text-blue-300"
            >
              <IconHome
                size={18}
                className="text-foreground dark:text-gray-400 group-hover:text-blue-300"
              />
              <span className="text-foreground dark:text-gray-400 group-hover:text-blue-300 pl-1.5">
                Home
              </span>
            </Link>
            <IconChevronRight size={16} className="block mt-1 text-gray-500" />
            <h1 className="text-gray-500 dark:text-gray-400">Post</h1>
          </nav>
          <div className="w-full max-w-4xl rounded-sm border bg-card overflow-hidden">
            {/* Header */}
            <div className=" px-5 py-6">
              <h2 className="text-3xl font-semibold text-foreground">
                Post an Ad
              </h2>
              <div className="mt-4 flex items-center gap-3 text-sm">
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/40 text-xs">
                    1
                  </div>
                  Choose a category
                </div>
                <IconChevronRight size={14} className="text-muted-foreground" />
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/40 text-xs">
                    2
                  </div>
                  Fill Information
                </div>
              </div>
              <Separator className="mt-2" />
            </div>
            {step === 1 ? (
              <CategorySelecter
                onSelectAction={handleSelect}
              />
            ) : (
              selectedCategory &&
              selectedSub && (
                <PostForm
                  category={selectedCategory}
                  subcategory={selectedSub}
                  onBackAction={handleBack}
                />
              )
            )}
          </div>
        </div>
      </div>
    </>
  )
}
