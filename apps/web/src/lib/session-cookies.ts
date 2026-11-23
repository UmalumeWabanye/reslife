// Shared by proxy.ts (edge of the app) and server code. No server-only imports here.

export const API_URL = process.env.API_URL ?? "http://localhost:4000";

export const ACCESS_COOKIE = "rp_access";
export const REFRESH_COOKIE = "rp_refresh";

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export const ACCESS_MAX_AGE = 15 * 60;
export const REFRESH_MAX_AGE = 30 * 24 * 60 * 60;

export type JwtClaims = { sub: string; role: string; exp: number };

/** Decodes (does NOT verify) a JWT. Only used for routing decisions; the API verifies every request. */
export function decodeJwt(token: string | undefined): JwtClaims | null {
  if (!token) return null;
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload)) as JwtClaims;
  } catch {
    return null;
  }
}

export function isExpired(claims: JwtClaims | null, skewSeconds = 30) {
  return !claims || claims.exp * 1000 < Date.now() + skewSeconds * 1000;
}

export function homeForRole(role: string | undefined) {
  if (role === "SUPER_ADMIN") return "/admin";
  if (role === "LANDLORD_OWNER" || role === "LANDLORD_STAFF") return "/landlord";
  return "/login";
}
