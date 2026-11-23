import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "../env.js";

export function hmac(value: string): string {
  return createHmac("sha256", env.JWT_REFRESH_SECRET).update(value).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function generateOpaqueToken(): string {
  return randomBytes(48).toString("base64url");
}
