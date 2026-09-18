"use client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { BriefcaseBusiness } from "lucide-react";
import { Button } from "../ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "@/i18n/routing";
import { useRouter } from "@/i18n/routing";
export default function JobApplications() {
  const router = useRouter();

  return (
    <div className="min-w-full bg-muted pb-50 pt-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-medium text-foreground mb-6">Jobs</h1>
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
          <div className="flex items-center">
            <Tabs defaultValue="applied">
              <TabsList variant="line">
                <TabsTrigger value="applications" className="asChild">
                  <Link href={{ pathname: "/me/job-applications" }}>
                    Applications
                  </Link>
                </TabsTrigger>
                <TabsTrigger value="applied" className="asChild">
                  <Link href={{ pathname: "/me/applied-jobs" }}>Applied</Link>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex items-center gap-3">
            <Select defaultValue="all">
              <SelectTrigger className="w-[180px] bg-card ">
                <SelectValue placeholder="Status: All" />
              </SelectTrigger>
              <SelectContent className="item-center">
                <SelectItem value="all" className="cursor-pointer">
                  Status: All
                </SelectItem>
                <SelectItem value="ads" className="cursor-pointer">
                  All
                </SelectItem>
                <SelectItem value="addons" className="cursor-pointer">
                  Pending
                </SelectItem>
                <SelectItem value="account" className="cursor-pointer">
                  Hired
                </SelectItem>
                <SelectItem value="account" className="cursor-pointer">
                  Viewed
                </SelectItem>
                <SelectItem value="account" className="cursor-pointer">
                  Rejected
                </SelectItem>
              </SelectContent>
            </Select>

            <Select defaultValue="all">
              <SelectTrigger className="w-[180px] bg-card ">
                <SelectValue placeholder="Sort: Newest" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Sort: Newest</SelectItem>
                <SelectItem value="expired">Newest</SelectItem>
                <SelectItem value="nearly">Oldest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <main className="max-w-2xl mx-auto mt-4">
          <div className="bg-card rounded-sm shadow-sm  min-h-[450px] flex flex-col items-center justify-center p-8">
            <div className="w-32 h-32 bg-muted rounded-full flex items-center justify-center mb-8">
              <div className="relative">
                <BriefcaseBusiness
                  className="w-12 h-12 text-muted-foreground"
                  strokeWidth={1.5}
                />
              </div>
            </div>

            <div className="text-center">
              <h2 className="text-xl font-medium text-foreground mb-2">
                No Result!
              </h2>
              <p className="text-muted-foreground text-sm mb-8">
                You don&apos;t have any job applied right now.
              </p>
              <Button
                onClick={() =>
                  router.push({
                    pathname: "/category/[categorySlug]",
                    params: { categorySlug: "jobs" },
                  })
                }
                className="bg-orange-400 hover:bg-orange-600 text-card font-medium h-10 px-8 rounded-sm transition-colors cursor-pointer"
              >
                See Job Available
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
