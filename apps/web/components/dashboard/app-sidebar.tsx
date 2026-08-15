"use client"

import type { ComponentProps, ComponentType } from "react"
import {
  LayoutDashboard,
  Users,
  FileText,
  ChevronRight,
  CreditCard,
  Folder,
  FolderTreeIcon,
  Layers,
} from "lucide-react"
import {
  IconCalendarDollar,
  IconMessageChatbot,
  IconCategory2,
  IconPackages,
  IconClockHour4,
  IconCar,
  IconAccessPoint,
  IconCalendarStats,
  IconPalette,
  IconBriefcase,
  IconBed,
  IconBath,
  IconEngine,
  IconScreenShare,
  IconServer,
  IconDeviceSdCard,
  IconCpu,
  IconCompass,
  IconOutlet,
  IconFileCv,
  IconCircleLetterB,
  IconCircleLetterM,
  IconCircleLetterT,
  IconCarOffRoad,
  IconAdjustmentsShare,
  IconUserExclamation,
  IconCameraExclamation,
  IconUserCog,
  IconUserDollar   

} from '@tabler/icons-react';
import { Link } from "@/i18n/routing";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarFooter
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import Image from "next/image"
export type MenuItem = {
  title: string
  icon: ComponentType<{ className?: string }>
  href: ComponentProps<typeof Link>["href"]
  items?: {
    title: string
    icon: ComponentType<{ className?: string }>
    href: ComponentProps<typeof Link>["href"]
  }[]
}
export type DocumentItem = {
  title: string
  icon: ComponentType<{ className?: string }>
  href: ComponentProps<typeof Link>["href"]
  items?: {
    title: string
    icon: ComponentType<{ className?: string }>
    href: ComponentProps<typeof Link>["href"]
  }[]
}

export const menuItems: MenuItem[] = [
  { title: "Dashboard", icon: LayoutDashboard, href: { pathname: "/dashboard" } },
  { title: "Categories", icon: Folder, href: { pathname: "/dashboard/categories" } },
  { title: "Subcategories", icon: FolderTreeIcon, href: { pathname: "/dashboard/subcategories" } },
  // Group the attributes sub-items nested inside the main Attributes item!
  {
    title: "Attributes",
    icon: Layers,
    href: { pathname: "/dashboard/attributes" },
    items: [
      { title: "Brands", icon: IconCircleLetterB, href: { pathname: "/dashboard/attributes/brands" } },
      { title: "Models", icon: IconCircleLetterM, href: { pathname: "/dashboard/attributes/models" } },
      { title: "Body Types", icon: IconCarOffRoad, href: { pathname: "/dashboard/attributes/bodytypes" } },
      { title: "Engines Types", icon: IconEngine, href: { pathname: "/dashboard/attributes/enginetypes" } },
      { title: "Vehicle Types", icon: IconCar, href: { pathname: "/dashboard/attributes/vehicletypes" } },
      { title: "Accessories", icon: IconAdjustmentsShare, href: { pathname: "/dashboard/attributes/accessories" } },
      { title: "Types", icon: IconCircleLetterT, href: { pathname: "/dashboard/attributes/types" } },
      { title: "Job Types", icon: IconBriefcase, href: { pathname: "/dashboard/attributes/jobtypes" } },
      { title: "Networks", icon: IconAccessPoint, href: { pathname: "/dashboard/attributes/networks" } },
      { title: "Bedrooms", icon: IconBed, href: { pathname: "/dashboard/attributes/bedrooms" } },
      { title: "Bathrooms", icon: IconBath, href: { pathname: "/dashboard/attributes/bathrooms" } },
      { title: "Facings", icon: IconCompass, href: { pathname: "/dashboard/attributes/facings" } },
      { title: "Experiences", icon: IconFileCv, href: { pathname: "/dashboard/attributes/experiences" } },
      { title: "Storages", icon: IconServer, href: { pathname: "/dashboard/attributes/storages" } },
      { title: "Screen Sizes", icon: IconScreenShare, href: { pathname: "/dashboard/attributes/screensizes" } },
      { title: "RAMs", icon: IconDeviceSdCard, href: { pathname: "/dashboard/attributes/rams" } },
      { title: "CPUs", icon: IconCpu, href: { pathname: "/dashboard/attributes/cpus" } },
      { title: "VGAs", icon: IconOutlet, href: { pathname: "/dashboard/attributes/vgas" } },
      { title: "Colors", icon: IconPalette, href: { pathname: "/dashboard/attributes/colors" } },
      { title: "Years", icon: IconCalendarStats, href: { pathname: "/dashboard/attributes/years" } },
    ]
  },
  { title: "Team", icon: Users, href: { pathname: "/dashboard/team" } },
  { title: "Manage Users", icon: IconUserCog, href: { pathname: "/dashboard/users" },
    items: [
      { title: "Users", icon: Users, href: { pathname: "/dashboard/users" } },
      { title: "Subscription Users", icon: IconUserDollar, href: { pathname: "/dashboard/users-subscription" } },
    ],
  },
] as const;

