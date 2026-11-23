import type { FastifyInstance, FastifyRequest } from "fastify";
import { prisma, type ApplicationStatus } from "@students/db";
import { applicationDecisionSchema, applicationListQuerySchema } from "@students/shared";
import { audit } from "../../lib/audit.js";
import { badRequest, conflict, notFound, parse } from "../../lib/errors.js";
import { assertResidenceAccess, getLandlordOrgId, requireLandlord } from "../../lib/guards.js";
import { presignDownload } from "../../lib/storage.js";
import { OCCUPYING_LEASE_STATUSES } from "../residences/availability.js";

const DECIDABLE: ApplicationStatus[] = ["SUBMITTED", "UNDER_REVIEW", "WAITLISTED"];

async function getScopedApplication(request: FastifyRequest, id: string) {
  const application = await prisma.application.findUnique({ where: { id } });
  // Drafts are private to the student until submitted.
  if (!application || application.status === "DRAFT") throw notFound("Application");
  await assertResidenceAccess(request, application.residenceId);
  return application;
}

/** Landlord-side application pipeline. */
export async function landlordApplicationRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireLandlord);

  app.get("/applications", async (request) => {
    const q = parse(applicationListQuerySchema, request.query);
    const orgId = await getLandlordOrgId(request.user.sub);
    return prisma.application.findMany({
      where: {
        residence: { organisationId: orgId },
        status: q.status ?? { not: "DRAFT" },
        ...(q.residenceId && { residenceId: q.residenceId }),
      },
      orderBy: { submittedAt: "desc" },
      include: {
        residence: { select: { id: true, name: true } },
        roomType: { select: { id: true, name: true } },
        student: {
          select: {
            studentNumber: true,
            fundingType: true,
            yearOfStudy: true,
            institution: { select: { shortName: true } },
            user: { select: { firstName: true, lastName: true, email: true, phone: true } },
          },
        },
        _count: { select: { documents: true } },
      },
    });
  });

  app.get<{ Params: { id: string } }>("/applications/:id", async (request) => {
    const application = await getScopedApplication(request, request.params.id);
    return prisma.application.findUniqueOrThrow({
      where: { id: application.id },
      include: {
        residence: { select: { id: true, name: true } },
        roomType: true,
        documents: { select: { id: true, kind: true, fileName: true, createdAt: true } },
        lease: { include: { bed: { include: { room: { select: { label: true } } } } } },
        student: {
          include: {
            institution: { select: { name: true, shortName: true } },
            user: { select: { firstName: true, lastName: true, email: true, phone: true } },
          },
        },
      },
    });
  });

  app.get<{ Params: { id: string; docId: string } }>("/applications/:id/documents/:docId/url", async (request) => {
    const application = await getScopedApplication(request, request.params.id);
    const doc = await prisma.applicationDocument.findFirst({
      where: { id: request.params.docId, applicationId: application.id },
    });
    if (!doc) throw notFound("Document");
    return { url: await presignDownload(doc.fileKey) };
  });

  app.post<{ Params: { id: string } }>("/applications/:id/review", async (request) => {
    const application = await getScopedApplication(request, request.params.id);
    if (application.status !== "SUBMITTED") throw badRequest("Only submitted applications can be moved to review");
    return prisma.application.update({ where: { id: application.id }, data: { status: "UNDER_REVIEW" } });
  });

  /**
   * ACCEPT allocates a bed and creates a PENDING_MOVE_IN lease (reserving the bed).
   * The student then accepts/declines the offer from the app.
   */
  app.post<{ Params: { id: string } }>("/applications/:id/decision", async (request) => {
    const application = await getScopedApplication(request, request.params.id);
    if (!DECIDABLE.includes(application.status)) throw badRequest(`Can't decide an application that is ${application.status}`);
    const input = parse(applicationDecisionSchema, request.body);

    if (input.decision !== "ACCEPT") {
      const status = input.decision === "REJECT" ? "REJECTED" : "WAITLISTED";
      return prisma.$transaction(async (tx) => {
        const updated = await tx.application.update({
          where: { id: application.id },
          data: { status, reviewNote: input.note, decidedAt: new Date() },
        });
        await audit(tx, { actorId: request.user.sub, action: `application.${status.toLowerCase()}`, entity: "Application", entityId: application.id });
        return updated;
      });
    }

    if (input.endDate <= input.startDate) throw badRequest("End date must be after start date");

    return prisma.$transaction(async (tx) => {
      // Lock the bed row so two simultaneous accepts can't double-allocate it.
      await tx.$queryRaw`SELECT id FROM "Bed" WHERE id = ${input.bedId} FOR UPDATE`;

      const bed = await tx.bed.findUnique({
        where: { id: input.bedId },
        include: { room: { include: { roomType: true } } },
      });
      if (!bed || bed.room.roomType.residenceId !== application.residenceId) throw notFound("Bed");

      const clash = await tx.lease.findFirst({
        where: {
          bedId: bed.id,
          status: { in: [...OCCUPYING_LEASE_STATUSES] },
          startDate: { lt: input.endDate },
          endDate: { gt: input.startDate },
        },
      });
      if (clash) throw conflict("That bed is already allocated for these dates", "BED_TAKEN");

      const roomType = bed.room.roomType;
      const lease = await tx.lease.create({
        data: {
          studentId: application.studentId,
          bedId: bed.id,
          applicationId: application.id,
          startDate: input.startDate,
          endDate: input.endDate,
          monthlyRentCents: roomType.monthlyRentCents,
          fundedBy: application.fundingType,
        },
      });
      const updated = await tx.application.update({
        where: { id: application.id },
        data: { status: "ACCEPTED", roomTypeId: roomType.id, reviewNote: input.note, decidedAt: new Date() },
      });
      await audit(tx, {
        actorId: request.user.sub,
        action: "application.accept",
        entity: "Application",
        entityId: application.id,
        after: { leaseId: lease.id, bedId: bed.id },
      });
      return { ...updated, lease };
    });
  });
}
