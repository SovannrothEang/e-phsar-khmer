import "@/styles/globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found" };

const themeBootstrap = `try{var t=localStorage.getItem("theme");var d=t==="dark"||((!t||t==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);var e=document.documentElement;e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light"}catch(e){}`;

export default function GlobalNotFound() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="flex min-h-screen items-center justify-center bg-background p-6 font-sans text-foreground">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <p className="text-sm font-semibold text-[#00a0e9]">404</p>
          <h1 className="mt-2 text-xl font-semibold">Page not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The page you are looking for does not exist or has moved.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex h-10 items-center rounded-sm bg-[#00a0e9] px-6 text-sm font-medium text-white transition-colors hover:bg-[#00a0e9]/80"
          >
            Go home
          </Link>
        </div>
      </body>
    </html>
  );
}
