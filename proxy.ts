import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

import { auth } from "@/lib/auth/auth";

/**
 * Routes reachable without an authenticated session.
 *
 * `/accept-invitation` is public because the whole point is that the recipient
 * may not have an account yet — the page tells them to create one. Accepting
 * still requires a signed-in session whose email matches the invitation.
 *
 * `/forgot-password` and `/reset-password` are public because the person using
 * them has, by definition, no way in. They are not in `authRoutes` below: a
 * signed-in user following a reset link has a reason to be there.
 *
 * `/offline` is public because the service worker precaches it, and a fetch of
 * a guarded route follows the redirect — which would store the sign-in page
 * under the offline page's URL. It holds nothing worth guarding: no session, no
 * data, just an explanation.
 */
const publicRoutes = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/accept-invitation",
  "/offline",
];

/**
 * Routes that an authenticated user should never see.
 *
 * `/accept-invitation` is deliberately absent: a signed-in user following an
 * invitation link needs to reach it.
 */
const authRoutes = ["/sign-in", "/sign-up"];

/**
 * Where authenticated users land when they hit an auth route.
 */
const afterSignInRoute = "/";

/**
 * An optimistic check, and deliberately not a database one.
 *
 * This runs on every page request — every navigation and every link prefetch —
 * and used to look the session up in the database each time, only for the page
 * to do it again a moment later (the two run in separate contexts, so React's
 * `cache` cannot share the answer). For a private route the cookie's presence is
 * enough to decide: a forged or expired one gets through here and is turned
 * away by `requireUser`, which is the check that holds.
 *
 * **The auth routes are the exception, and must stay a real lookup.** Redirecting
 * on a cookie alone would bounce a stale cookie from `/sign-in` to `/`, which
 * redirects back to `/sign-in`, and so on without end.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  // Logged-in users should not access auth pages
  if (isAuthRoute) {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (session) {
      return NextResponse.redirect(new URL(afterSignInRoute, request.url));
    }
  }

  // Protect private pages, remembering where the user was headed
  if (!isPublicRoute && !getSessionCookie(request)) {
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
     * Protect all pages except:
     * - /api/*, whose route handlers authenticate themselves — better-auth
     *   guards its own endpoints, and the cron route uses CRON_SECRET. A
     *   session redirect here would turn an unauthorised API call into a 307
     *   pointing at the sign-in page.
     * - _next
     * - static files
     * - favicon
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
