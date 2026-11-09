"use client";

export default function LocaleError({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-[60vh] items-center justify-center bg-background p-6">
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
    </main>
  );
}
