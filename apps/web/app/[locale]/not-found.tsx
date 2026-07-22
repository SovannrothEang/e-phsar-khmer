'use client'

import {Link} from '@/i18n/routing'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center">
      <h2 className="text-3xl font-bold tracking-tight">Page Not Found</h2>
      <p className="text-muted-foreground">
        Sorry, we couldn't find the page you are looking for.
      </p>
      <Link 
        href="/"
        className="rounded-sm bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
      >
        Return Home
      </Link>
    </div>
  )
}