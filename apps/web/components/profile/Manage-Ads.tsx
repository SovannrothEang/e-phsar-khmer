"use client";
import { SearchIcon, ImagePlus, Funnel } from "lucide-react";
import { Field } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/routing";

export default function ManageAds() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"active" | "expired">("active");

  return (
    <div className="min-h-screen bg-muted pt-4">
      <div className="max-w-7xl mx-auto bg-card rounded-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border">
          <h1 className="text-foreground text-xl py-2 px-4 pt-6">Manage Ads</h1>
          <hr />
          <div className="flex items-center justify-end gap-3 py-2 pt-6 px-6">
            <Field className="flex-1">
              <InputGroup>
                <InputGroupInput
                  id="inline-start-input"
                  placeholder="Search..."
                  className="h-11 border-gray-200 focus:ring-0"
                />
                <InputGroupAddon align="inline-end">
                  <SearchIcon className="text-muted-foreground w-5 h-5 mr-2" />
                </InputGroupAddon>
              </InputGroup>
            </Field>
            <Button
              variant="outline"
              className="h-10 rounded-sm px-5 border-muted-foreground text-foreground hover:text-foreground font-medium"
            >
              <Funnel className="scale-120" />
              Filter
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10 px-4">
          <div className="bg-muted h-20 w-full rounded-md p-6 text-center text-primary font-medium cursor-pointer hover:bg-muted/80 transition-colors flex flex-col justify-center gap-1">
            Total Ads
            <p className="text-lg  text-foreground">0/5</p>
          </div>
          <div className="bg-muted h-20 w-full text-center p-6 rounded-md text-foreground font-medium cursor-pointer hover:bg-muted/80 transition-colors flex flex-col justify-center gap-1">
            Renews
            <p className="text-lg text-foreground">0/5</p>
          </div>
        </div>
        <div className="bg-muted rounded-md mb-12 mx-4 p-2 flex">
          <button
            onClick={() => setActiveTab("active")}
            className={`flex-1 h-10 rounded-md text-base font-semibold transition-all cursor-pointer ${
              activeTab === "active"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent/50"
            }`}
          >
            Active <span className="text-[#00a0e9]">(0)</span>
          </button>
          <button
            onClick={() => setActiveTab("expired")}
            className={`flex-1 h-10 rounded-md text-base font-semibold transition-all cursor-pointer ${
              activeTab === "expired"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent/50"
            }`}
          >
            Expired <span className="text-[#00a0e9]">(0)</span>
          </button>
        </div>
        <div className="flex flex-col items-center justify-center px-4 text-center min-h-[400px]">
          <div className="bg-muted w-36 h-36 rounded-full flex items-center justify-center ">
            <ImagePlus className="w-16 h-16 text-muted-foreground stroke-1" />
          </div>

          <h2 className="text-lg font-medium text-foreground mb-3">
            No Result!
          </h2>

          {activeTab === "active" ? (
            <div className="flex flex-col items-center gap-8">
              <p className="text-muted-foreground text-sm">
                Oops! You don&apos;t have any active ads.
              </p>
              <Button
                onClick={() => router.push("/post")}
                className="bg-[#f28e1c] hover:bg-[#d17a15] text-white font-semibold text-sm px-6 py-5   rounded-sm transition-colors cursor-pointer"
              >
                Sell your stuff
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              You don&apos;t have any expired ads yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
