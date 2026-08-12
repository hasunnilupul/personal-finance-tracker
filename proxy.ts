import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth/auth";

/**
 * Routes reachable without an authenticated session.
 */
const publicRoutes = ["/sign-in", "/sign-up"];

/**
 * Routes that an authenticated user should never see.
 */
const authRoutes = ["/sign-in", "/sign-up"];

/**
 * Where authenticated users land when they hit an auth route.
 */
const afterSignInRoute = "/";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  // Logged-in users should not access auth pages
  if (session && isAuthRoute) {
    return NextResponse.redirect(new URL(afterSignInRoute, request.url));
  }

  // Protect private pages, remembering where the user was headed
  if (!session && !isPublicRoute) {
    const signInUrl = new URL("/sign-in", request.url);

    if (pathname !== afterSignInRoute) {
      signInUrl.searchParams.set("redirect", `${pathname}${search}`);
    }

    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Protect all routes except:
     * - _next
     * - static files
     * - favicon
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
