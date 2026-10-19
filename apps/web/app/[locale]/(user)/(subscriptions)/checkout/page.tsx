// 'use client'

// import { useSearchParams } from "next/navigation"
// import { useState } from "react"
// import { Link } from "@/i18n/routing"
// import { House, ChevronRight, CirclePlus } from 'lucide-react';

// export default function CheckoutPage() {
//   const params = useSearchParams()

//   const category = params.get("category") || "Services"
//   const term = params.get("term") === "1year" ? "1 Year" : "6 Months"
//   const price = Number(params.get("price") || 0)

//   const [method, setMethod] = useState("khqr")

//   const vat = price * 0.1
//   const total = price + vat

//   return (

//     <div className="min-h-screen bg-muted pb-2">
//       <div className="max-w-4xl mx-auto py-8 px-4">
//         <nav className="flex items-center space-x-1 text-sm ">
//           <Link
//             href="/"
//             className="group flex items-center transition-colors duration-150 text-foreground  group-hover:text-gray-300">
//             <House size={16} className="text-foreground  group-hover:text-gray-300" />
//             <span className="text-foreground  group-hover:text-gray-300 pl-1.5">Home</span>
//           </Link>
//           <ChevronRight size={16} className="block text-gray-500" />
//           <Link
//             href="/"
//             className="group flex items-center transition-colors duration-150 text-gray-500 dark:text-gray-400 hover:text-blue-300">
//             <span className="text-foreground  group-hover:text-gray-300 pl-1.5">Profile</span>
//           </Link>
//           <ChevronRight size={16} className="block text-gray-500" />
//           <Link
//             href={{
//               pathname: "/profile/membership"
//             }}
//             className="group flex items-center transition-colors duration-150 text-gray-500 dark:text-gray-400 hover:text-blue-300">
//             <span className="text-foreground  group-hover:text-gray-300 pl-1.5">Membership</span>
//           </Link>
//           <ChevronRight size={16} className="block text-gray-500" />
//           <h1 className="text-gray-500 dark:text-gray-400">Check Out</h1>
//         </nav>
//       </div>

//       <main className="max-w-4xl mx-auto px-4">
//         <div className="border bg-card p-4 rounded-sm">
//           <h2 className="text-lg font-medium">Subscription</h2>
//           <p className="font-medium capitalize">
//             {category} - {term}
//           </p>
//           <p className="text-sm text-muted-foreground">
//             Price: ${price.toFixed(2)}
//           </p>
//         </div>
//         <div className="border bg-card p-4 rounded-sm mt-2">
//           <h2 className="text-sm text-gray-500">Seems like you haven't saved any addresses yet!</h2>
//           <div className="mt-4 border bg-[#00a0e9]/10 rounded-sm  p-1.5 text-center hover:bg-[#00a0e9]/80 transition-colors ">
//             <Link
//               href={{ pathname: "/profile/premium-account", query: { id: "me" } }}
//               className="text-[#00a0e9]/80 hover:text-card flex items-center justify-center text-center font-semibold">
//               <CirclePlus size={24} className="block mr-2" />
//               Add Address
//             </Link>
//           </div>
//         </div>
//         {/* Payment */}
//         <div className="border bg-card p-4 rounded-sm mt-2 space-y-3">
//           <h2 className="font-medium text-lg">Payment Method</h2>

//           <label className="flex gap-2">
//             <input
//               type="radio"
//               checked={method === "khqr"}
//               onChange={() => setMethod("khqr")}
//             />
//             KHQR
//           </label>

//           <label className="flex gap-2">
//             <input
//               type="radio"
//               checked={method === "card"}
//               onChange={() => setMethod("card")}
//             />
//             Card
//           </label>
//         </div>

//         <div className="border bg-card p-4 rounded-sm mt-2 space-y-2">
//           <h2 className="font-medium text-lg">Summary</h2>
//           <div className="flex justify-between text-sm">
//             <span>Subtotal</span>
//             <span>${price}</span>
//           </div>

//           <div className="flex justify-between text-sm">
//             <span>Discount</span>
//             <span>${vat}</span>
//           </div>

//           <div className="flex justify-between text-sm">
//             <span>VAT</span>
//             <span>${total}</span>
//           </div>
//         </div>

//         <button className="w-full bg-orange-500 text-white py-3 rounded">
//           Pay Now
//         </button>
//       </main>
//     </div>

//   )
// }

