import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { ACCESS_TOKEN_COOKIE } from "./lib/auth/session";

const intlMiddleware = createMiddleware(routing);

const LOCALE_RE = new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`);

export default function proxy(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  const localeMatch = pathname.match(LOCALE_RE);
  const locale = localeMatch?.[1] ?? routing.defaultLocale;
  const rest = localeMatch ? pathname.slice(localeMatch[0].length) : pathname;

  // Guard the admin dashboard: no access-token cookie → send to login.
  if (rest === "/dashboard" || rest.startsWith("/dashboard/")) {
    const hasToken = Boolean(req.cookies.get(ACCESS_TOKEN_COOKIE)?.value);
    if (!hasToken) {
      const url = req.nextUrl.clone();
      url.pathname = `/${locale}/login`;
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return intlMiddleware(req);
}

export const config = {
  // Match only internationalized pathnames
  matcher: ["/", "/(en|km|zh|ko|id|vi)/:path*"],
};
