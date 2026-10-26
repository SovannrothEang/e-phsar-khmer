"use client";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Bell, Package, AlertTriangle, Briefcase, Zap } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

// Define notification types and data structure
type Notification = {
  id: number;
  type: "order" | "task" | "alert" | "update";
  title: string;
  description: string;
  time: string;
  isUnread: boolean;
};

// Placeholder data for the notifications
const notificationsData: Notification[] = [
  {
    id: 1,
    type: "order",
    title: "Order #4592 Shipped!",
    description: "Your recent purchase is on its way. Track your package.",
    time: "5 min ago",
    isUnread: true,
  },
  {
    id: 2,
    type: "task",
    title: "New Team Task Assigned",
    description: "Project 'Phoenix' deadline updated. Review the brief.",
    time: "1 hour ago",
    isUnread: true,
  },
  {
    id: 3,
    type: "alert",
    title: "Weekly Summary Available",
    description: "Your performance overview for last week is ready.",
    time: "3 hours ago",
    isUnread: true,
  },
  {
    id: 4,
    type: "update",
    title: "System Update Complete",
    description: "New features applied successfully. View release notes.",
    time: "5 hours ago",
    isUnread: false,
  },
  {
    id: 5,
    type: "alert",
    title: "Security Alert: Unusual Login",
    description: "A new device was used to access your account.",
    time: "2 days ago",
    isUnread: false,
  },
  {
    id: 6,
    type: "alert",
    title: "Security Alert: Unusual Login",
    description: "A new device was used to access your account.",
    time: "2 days ago",
    isUnread: false,
  },
  {
    id: 7,
    type: "alert",
    title: "Security Alert: Unusual Login",
    description: "A new device was used to access your account.",
    time: "2 days ago",
    isUnread: false,
  },
];

// Helper component for different notification type icons
const NotificationIcon = ({ type }: { type: Notification["type"] }) => {
  switch (type) {
    case "order":
      return <Package className="h-6 w-6 text-blue-500" />;
    case "task":
      return <Briefcase className="h-6 w-6 text-orange-500" />;
    case "alert":
      return <AlertTriangle className="h-6 w-6 text-red-500" />;
    case "update":
      return <Zap className="h-6 w-6 text-green-500" />;
    default:
      return <Bell className="h-6 w-6 text-gray-500" />;
  }
};

export default function Notifications() {
  const [open, setOpen] = useState(false);

  // Dynamically calculate the unread count
  const unreadCount = notificationsData.filter((n) => n.isUnread).length;

  return (
    <Drawer open={open} onOpenChange={setOpen} direction="left">
      <DrawerTrigger asChild>
        <Button
          variant="ghost"
          size="icon" // Use "icon" instead of "icon-lg" for standard shadcn sizing
          className="relative rounded-full cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <Bell
            className="h-5 w-5 text-zinc-700 dark:text-zinc-300"
            size={20}
          />

          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 type-photo-badge text-white antialiased">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </DrawerTrigger>

      <DrawerContent className="max-w-md ml-auto h-screen border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <DrawerHeader className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <DrawerTitle className="text-zinc-950 dark:text-zinc-50">
                Notifications Center
              </DrawerTitle>
              <DrawerDescription className="type-body-sm text-zinc-600 dark:text-zinc-400">
                You have {unreadCount} unread notifications
              </DrawerDescription>
            </div>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="type-meta h-8 px-3"
              >
                Mark all as read
              </Button>
            )}
          </div>
        </DrawerHeader>

        <div className="no-scrollbar overflow-y-auto h-full px-2 py-3 space-y-3">
          {notificationsData.map((notification) => (
            <div
              key={notification.id}
              className={cn(
                "relative flex items-start gap-4 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors cursor-pointer",
                notification.isUnread
                  ? "bg-white dark:bg-zinc-950"
                  : "bg-zinc-50 dark:bg-zinc-900",
              )}
            >
              {/* Unread Indicator Dot */}
              {notification.isUnread && (
                <div className="absolute top-4 right-4 h-2.5 w-2.5 rounded-full bg-red-600" />
              )}

              {/* Left Side: Icon and Indicator */}
              <div
                className={cn(
                  "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full",
                  notification.isUnread
                    ? "bg-zinc-100 dark:bg-zinc-800"
                    : "bg-white dark:bg-zinc-950",
                )}
              >
                <NotificationIcon type={notification.type} />
              </div>

              {/* Right Side: Content and Time */}
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h4
                    className={cn(
                      "type-body text-zinc-950 dark:text-zinc-50 pr-6", // Added padding right for the dot
                      notification.isUnread
                        ? ""
                        : "text-zinc-700 dark:text-zinc-300",
                    )}
                  >
                    {notification.title}
                  </h4>
                </div>
                <p className="type-body-sm text-zinc-700 dark:text-zinc-300">
                  {notification.description}
                </p>
                <span className="type-meta text-zinc-500 dark:text-zinc-400">
                  {notification.time}
                </span>
              </div>
            </div>
          ))}

          {/* Placeholder for "Load More" or "No More Notifications" */}
          <div className="text-center pt-6 pb-4">
            <p className="type-body-sm text-zinc-500 dark:text-zinc-400">
              Showing 5 of 28 notifications
            </p>
          </div>
        </div>

        {/* Optional Footer (keep commented if unused) */}
        {/* <DrawerFooter className="border-t border-zinc-200 dark:border-zinc-800 p-4">
                    <DrawerClose asChild>
                        <Button className="w-full">Close Center</Button>
                    </DrawerClose>
                </DrawerFooter> */}
      </DrawerContent>
    </Drawer>
  );
}
