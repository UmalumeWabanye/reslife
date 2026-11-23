import type { FastifyReply, FastifyRequest, preHandlerAsyncHookHandler } from "fastify";
import { prisma } from "@students/db";
import type { Role } from "@students/shared";
import { forbidden, notFound, unauthorized } from "./errors.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; role: Role };
    user: { sub: string; role: Role };
  }
}

/** Verifies the bearer access token and optionally restricts by role. */
export function requireAuth(...roles: Role[]): preHandlerAsyncHookHandler {
  return async function (request: FastifyRequest, _reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch {
      throw unauthorized();
    }
    if (roles.length && !roles.includes(request.user.role)) throw forbidden();
  };
}

export const requireStudent = requireAuth("STUDENT");
export const requireLandlord = requireAuth("LANDLORD_OWNER", "LANDLORD_STAFF");
export const requireLandlordOrAdmin = requireAuth("LANDLORD_OWNER", "LANDLORD_STAFF", "SUPER_ADMIN");
export const requireSuperAdmin = requireAuth("SUPER_ADMIN");

export async function getStudentProfile(userId: string) {
  const profile = await prisma.studentProfile.findUnique({ where: { userId } });
  if (!profile) throw forbidden("Student profile missing");
  return profile;
}

/** The organisation a landlord user belongs to (one per user for now). */
export async function getLandlordOrgId(userId: string): Promise<string> {
  const membership = await prisma.organisationMember.findFirst({
    where: { userId },
    include: { organisation: { select: { status: true } } },
  });
  if (!membership) throw forbidden("Not a member of any organisation");
  if (membership.organisation.status === "SUSPENDED") throw forbidden("Organisation suspended");
  return membership.organisationId;
}

/**
 * Tenant isolation: landlords can only touch residences owned by their organisation.
 * Super admins bypass. Returns 404 (not 403) so other tenants' IDs aren't confirmed to exist.
 */
export async function assertResidenceAccess(request: FastifyRequest, residenceId: string) {
  const residence = await prisma.residence.findUnique({ where: { id: residenceId } });
  if (!residence) throw notFound("Residence");
  if (request.user.role === "SUPER_ADMIN") return residence;
  const orgId = await getLandlordOrgId(request.user.sub);
  if (residence.organisationId !== orgId) throw notFound("Residence");
  return residence;
}
