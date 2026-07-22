"use client"
import { LayoutList, LayoutGrid } from "lucide-react"
import { cn } from "@/lib/utils"

interface ViewToggleProps {
  view: "list" | "grid"
  onViewChange: (view: "list" | "grid") => void
}

export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="flex items-center border border-border rounded-sm overflow-hidden">
      <button
        onClick={() => onViewChange("list")}
        className={cn(
          "p-1.5 transition-colors",
          view === "list"
            ? "bg-foreground text-background"
            : "hover:bg-muted text-muted-foreground"
        )}
      >
        <LayoutList size={18} />
      </button>
      <button
        onClick={() => onViewChange("grid")}
        className={cn(
          "p-1.5 transition-colors",
          view === "grid"
            ? "bg-foreground text-background"
            : "hover:bg-muted text-muted-foreground"
        )}
      >
        <LayoutGrid size={18} />
      </button>
    </div>
  )
}