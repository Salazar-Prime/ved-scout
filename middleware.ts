import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/sessionConstants";

const PUBLIC_PATHS = ["/login"];
const BYPASS_PREFIXES = ["/api/auth", "/_next", "/favicon.ico"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) {
    // Redirect authenticated users away from login
    if (pathname === "/login" && request.cookies.has(SESSION_COOKIE_NAME)) {
      return NextResponse.redirect(new URL("/overview", request.url));
    }
    return NextResponse.next();
  }

  // Protect all other routes
  if (!request.cookies.has(SESSION_COOKIE_NAME)) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
