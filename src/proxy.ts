import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic guard for the signed-in area: no session cookie → /login.
 * It only looks at the cookie; the real check happens on the server
 * (src/lib/auth/session.ts) in every page and action.
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();

  const url = request.nextUrl.clone();
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  url.pathname = "/login";
  url.search = next === "/me" ? "" : `?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/me/:path*", "/match/:path*", "/onboarding/:path*", "/groups/:path*", "/invite/:path*", "/settings/:path*"],
};
