"use client";

import type { ComponentType } from "react";
import {
  LayoutDashboard,
  Users,
  FileText,
  ChevronRight,
  CreditCard,
  Folder,
  FolderTreeIcon,
  Layers,
} from "lucide-react";
import {
  IconCalendarDollar,
  IconMessageChatbot,
  IconCategory2,
  IconPackages,
  IconClockHour4,
  IconGift,
  IconAccessPoint,
  IconCalendarStats,
  IconBriefcase,
  IconCircleLetterB,
  IconCircleLetterM,
  IconCircleLetterT,
  IconCarOffRoad,
  IconAdjustmentsShare,
  IconUserExclamation,
  IconCameraExclamation,
  IconUserCog,
  IconUserDollar,
} from "@tabler/icons-react";
import Link from "next/link";
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
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import Image from "next/image";

export type MenuItem = {
  title: string;
  icon: ComponentType<{ className?: string }>;
  href: string;
  items?: {
    title: string;
    icon: ComponentType<{ className?: string }>;
    href: string;
  }[];
};
export type DocumentItem = {
  title: string;
  icon: ComponentType<{ className?: string }>;
  href: string;
  items?: {
    title: string;
    icon: ComponentType<{ className?: string }>;
    href: string;
  }[];
};

export const menuItems: MenuItem[] = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    href: "/wanderer/dashboard",
  },
  {
    title: "Categories",
    icon: Folder,
    href: "/wanderer/dashboard/categories",
  },
  {
    title: "Subcategories",
    icon: FolderTreeIcon,
    href: "/wanderer/dashboard/subcategories",
  },
  // Group the attributes sub-items nested inside the main Attributes item!
  {
    title: "Attributes",
    icon: Layers,
    href: "/wanderer/dashboard/attributes",
    items: [
      {
        title: "Brands",
        icon: IconCircleLetterB,
        href: "/wanderer/dashboard/attributes/brands",
      },
      {
        title: "Models",
        icon: IconCircleLetterM,
        href: "/wanderer/dashboard/attributes/models",
      },
      {
        title: "Body Types",
        icon: IconCarOffRoad,
        href: "/wanderer/dashboard/attributes/bodytypes",
      },
      {
        title: "Accessories",
        icon: IconAdjustmentsShare,
        href: "/wanderer/dashboard/attributes/accessories",
      },
      {
        title: "Types",
        icon: IconCircleLetterT,
        href: "/wanderer/dashboard/attributes/types",
      },
      {
        title: "Job Types",
        icon: IconBriefcase,
        href: "/wanderer/dashboard/attributes/jobtypes",
      },
      {
        title: "Networks",
        icon: IconAccessPoint,
        href: "/wanderer/dashboard/attributes/networks",
      },
      {
        title: "Years",
        icon: IconCalendarStats,
        href: "/wanderer/dashboard/attributes/years",
      },
    ],
  },
  {
    title: "Team",
    icon: Users,
    href: "/wanderer/dashboard/team",
  },
  {
    title: "Manage Users",
    icon: IconUserCog,
    href: "/wanderer/dashboard/users",
    items: [
      {
        title: "Users",
        icon: Users,
        href: "/wanderer/dashboard/users",
      },
      {
        title: "Subscription Users",
        icon: IconUserDollar,
        href: "/wanderer/dashboard/users-subscription",
      },
    ],
  },
] as const;

const subscriptionSubItems = [
  {
    title: "Categories",
    icon: IconCategory2,
    href: "/wanderer/dashboard/subscription/categories",
  },
  {
    title: "Plans",
    icon: IconCalendarDollar,
    href: "/wanderer/dashboard/subscription/plans",
  },
  {
    title: "Packages",
    icon: IconPackages,
    href: "/wanderer/dashboard/subscription/packages",
  },
  {
    title: "Terms",
    icon: IconClockHour4,
    href: "/wanderer/dashboard/subscription/terms",
  },
  {
    title: "Free Plan",
    icon: IconGift,
    href: "/wanderer/dashboard/subscription/free-plan",
  },
] as const;

const documentItems: DocumentItem[] = [
  {
    title: "Reports",
    icon: FileText,
    href: "/wanderer/dashboard/report",
    items: [
      {
        title: "Report Users",
        icon: IconUserExclamation,
        href: "/wanderer/dashboard/report/users",
      },
      {
        title: "Report Posts",
        icon: IconCameraExclamation,
        href: "/wanderer/dashboard/report/posts",
      },
    ],
  }, // Use object style here too
  {
    title: "Feedback",
    icon: IconMessageChatbot,
    href: "/wanderer/dashboard/feedback",
  },
] as const; // <--- Add this

export function AppSidebar({ userRole }: { userRole: string }) {
  // The Team management page is super_admin-only — hide it from the sidebar
  // for regular admins.
  const visibleMenuItems = menuItems.filter(
    (item) => item.title !== "Team" || userRole === "super_admin",
  );
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center justify-between">
          {/* LEFT SIDE */}

          <Link
            href="/"
            className="flex items-center gap-2 w-full justify-start overflow-hidden"
          >
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
          <div className="group-data-[collapsible=icon]:hidden"></div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMenuItems.map((item) => {
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
            <SidebarMenu></SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2"></SidebarFooter>
    </Sidebar>
  );
}
