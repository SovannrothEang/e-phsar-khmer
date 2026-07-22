"use client"

import * as React from "react"
import dynamic from "next/dynamic"

// Dynamically load the actual ThemeProvider only on the client
const DynamicProvider = dynamic(
  () => import("@/components/theme-provider").then((mod) => mod.ThemeProvider),
  { ssr: false }
)

export function ClientThemeProvider({ children, ...props }: any) {
  return <DynamicProvider {...props}>{children}</DynamicProvider>
}