import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE,
  ACCESS_MAX_AGE,
  API_URL,
  cookieOptions,
  decodeJwt,
  homeForRole,
  isExpired,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE,
} from "@/lib/session-cookies";

/**
 * Keeps the dashboard session alive and routes by role:
 * - expired access token + refresh token → rotate tokens before the page renders
 * - no usable session → /login
 * - wrong area for the role (landlord on /admin etc.) → their home
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let claims = decodeJwt(request.cookies.get(ACCESS_COOKIE)?.value);
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  let rotated: { accessToken: string; refreshToken: string } | null = null;

  if (isExpired(claims) && refreshToken) {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (res.ok) {
        rotated = await res.json();
        claims = decodeJwt(rotated!.accessToken);
      }
    } catch {
      // API unreachable: fall through and treat as signed out.
    }
  }

  const signedIn = !!claims && !isExpired(claims, 0);
  const isLogin = pathname === "/login";

  let response: NextResponse;
  if (!signedIn) {
    response = isLogin ? NextResponse.next() : NextResponse.redirect(new URL("/login", request.url));
    if (!isLogin) {
      response.cookies.delete(ACCESS_COOKIE);
      response.cookies.delete(REFRESH_COOKIE);
    }
    return response;
  }

  const home = homeForRole(claims!.role);
  const inWrongArea =
    isLogin ||
    pathname === "/" ||
    (pathname.startsWith("/landlord") && home !== "/landlord") ||
    (pathname.startsWith("/admin") && home !== "/admin");

  if (inWrongArea) {
    response = NextResponse.redirect(new URL(home, request.url));
  } else if (rotated) {
    // Make the new token visible to this render, too.
    request.cookies.set(ACCESS_COOKIE, rotated.accessToken);
    response = NextResponse.next({ request: { headers: request.headers } });
  } else {
    response = NextResponse.next();
  }

  if (rotated) {
    response.cookies.set(ACCESS_COOKIE, rotated.accessToken, { ...cookieOptions, maxAge: ACCESS_MAX_AGE });
    response.cookies.set(REFRESH_COOKIE, rotated.refreshToken, { ...cookieOptions, maxAge: REFRESH_MAX_AGE });
  }
  return response;
}

export const config = {
  matcher: ["/", "/login", "/landlord/:path*", "/admin/:path*"],
};