"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Link, useRouter } from "@/i18n/routing";
import { CirclePlus, EllipsisVertical, CreditCard, Zap } from "lucide-react";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
export default function CheckoutPage() {
  const params = useSearchParams();
  const router = useRouter();

  const category = params.get("category") || "Services";
  const term = params.get("term") === "1year" ? "1 Year" : "6 Months";
  const price = Number(params.get("price") || 60);

  const [method, setMethod] = useState("card");

  const discount = 0;
  const vat = price * 0.1;
  const total = price - discount + vat;

  return (
    <div className="min-h-screen bg-muted  pb-2">
      <div className="max-w-7xl mx-auto py-4">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Profile", href: "/me" },
            { label: "Membership", href: { pathname: "/me/membership" } },
            { label: "Check Out" },
          ]}
        />
      </div>

      <main className="max-w-4xl mx-auto px-4 space-y-4">
        {/* Subscription Card */}
        <div className="border bg-card rounded-sm p-4">
          <h2 className="text-lg font-medium mb-4">Subscription</h2>
          <div className="flex items-start justify-between">
            <div className="flex gap-4">
              <div className="w-16 h-16 bg-gray-200 rounded-sm flex items-center justify-center flex-shrink-0">
                <Image
                  src="/avatar/sayi.png"
                  alt="Profile"
                  width={80}
                  height={80}
                  className="w-full h-full object-cover rounded-sm"
                />
              </div>
              <div>
                <p className="font-semibold text-gray-900">
                  {category}: {term}
                </p>
                <p className="text-sm text-gray-600">Account ID: 1082891</p>
                <p className="text-sm text-gray-600">
                  {category}: {term}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Valid Until: 29. Oct 2026
                </p>
              </div>
            </div>
            <div className="text-right">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" className="rounded-full w-8 h-8 p-1">
                    <EllipsisVertical size={20} />
                  </Button>
                </PopoverTrigger>
                {/* This creates the border and the "Change" text container */}
                <PopoverContent className="w-24 p-1" align="end">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-sm font-normal"
                    onClick={() => router.push("/premium-account")}
                  >
                    Change
                  </Button>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
        <div className="border bg-card p-4 rounded-sm mt-2">
          <h2 className="text-sm text-gray-500">
            Seems like you haven&apos;t saved any addresses yet!
          </h2>
          <div className="mt-4 border bg-[#00a0e9]/10 rounded-sm  p-1.5 text-center hover:bg-[#00a0e9]/80 transition-colors group hover:cursor-pointer ">
            <Link
              href={{ pathname: "/premium-account", query: { id: "me" } }}
              className="text-[#00a0e9]/80 hover:text-card flex items-center justify-center text-center font-semibold group-hover:text-white"
            >
              <CirclePlus size={24} className="block mr-2" />
              Add Address
            </Link>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="border bg-white rounded-sm p-4 shadow-sm">
          <h2 className="text-lg font-medium mb-2">Payment Methods</h2>
          <div className="space-y-3">
            {/* KHQR */}
            <label
              className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
              htmlFor="khqr"
            >
              <input
                id="khqr"
                type="radio"
                checked={method === "khqr"}
                onChange={() => setMethod("khqr")}
                className="w-4 h-4"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-red-600 rounded flex items-center justify-center text-white font-bold text-sm">
                    KH
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">KHQR</p>
                    <p className="text-xs text-gray-600">
                      Scan to pay with any banking app
                    </p>
                  </div>
                </div>
              </div>
            </label>

            {/* Credit/Debit Card */}
            <label
              className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
              htmlFor="card"
            >
              <input
                id="card"
                type="radio"
                checked={method === "card"}
                onChange={() => setMethod("card")}
                className="w-4 h-4"
              />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-blue-600 rounded flex items-center justify-center">
                      <CreditCard size={20} className="text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        Credit/Debit Card
                      </p>
                      <div className="flex gap-1 mt-0.5">
                        <CreditCard size={14} className="text-blue-600" />
                        <Zap size={14} className="text-orange-500" />
                      </div>
                    </div>
                  </div>
                  {method === "card" && (
                    <div className="w-5 h-5 rounded-full border-2 border-blue-500 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    </div>
                  )}
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Summary */}
        <div className="border bg-card rounded-sm p-4 shadow-sm">
          <h2 className="text-lg font-medium mb-2">Summary</h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium">${price.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Discount</span>
              <span className="font-medium">${discount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">VAT</span>
              <span className="font-medium">${vat.toFixed(2)}</span>
            </div>
            <div className="border-t pt-2 mt-2 flex justify-between">
              <span className="font-semibold text-gray-900">
                Total (incl. VAT)
              </span>
              <span className="font-bold text-lg">${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <button className="w-full bg-orange-500 hover:bg-orange-600 text-card font-medium py-2 rounded-sm transition-colors">
          Review Address & Check out
        </button>
      </main>
    </div>
  );
}