const subscriptionSubItems = [
  { title: "Categories", icon: IconCategory2, href: { pathname: "/dashboard/subscription/categories" } },
  { title: "Plans", icon: IconCalendarDollar, href: { pathname: "/dashboard/subscription/plans" } },
  { title: "Packages", icon: IconPackages, href: { pathname: "/dashboard/subscription/packages" } },
  { title: "Terms", icon: IconClockHour4, href: { pathname: "/dashboard/subscription/terms" } },
] as const;

const documentItems: DocumentItem[] = [
  { title: "Reports", icon: FileText, href: { pathname: "/dashboard/report" },
    items: [
      { title: "Report Users", icon: IconUserExclamation, href: { pathname: "/dashboard/report/users" } },
      { title: "Report Posts", icon: IconCameraExclamation, href: { pathname: "/dashboard/report/posts" } },
    ],
  }, // Use object style here too
  { title: "Feedback", icon: IconMessageChatbot, href: { pathname: "/dashboard/feedback" } },
] as const; // <--- Add this


export function AppSidebar() {
  
  
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center justify-between">
          {/* LEFT SIDE */}

          <Link href="/" className="flex items-center gap-2 w-full justify-start overflow-hidden">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
              <Image
                src="/logo/psa-npic.png"
                alt="PSA NPIC"
                width={20}
                height={20}
                className="h-5 w-5 object-contain"
              />
            </div>
            <span className="text-2xl font-semibold truncate group-data-[collapsible=icon]:hidden">
              <span className="text-foreground">PSA</span>{" "}
              <span className="text-[#00a0e9]">KHMER</span>
            </span>
          </Link>
          <div className="group-data-[collapsible=icon]:hidden">
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                // If the item has sub-items (like Attributes), render a Collapsible group
                if (item.items) {
                  return (
                    <Collapsible key={item.title} className="group/collapsible">
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton tooltip={item.title}>
                            <item.icon className="size-4" />
                            <span>{item.title}</span>
                            <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.items.map((subItem) => (
                              <SidebarMenuSubItem key={subItem.title}>
                                <SidebarMenuSubButton asChild>
                                  <Link href={subItem.href}>
                                    <subItem.icon className="size-4" />
                                    <span>{subItem.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }
                // Otherwise, render a normal single link item (Dashboard, Categories, etc.)
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <Link href={item.href}>
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
          <Collapsible className="group/collapsible">
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip="Subscriptions">
                  <CreditCard className="size-4" />
                  <span>Subscriptions</span>
                  <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {subscriptionSubItems.map((subItem) => (
                    <SidebarMenuSubItem key={subItem.title}>
                      <SidebarMenuSubButton asChild>
                        <Link href={subItem.href}>
                          <subItem.icon className="size-4" />
                          <span>{subItem.title}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Moderation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {documentItems.map((item) => {
                // If the item has sub-items (like Attributes), render a Collapsible group
                if (item.items) {
                  return (
                    <Collapsible key={item.title} className="group/collapsible">
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton tooltip={item.title}>
                            <item.icon className="size-4" />
                            <span>{item.title}</span>
                            <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.items.map((subItem) => (
                              <SidebarMenuSubItem key={subItem.title}>
                                <SidebarMenuSubButton asChild>
                                  <Link href={subItem.href}>
                                    <subItem.icon className="size-4" />
                                    <span>{subItem.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }
                // Otherwise, render a normal single link item (Dashboard, Categories, etc.)
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <Link href={item.href}>
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2">
      </SidebarFooter>
    </Sidebar>
  )
}
