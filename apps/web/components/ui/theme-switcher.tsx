"use client"

import React from "react"
import { useTheme } from "next-themes"
import {
  IconSunHigh,
  IconMoonFilled,
  IconDeviceDesktop,
} from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()

  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    // Gate SSR/hydration: theme is only known after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10"
      />
    )
  }
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild className="cursor-pointer">
        <Button
          variant="ghost"
          size="icon-lg"
          className="h-10 w-10 hover:bg-muted/60 hover:rounded-full transition-all duration-200"
        >
          {theme === "light" && (
            <IconSunHigh stroke={2} className="h-[1.2rem] w-[1.2rem]" />
          )}

          {theme === "dark" && (
            <IconMoonFilled className="h-[1.1rem] w-[1.1rem]" />
          )}

          {theme === "system" && (
            <IconDeviceDesktop
              stroke={2}
              className="h-[1.1rem] w-[1.1rem]"
            />
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        sideOffset={10}
        className="w-44 rounded-lg shadow-xl"
      >
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className="flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer"
        >
          <IconSunHigh className="h-6 w-6" />
          <span>Light</span>

          {theme === "light" && (
            <div className="ml-auto h-2 w-2 rounded-full bg-[#00a0e9]" />
          )}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className="flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer"
        >
          <IconMoonFilled className="h-6 w-6" />
          <span>Dark</span>

          {theme === "dark" && (
            <div className="ml-auto h-2 w-2 rounded-full bg-[#00a0e9]" />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className="flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer"
        >
          <IconDeviceDesktop className="h-6 w-6" />
          <span>System</span>

          {theme === "system" && (
            <div className="ml-auto h-2 w-2 rounded-full bg-[#00a0e9]" />
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}