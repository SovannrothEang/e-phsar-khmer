import { useEffect, useRef } from "react"

/**
 * useClickOutside
 * Calls `handler` whenever a click/touch occurs outside the returned ref.
 *
 * Usage:
 *   const ref = useClickOutside<HTMLDivElement>(() => setOpen(false))
 *   <div ref={ref}>...</div>
 */
export function useClickOutside<T extends HTMLElement = HTMLElement>(
  handler: () => void,
  enabled: boolean = true   // pass `false` to pause listening (e.g. when closed)
) {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!enabled) return

    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handler()
      }
    }

    // pointerdown fires before click, works for mouse + touch + stylus
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [handler, enabled])

  return ref
}
