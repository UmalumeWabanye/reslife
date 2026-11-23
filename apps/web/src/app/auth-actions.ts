"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ACCESS_COOKIE,
  ACCESS_MAX_AGE,
  API_URL,
  cookieOptions,
  decodeJwt,
  homeForRole,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE,
} from "@/lib/session-cookies";

export type LoginState = { error?: string; email?: string } | undefined;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  let tokens: { accessToken: string; refreshToken: string };
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
    if (res.status === 429) return { error: "Too many attempts. Try again in a few minutes.", email };
    if (!res.ok) return { error: "Incorrect email or password.", email };
    tokens = await res.json();
  } catch {
    return { error: "Can't reach the server. Try again shortly.", email };
  }

  const role = decodeJwt(tokens.accessToken)?.role;
  if (role === "STUDENT") return { error: "Students sign in with the ResLife mobile app.", email };

  const jar = await cookies();
  jar.set(ACCESS_COOKIE, tokens.accessToken, { ...cookieOptions, maxAge: ACCESS_MAX_AGE });
  jar.set(REFRESH_COOKIE, tokens.refreshToken, { ...cookieOptions, maxAge: REFRESH_MAX_AGE });
  redirect(homeForRole(role));
}

export async function logout() {
  const jar = await cookies();
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {});
  }
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
  redirect("/login");
}
