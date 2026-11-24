import type { FastifyInstance, FastifyRequest } from "fastify";
import { prisma, type Prisma } from "@students/db";
import { leaseEndSchema, leaseListQuerySchema } from "@students/shared";
import { audit } from "../../lib/audit.js";
import { badRequest, notFound, parse } from "../../lib/errors.js";
import { assertResidenceAccess, getLandlordOrgId, requireLandlord } from "../../lib/guards.js";
import { notifyUsers } from "../../lib/notify.js";
import { residentLeaseWhere } from "../../lib/residency.js";

async function getScopedLease(request: FastifyRequest, id: string) {
  const lease = await prisma.lease.findUnique({
    where: { id },
    include: {
      application: { select: { status: true } },
      student: { select: { userId: true } },
      bed: { select: { room: { select: { roomType: { select: { residenceId: true } } } } } },
    },
  });
  if (!lease) throw notFound("Lease");
  const residence = await assertResidenceAccess(request, lease.bed.room.roomType.residenceId);
  return { lease, residence };
}

/** Landlord: residents (leases), move-in and ending leases. */
export async function landlordLeaseRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireLandlord);

  app.get("/leases", async (request) => {
    const q = parse(leaseListQuerySchema, request.query);
    const orgId = await getLandlordOrgId(request.user.sub);

    // Default view: current residents. Offers the student hasn't accepted yet aren't residents.
    const statusWhere: Prisma.LeaseWhereInput = q.status
      ? { status: q.status, ...(q.status === "PENDING_MOVE_IN" ? { OR: residentLeaseWhere.OR } : {}) }
      : residentLeaseWhere;

    return prisma.lease.findMany({
      where: {
        ...statusWhere,
        bed: { room: { roomType: { residence: { organisationId: orgId }, ...(q.residenceId && { residenceId: q.residenceId }) } } },
      },
      orderBy: [{ status: "asc" }, { startDate: "asc" }],
      include: {
        bed: {
          select: {
            label: true,
            room: { select: { label: true, roomType: { select: { name: true, residence: { select: { id: true, name: true } } } } } },
          },
        },
        student: {
          select: {
            studentNumber: true,
            institution: { select: { shortName: true } },
            user: { select: { firstName: true, lastName: true, email: true, phone: true } },
          },
        },
        _count: { select: { maintenance: { where: { status: { notIn: ["RESOLVED", "CLOSED"] } } } } },
      },
    });
  });

  app.post<{ Params: { id: string } }>("/leases/:id/move-in", async (request) => {
    const { lease, residence } = await getScopedLease(request, request.params.id);
    if (lease.status !== "PENDING_MOVE_IN") throw badRequest("Only pending leases can be moved in");
    if (lease.application && lease.application.status !== "ACCEPTED_BY_STUDENT") {
      throw badRequest("The student hasn't accepted this offer yet", "OFFER_NOT_ACCEPTED");
    }
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.lease.update({ where: { id: lease.id }, data: { status: "ACTIVE", movedInAt: new Date() } });
      await audit(tx, { actorId: request.user.sub, action: "lease.move_in", entity: "Lease", entityId: lease.id });
      return u;
    });
    await notifyUsers([lease.student.userId], {
      title: `Welcome home to ${residence.name}`,
      body: "You're checked in. You can now log maintenance requests in the app.",
      data: { type: "lease", id: lease.id },
    });
    return updated;
  });

  app.post<{ Params: { id: string } }>("/leases/:id/end", async (request) => {
    const { lease } = await getScopedLease(request, request.params.id);
    if (lease.status !== "ACTIVE" && lease.status !== "PENDING_MOVE_IN") throw badRequest("This lease has already ended");
    const input = parse(leaseEndSchema, request.body ?? {});
    return prisma.$transaction(async (tx) => {
      const u = await tx.lease.update({
        where: { id: lease.id },
        data: { status: input.reason, movedOutAt: lease.status === "ACTIVE" ? new Date() : null },
      });
      await audit(tx, {
        actorId: request.user.sub,
        action: `lease.${input.reason.toLowerCase()}`,
        entity: "Lease",
        entityId: lease.id,
        after: { note: input.note },
      });
      return u;
    });
  });
}
