import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * API base URL. iOS simulator and web can use localhost; Android emulator needs 10.0.2.2;
 * a physical device needs your machine's LAN IP (set EXPO_PUBLIC_API_URL in apps/mobile/.env).
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000');

const ACCESS_KEY = 'auth.accessToken';
const REFRESH_KEY = 'auth.refreshToken';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

// SecureStore isn't available on web; fall back to localStorage there (dev only).
const store = {
  get: (k: string) => (Platform.OS === 'web' ? Promise.resolve(localStorage.getItem(k)) : SecureStore.getItemAsync(k)),
  set: (k: string, v: string) =>
    Platform.OS === 'web' ? Promise.resolve(localStorage.setItem(k, v)) : SecureStore.setItemAsync(k, v),
  del: (k: string) => (Platform.OS === 'web' ? Promise.resolve(localStorage.removeItem(k)) : SecureStore.deleteItemAsync(k)),
};

let tokens: Tokens | null = null;
let onSignedOut: (() => void) | null = null;

export const tokenStore = {
  async load(): Promise<Tokens | null> {
    const [accessToken, refreshToken] = await Promise.all([store.get(ACCESS_KEY), store.get(REFRESH_KEY)]);
    tokens = accessToken && refreshToken ? { accessToken, refreshToken } : null;
    return tokens;
  },
  async save(next: Tokens) {
    tokens = next;
    await Promise.all([store.set(ACCESS_KEY, next.accessToken), store.set(REFRESH_KEY, next.refreshToken)]);
  },
  async clear() {
    tokens = null;
    await Promise.all([store.del(ACCESS_KEY), store.del(REFRESH_KEY)]);
  },
  get current() {
    return tokens;
  },
  /** Called when a refresh fails, so the session provider can drop to the sign-in screen. */
  onSignedOut(cb: () => void) {
    onSignedOut = cb;
  },
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

// One in-flight refresh shared by concurrent 401s, so a rotated token is never reused.
let refreshing: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  if (!tokens) return false;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens!.refreshToken }),
      });
      if (!res.ok) return false;
      await tokenStore.save(await res.json());
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

async function request<T>(method: Method, path: string, body?: unknown, retry = true): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (tokens) headers.authorization = `Bearer ${tokens.accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection.");
  }

  if (res.status === 401 && retry && tokens && !path.startsWith('/auth/')) {
    if (await refreshTokens()) return request<T>(method, path, body, false);
    await tokenStore.clear();
    onSignedOut?.();
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Something went wrong', data.code);
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}
