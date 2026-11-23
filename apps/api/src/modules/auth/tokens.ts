import type { FastifyInstance } from "fastify";
import { prisma, type User } from "@students/db";
import { generateOpaqueToken, hmac } from "../../lib/crypto.js";
import { unauthorized } from "../../lib/errors.js";

const ACCESS_TTL = "15m";
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function issueSession(app: FastifyInstance, user: Pick<User, "id" | "role">) {
  const accessToken = app.jwt.sign({ sub: user.id, role: user.role }, { expiresIn: ACCESS_TTL });
  const refreshToken = generateOpaqueToken();
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: hmac(refreshToken), expiresAt: new Date(Date.now() + REFRESH_TTL_MS) },
  });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return { accessToken, refreshToken };
}

/** Rotates the refresh token: the old one is revoked, a new pair is issued. */
export async function rotateSession(app: FastifyInstance, refreshToken: string) {
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hmac(refreshToken) },
    include: { user: true },
  });
  if (!record || record.expiresAt < new Date() || !record.user.isActive) throw unauthorized("Invalid refresh token");

  if (record.revokedAt) {
    // Reuse of a rotated token: likely theft. Revoke every session for this user.
    await prisma.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    throw unauthorized("Invalid refresh token");
  }

  await prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
  return issueSession(app, record.user);
}

export async function revokeSession(refreshToken: string) {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hmac(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
