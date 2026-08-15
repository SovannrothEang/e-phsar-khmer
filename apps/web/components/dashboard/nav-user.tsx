'use client'
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Bell, LogOut, Users } from "lucide-react"
import { useEffect, useState } from "react"

type User = {
  username: string
  role: string
  email: string
  profileImage: string
}

export function NavUser() {

  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const storedUser = localStorage.getItem("user")

    if (storedUser) {
      // Hydrate once from localStorage (client-only data source).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUser(JSON.parse(storedUser))
    }
  }, [])

  if (!user) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <Avatar size="lg">
            <AvatarImage src={user.profileImage} alt={user.username} />
            <AvatarFallback>
              {user.username ? user.username[0].toUpperCase() : "U"}
            </AvatarFallback>
            <AvatarBadge className="bg-green-600 dark:bg-green-800" />
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48" sideOffset={12} align="end">
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarImage src={user.profileImage} alt={user.username} />
              <AvatarFallback className="rounded-lg">CN</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.username}</span>
              <span className="truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <Users className="mr-2 size-4" />
            Account
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Bell className="mr-2 size-4" />
            Notifications
          </DropdownMenuItem>
          <DropdownMenuItem>
            {/* <Roles className="mr-2 size-4" /> */}
            Role: <div className="ml-1 rounded-lg px-2 py-0.5 bg-sky-100 text-sky-900 dark:bg-sky-900 dark:text-sky-100">{user.role}</div>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem variant="destructive"><LogOut className="mr-2 size-4" />Log out</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
