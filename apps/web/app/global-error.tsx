"use client"; // Error boundaries must be Client Components

import "@/styles/globals.css";

const themeBootstrap = `try{var t=localStorage.getItem("theme");var d=t==="dark"||((!t||t==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);var e=document.documentElement;e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light"}catch(e){}`;

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="flex min-h-screen items-center justify-center bg-background p-6 font-sans text-foreground">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Please try again. If it keeps happening, reload the page.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="mt-6 h-10 rounded-sm bg-[#00a0e9] px-6 text-sm font-medium text-white transition-colors hover:bg-[#00a0e9]/80"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
