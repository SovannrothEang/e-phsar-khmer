"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import SettingSidebar from "../setting/SettingSidebar";
import { MapPinHouse } from "lucide-react";

export default function BillingAddresses() {
  const router = useRouter();

  const handleAddAddress = () => {
    router.push("/me/billing-addresses/add");
  };

  return (
    <div className="min-h-screen bg-muted pb-10 pt-4">
      <div className="max-w-6xl mx-auto  ">
        <div className="flex gap-5 ">
          <SettingSidebar />
          <main className="flex-1 flex flex-col items-center">
            <h1 className="text-2xl  font-medium text-foreground mb-4 w-full">
              Billing Address
            </h1>

            <div className="bg-card  rounded-sm shadow-sm p-8 flex flex-col items-center justify-center min-h-[380px] w-[650px]">
              <div className="flex justify-center mb-6">
                <div className="bg-muted rounded-full h-36 w-36 flex items-center justify-center">
                  <MapPinHouse
                    size={64}
                    className="text-slate-600"
                    strokeWidth={1.5}
                  />
                </div>
              </div>
              <div className="text-center space-y-2 mb-8">
                <h2 className="text-xl font-medium text-foreground">
                  No Address
                </h2>
                <p className="text-sm text-muted-foreground">
                  Seems like you haven&apos;t saved any addresses yet!
                </p>
              </div>

              <Button
                onClick={handleAddAddress}
                className="bg-[#f68b1e] hover:bg-[#e57a10] text-white rounded-sm px-10 h-10 font-medium transition-colors cursor-pointer"
              >
                Add Address
              </Button>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
