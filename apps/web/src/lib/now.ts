import "server-only";
import { connection } from "next/server";

/**
 * The current time for a request-time server render (e.g. "3h ago" labels).
 * `connection()` marks the page as rendered per request, so reading the clock is safe.
 */
export async function requestTime(): Promise<number> {
  await connection();
  return Date.now();
}
