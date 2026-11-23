import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_COOKIE, API_URL } from "./session-cookies";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public issues?: { fieldErrors?: Record<string, string[]> },
  ) {
    super(message);
  }
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const res = await fetch(`${API_URL}${path}`, {
    method,
    cache: "no-store",
    headers: {
      ...(body !== undefined && { "content-type": "application/json" }),
      ...(token && { authorization: `Bearer ${token}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // proxy.ts refreshes tokens before rendering, so a 401 here means the session is gone.
  if (res.status === 401) redirect("/login");
  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? "Request failed", data.code, data.issues);
  return data as T;
}

/** Server-side API client: attaches the dashboard user's access token. */
export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown = {}) => request<T>("POST", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

export type ActionState = { error?: string; fieldErrors?: Record<string, string[]>; ok?: boolean } | undefined;

/** Turns API errors into form state for useActionState. Rethrows anything else (incl. redirects). */
export function toActionState(e: unknown): ActionState {
  if (e instanceof ApiError) return { error: e.message, fieldErrors: e.issues?.fieldErrors };
  throw e;
}
