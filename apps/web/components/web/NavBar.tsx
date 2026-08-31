"use client";

import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { FaCamera } from "react-icons/fa";
import SearchBar from "./SearchBar";
import { SocialBar } from "./SocialBar";
import LocalSelector from "../LocalSelector"
import { useLocale } from "next-intl";

export type User = {
  username: string
  role: string
  email: string
  profileImage: string
  firstName: string | null
  lastName: string | null
  profilePhotoUrl: string | null
}

export function NavBar({ user }: { user: User | null }) {

  const locale = useLocale()
  const isLoggedIn = !!user;

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-card">
      <div className="mx-auto max-w-7xl  py-2.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-shrink-0">
            <Link href={`/`} className="flex items-center gap-2">
              <div className="text-3xl font-bold whitespace-nowrap tracking-tight">
                <span className="text-foreground">PSA</span>
                <span className="text-[#00a0e9]">KHMER</span>
              </div>
            </Link>
            <div className="flex items-center gap-1">
              {/* <LocaleSwitcher /> */}
              <LocalSelector defaultValue={locale} label="Language" />
              <ThemeSwitcher />
            </div>
          </div>
          <SearchBar />
          <div
            className={
              isLoggedIn
                ? "flex items-center gap-4 flex-shrink-0 ml-2"
                : "flex items-center gap-4 flex-shrink-0 ml-2"
            }
          >
            {isLoggedIn ? (
              <SocialBar user={user!} />
            ) : (
              <div className="flex items-center">
                <Button
                  asChild
                  variant="ghost"
                  className="h-[42px] px-4 rounded text-base font-medium rounded text-[#00a0e9] bg-transparent border border-transparent transition-all duration-200 hover:bg-[#00a0e9]/80 hover:text-white"

                >
                  <Link href="/login">Login</Link>
                </Button>

                <Button
                  asChild
                  variant="ghost"
                  className="h-[42px] px-4 rounded text-base font-medium text-[#00a0e9] bg-transparent border border-transparent transition-all duration-200 hover:bg-[#00a0e9]/80 hover:text-white"
                >
                  <Link href="/register">Register</Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  className="h-[42px] bg-[#f68b1e] text-white px-6 text-base font-medium rounded transition-colors hover:bg-[#f68b1e]/80 hover:text-white"
                >
                  <Link href={`/login`}>
                    <FaCamera className="scale-120" strokeWidth={2.5} />
                    Sell
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
