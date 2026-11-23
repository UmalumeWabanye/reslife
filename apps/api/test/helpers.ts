import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { prisma } from "@students/db";
import { vi } from "vitest";
import { buildApp } from "../src/app.js";
import { mailer, type Mail } from "../src/lib/mailer.js";

export const sentMail: Mail[] = [];
vi.spyOn(mailer, "send").mockImplementation(async (m) => {
  sentMail.push(m);
});

export async function makeApp(): Promise<FastifyInstance> {
  const app = await buildApp({ logger: false });
  await app.ready();
  return app;
}

export const uid = () => randomUUID().slice(0, 8);

export function lastOtpFor(email: string): string {
  const mail = [...sentMail].reverse().find((m) => m.to === email);
  const code = mail?.subject.match(/(\d{6})/)?.[1];
  if (!code) throw new Error(`No OTP sent to ${email}`);
  return code;
}

export async function createInstitution() {
  const s = uid();
  return prisma.institution.create({
    data: { name: `Test Uni ${s}`, shortName: `TU${s}`, emailDomains: [`tu${s}.ac.za`], city: "Test City" },
  });
}

export async function createLandlord(opts: { verified?: boolean } = {}) {
  const s = uid();
  const user = await prisma.user.create({
    data: { email: `landlord-${s}@test.local`, role: "LANDLORD_OWNER", passwordHash: await bcrypt.hash("Password123!", 4) },
  });
  const org = await prisma.organisation.create({
    data: {
      name: `Org ${s}`,
      contactEmail: user.email,
      status: opts.verified === false ? "PENDING" : "VERIFIED",
      members: { create: { userId: user.id } },
    },
  });
  return { user, org };
}

/** A published residence with one room type, one room and `beds` beds. */
export async function createResidence(orgId: string, institutionId: string, opts: { beds?: number; published?: boolean } = {}) {
  const s = uid();
  return prisma.residence.create({
    data: {
      organisationId: orgId,
      name: `Res ${s}`,
      slug: `res-${s}`,
      description: "A test residence near campus.",
      type: "PRIVATE",
      addressLine: "1 Test St",
      city: "Test City",
      latitude: 0,
      longitude: 0,
      isPublished: opts.published ?? true,
      institutions: { create: { institutionId, distanceKm: 1 } },
      roomTypes: {
        create: {
          name: "Single",
          monthlyRentCents: 500000,
          rooms: {
            create: {
              label: "R1",
              beds: { create: Array.from({ length: opts.beds ?? 1 }, (_, i) => ({ label: String.fromCharCode(65 + i) })) },
            },
          },
        },
      },
    },
    include: { roomTypes: { include: { rooms: { include: { beds: true } } } } },
  });
}

export async function loginPassword(app: FastifyInstance, email: string) {
  const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password: "Password123!" } });
  if (res.statusCode !== 200) throw new Error(`login failed: ${res.body}`);
  return res.json().accessToken as string;
}

/** Runs the full OTP flow and returns tokens for a new student. */
export async function loginStudent(app: FastifyInstance, institution: { id: string; emailDomains: string[] }) {
  const s = uid();
  const identity = { institutionId: institution.id, studentNumber: `STU${s}`.toUpperCase(), email: `student${s}@${institution.emailDomains[0]}` };
  const req = await app.inject({ method: "POST", url: "/auth/student/otp/request", payload: identity });
  if (req.statusCode !== 202) throw new Error(`otp request failed: ${req.body}`);
  const res = await app.inject({
    method: "POST",
    url: "/auth/student/otp/verify",
    payload: { ...identity, code: lastOtpFor(identity.email) },
  });
  if (res.statusCode !== 200) throw new Error(`otp verify failed: ${res.body}`);
  const { accessToken, refreshToken } = res.json();
  await app.inject({
    method: "PATCH",
    url: "/me/profile",
    headers: auth(accessToken),
    payload: { firstName: "Test", lastName: "Student", fundingType: "SELF" },
  });
  return { ...identity, accessToken: accessToken as string, refreshToken: refreshToken as string };
}

export const auth = (token: string) => ({ authorization: `Bearer ${token}` });
