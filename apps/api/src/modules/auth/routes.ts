import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { prisma } from "@students/db";
import {
  landlordSignupSchema,
  passwordLoginSchema,
  refreshSchema,
  studentOtpRequestSchema,
  studentOtpVerifySchema,
  type StudentOtpRequest,
} from "@students/shared";
import { env } from "../../env.js";
import { audit } from "../../lib/audit.js";
import { generateOtp, hmac, safeEqualHex } from "../../lib/crypto.js";
import { badRequest, conflict, parse, unauthorized } from "../../lib/errors.js";
import { requireAuth } from "../../lib/guards.js";
import { mailer } from "../../lib/mailer.js";
import { issueSession, revokeSession, rotateSession } from "./tokens.js";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

const otpRateLimit = { rateLimit: { max: 5, timeWindow: "15 minutes" } };

/**
 * Checks the student identity claim is consistent:
 * - email domain belongs to the chosen institution
 * - the email and the (institution, studentNumber) pair aren't bound to someone else
 */
async function validateStudentClaim(input: StudentOtpRequest) {
  const institution = await prisma.institution.findUnique({ where: { id: input.institutionId } });
  if (!institution) throw badRequest("Unknown institution", "UNKNOWN_INSTITUTION");

  const domain = input.email.split("@")[1];
  if (!institution.emailDomains.includes(domain)) {
    throw badRequest(
      `Use your ${institution.shortName} student email (${institution.emailDomains.map((d) => "@" + d).join(", ")})`,
      "EMAIL_DOMAIN_MISMATCH",
    );
  }

  const existingUser = await prisma.user.findUnique({ where: { email: input.email }, include: { studentProfile: true } });
  if (existingUser) {
    const p = existingUser.studentProfile;
    if (existingUser.role !== "STUDENT" || !p || p.institutionId !== input.institutionId || p.studentNumber !== input.studentNumber) {
      throw conflict("This email is already linked to a different student number", "IDENTITY_MISMATCH");
    }
  }

  const existingProfile = await prisma.studentProfile.findUnique({
    where: { institutionId_studentNumber: { institutionId: input.institutionId, studentNumber: input.studentNumber } },
    include: { user: true },
  });
  if (existingProfile && existingProfile.user.email !== input.email) {
    throw conflict("This student number is already registered with another email", "IDENTITY_MISMATCH");
  }

  return institution;
}

export async function authRoutes(app: FastifyInstance) {
  // ─── Student: request OTP ───
  app.post("/student/otp/request", { config: otpRateLimit }, async (request, reply) => {
    const input = parse(studentOtpRequestSchema, request.body);
    await validateStudentClaim(input);

    const recent = await prisma.otpChallenge.findFirst({
      where: { email: input.email, createdAt: { gt: new Date(Date.now() - OTP_RESEND_COOLDOWN_MS) } },
    });
    if (recent) throw badRequest("Please wait a minute before requesting another code", "OTP_COOLDOWN");

    const code = generateOtp();
    await prisma.otpChallenge.create({
      data: { email: input.email, codeHash: hmac(code), expiresAt: new Date(Date.now() + OTP_TTL_MS) },
    });

    await mailer.send({
      to: input.email,
      subject: `Your verification code: ${code}`,
      text: `Your verification code is ${code}. It expires in 10 minutes. If you didn't request this, ignore this email.`,
    });
    if (env.NODE_ENV === "development") app.log.info({ email: input.email, code }, "DEV OTP");

    return reply.code(202).send({ ok: true, expiresInSeconds: OTP_TTL_MS / 1000 });
  });

  // ─── Student: verify OTP → session ───
  app.post("/student/otp/verify", { config: otpRateLimit }, async (request) => {
    const input = parse(studentOtpVerifySchema, request.body);
    await validateStudentClaim(input);

    const challenge = await prisma.otpChallenge.findFirst({
      where: { email: input.email, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!challenge || challenge.attempts >= OTP_MAX_ATTEMPTS) throw unauthorized("Code expired. Request a new one.");

    if (!safeEqualHex(challenge.codeHash, hmac(input.code))) {
      await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
      throw unauthorized("Incorrect code");
    }

    const user = await prisma.$transaction(async (tx) => {
      await tx.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
      const existing = await tx.user.findUnique({ where: { email: input.email } });
      if (existing) {
        await tx.studentProfile.update({ where: { userId: existing.id }, data: { verifiedAt: new Date() } });
        return existing;
      }
      const created = await tx.user.create({
        data: {
          email: input.email,
          role: "STUDENT",
          studentProfile: {
            create: { institutionId: input.institutionId, studentNumber: input.studentNumber, verifiedAt: new Date() },
          },
        },
      });
      await audit(tx, { actorId: created.id, action: "student.register", entity: "User", entityId: created.id, ip: request.ip });
      return created;
    });

    const session = await issueSession(app, user);
    return { ...session, isNewUser: !user.firstName };
  });

  // ─── Landlord signup (organisation starts PENDING until super admin verifies) ───
  app.post("/landlord/signup", async (request, reply) => {
    const input = parse(landlordSignupSchema, request.body);
    if (await prisma.user.findUnique({ where: { email: input.email } })) throw conflict("Email already registered");

    const user = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          role: "LANDLORD_OWNER",
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          passwordHash: await bcrypt.hash(input.password, 12),
        },
      });
      const org = await tx.organisation.create({
        data: {
          name: input.organisationName,
          registrationNumber: input.registrationNumber,
          contactEmail: input.email,
          contactPhone: input.phone,
          members: { create: { userId: user.id } },
        },
      });
      await audit(tx, { actorId: user.id, action: "organisation.signup", entity: "Organisation", entityId: org.id, ip: request.ip });
      return user;
    });

    return reply.code(201).send(await issueSession(app, user));
  });

  // ─── Password login (landlords + super admins) ───
  app.post("/login", { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } }, async (request) => {
    const input = parse(passwordLoginSchema, request.body);
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    // Always run bcrypt so response time doesn't reveal whether the email exists.
    const ok = await bcrypt.compare(input.password, user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
    if (!user || !user.passwordHash || !ok || !user.isActive) throw unauthorized("Invalid email or password");
    return issueSession(app, user);
  });

  app.post("/refresh", async (request) => {
    const { refreshToken } = parse(refreshSchema, request.body);
    return rotateSession(app, refreshToken);
  });

  app.post("/logout", async (request, reply) => {
    const { refreshToken } = parse(refreshSchema, request.body);
    await revokeSession(refreshToken);
    return reply.code(204).send();
  });

  app.get("/me", { preHandler: requireAuth() }, async (request) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: request.user.sub },
      select: {
        id: true,
        role: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        studentProfile: { include: { institution: { select: { id: true, name: true, shortName: true } } } },
        memberships: { select: { organisation: { select: { id: true, name: true, status: true } } } },
      },
    });
    return user;
  });
}
