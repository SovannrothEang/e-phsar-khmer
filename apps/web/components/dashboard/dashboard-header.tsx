"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Link } from "@/i18n/routing"
import { ThemeSwitcher } from "@/components/ui/theme-switcher"
import  Notifications  from "./notifications"
import { Bell } from 'lucide-react';
import { NavUser } from "./nav-user"

export function DashboardHeader() {
  return (
    <header className="flex items-center justify-between border-b px-6 py-4">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="-ml-2" />
        <h1 className="text-xl font-semibold">DashBoard</h1>
      </div>

      <div className="ml-auto flex items-center gap-4">
        <ThemeSwitcher />
        <Notifications />
        <NavUser />
      </div>
    </header>
  )
}
