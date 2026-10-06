/**
 * Previously wrapped `ThemeProvider` in `next/dynamic(…, { ssr: false })` to
 * keep next-themes' inline no-flicker script out of the server render.
 *
 * That one `ssr: false` opted the WHOLE app out of server rendering: any
 * `ssr: false` dynamic in the tree makes React bail out to client-side
 * rendering for the entire route, so every page shipped an empty body and
 * `notFound()` could never set a 404 status (Next had already flushed a 200).
 *
 * next-themes is SSR-safe in 0.4.x and renders that script on purpose, and
 * `theme-provider.tsx` already silences React 19's false-positive warning
 * about it — so the wrapper is now a plain re-export.
 */
export { ThemeProvider as ClientThemeProvider } from "@/components/theme-provider";
