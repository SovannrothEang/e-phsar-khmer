import Image from "next/image";
import { Link } from "@/i18n/routing";
import { ChevronRight, House } from "lucide-react";
export default function SafetyTips() {
  return (
    <div className="h-[calc(100vh-144px)] mx-auto w-full bg-muted">
      <div className="px-4 bg-muted">
        <div className="max-w-7xl mx-auto w-full pb-2 pt-4">
          <nav className="flex items-center gap-2 text-base">
            <Link
              href="/"
              className="group flex items-center transition-colors duration-150 text-foreground dark:text-gray-400 hover:text-blue-300"
            >
              <House
                size={16}
                className="text-foreground dark:text-gray-400 group-hover:text-blue-300"
              />
              <span className="text-foreground dark:text-gray-400 group-hover:text-blue-300 pl-1.5">
                Home
              </span>
            </Link>
            <ChevronRight size={16} className="block text-muted-foreground" />
            <h1 className="text-muted-foreground dark:text-gray-400">
              Ads Posting Rule
            </h1>
          </nav>
        </div>
      </div>
      <div className="max-w-lg mx-auto">
        <div className="bg-card rounded-sm border border-border p-4 shadow-sm">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Image
              src="/user-img/warning.png"
              alt="warning icon"
              width={32}
              height={32}
              unoptimized
            />
            <h2 className="text-[#e3281b] text-lg font-bold">
              Safety Tips for Buyers
            </h2>
          </div>
          <ol className="space-y-3 text-sm text-foreground/80 list-decimal pl-6">
            <li>Do not send money before receiving the goods</li>
            <li>Check the item before you buy</li>
            <li>Payment after receiving the goods</li>
            <li>Meet the seller at a safe location</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
