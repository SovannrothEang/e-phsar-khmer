import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { ACCESS_TOKEN_COOKIE } from "./lib/auth/session";

const intlMiddleware = createMiddleware(routing);

const LOCALE_RE = new RegExp(`^/(en|km)(?=/wanderer(?:/|$))`);

export default function proxy(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  // Strip a stray locale prefix from /wanderer/* URLs (e.g. /en/wanderer/login
  // → /wanderer/login). The admin surface is intentionally non-localized.
  const strayLocale = pathname.match(LOCALE_RE);
  if (strayLocale) {
    const url = req.nextUrl.clone();
    url.pathname = "/" + pathname.slice(strayLocale[0].length);
    return NextResponse.redirect(url);
  }

  // The entire /wanderer/* surface is non-localized — never hand it to
  // next-intl (which would prepend a locale prefix and 404).
  if (pathname === "/wanderer" || pathname.startsWith("/wanderer/")) {
    // Guard the dashboard: no admin token → /wanderer/login.
    if (
      pathname === "/wanderer/dashboard" ||
      pathname.startsWith("/wanderer/dashboard/")
    ) {
      const hasToken = Boolean(req.cookies.get(ACCESS_TOKEN_COOKIE)?.value);
      if (!hasToken) {
        const url = req.nextUrl.clone();
        url.pathname = "/wanderer/login";
        url.searchParams.set("next", pathname);
        return NextResponse.redirect(url);
      }
    }
    return NextResponse.next();
  }

  // Locale-prefixed paths → next-intl.
  return intlMiddleware(req);
}

export const config = {
  matcher: ["/", "/(en|km)/:path*", "/wanderer/:path*"],
};
