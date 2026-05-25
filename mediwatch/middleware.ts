import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public routes that do NOT require authentication
const PUBLIC_ROUTES = ["/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes through without any check
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow Next.js internals and static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(png|jpg|jpeg|svg|ico|webp|gif|css|js)$/)
  ) {
    return NextResponse.next();
  }

  // Check for auth token in cookies (set during login)
  const token = request.cookies.get("doctor_token")?.value;

  if (!token) {
    // Redirect unauthenticated users to /login
    const loginUrl = new URL("/login", request.url);
    // Preserve the original URL so we can redirect back after login
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run middleware on all routes except Next.js internals
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
