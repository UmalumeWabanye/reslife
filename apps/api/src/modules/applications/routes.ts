import type { FastifyInstance } from "fastify";
import { prisma, type ApplicationStatus } from "@students/db";
import { applicationCreateSchema, applicationDocumentSchema } from "@students/shared";
import { z } from "zod";
import { audit } from "../../lib/audit.js";
import { badRequest, conflict, notFound, parse } from "../../lib/errors.js";
import { getStudentProfile, requireStudent } from "../../lib/guards.js";
import { keyBelongsTo } from "../../lib/storage.js";

const EDITABLE: ApplicationStatus[] = ["DRAFT", "SUBMITTED"];
const WITHDRAWABLE: ApplicationStatus[] = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "WAITLISTED"];

async function getOwnApplication(userId: string, id: string) {
  const student = await getStudentProfile(userId);
  const app = await prisma.application.findFirst({ where: { id, studentId: student.id } });
  if (!app) throw notFound("Application");
  return { student, application: app };
}

/** Student-side application flow. */
export async function applicationRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireStudent);

  app.get("/", async (request) => {
    const student = await getStudentProfile(request.user.sub);
    return prisma.application.findMany({
      where: { studentId: student.id },
      orderBy: { updatedAt: "desc" },
      include: {
        residence: { select: { id: true, name: true, slug: true, photos: true, primaryColour: true } },
        roomType: { select: { id: true, name: true, monthlyRentCents: true } },
        documents: { select: { id: true, kind: true, fileName: true } },
      },
    });
  });

  app.get<{ Params: { id: string } }>("/:id", async (request) => {
    const { application } = await getOwnApplication(request.user.sub, request.params.id);
    return prisma.application.findUniqueOrThrow({
      where: { id: application.id },
      include: {
        residence: { select: { id: true, name: true, slug: true, photos: true, primaryColour: true } },
        roomType: true,
        documents: true,
        lease: { include: { bed: { include: { room: { select: { label: true } } } } } },
      },
    });
  });

  app.post("/", async (request, reply) => {
    const input = parse(applicationCreateSchema, request.body);
    const student = await getStudentProfile(request.user.sub);

    const roomType = await prisma.roomType.findFirst({
      where: {
        id: input.roomTypeId,
        residenceId: input.residenceId,
        residence: {
          isPublished: true,
          organisation: { status: "VERIFIED" },
          institutions: { some: { institutionId: student.institutionId } },
        },
      },
    });
    if (!roomType) throw notFound("Room type");

    const duplicate = await prisma.application.findUnique({
      where: {
        studentId_residenceId_academicYear: {
          studentId: student.id,
          residenceId: input.residenceId,
          academicYear: input.academicYear,
        },
      },
    });
    if (duplicate) throw conflict("You already have an application for this residence and year", "DUPLICATE_APPLICATION");

    const created = await prisma.application.create({ data: { ...input, studentId: student.id } });
    return reply.code(201).send(created);
  });

  app.patch<{ Params: { id: string } }>("/:id", async (request) => {
    const { application } = await getOwnApplication(request.user.sub, request.params.id);
    if (application.status !== "DRAFT") throw badRequest("Only drafts can be edited");
    const input = parse(applicationCreateSchema.pick({ roomTypeId: true, fundingType: true, motivation: true }).partial(), request.body);
    if (input.roomTypeId) {
      const rt = await prisma.roomType.findFirst({ where: { id: input.roomTypeId, residenceId: application.residenceId } });
      if (!rt) throw notFound("Room type");
    }
    return prisma.application.update({ where: { id: application.id }, data: input });
  });

  app.post<{ Params: { id: string } }>("/:id/documents", async (request, reply) => {
    const { application } = await getOwnApplication(request.user.sub, request.params.id);
    if (!EDITABLE.includes(application.status)) throw badRequest("Documents can no longer be changed");
    const input = parse(applicationDocumentSchema, request.body);
    if (!keyBelongsTo(input.fileKey, "application-document", request.user.sub)) throw badRequest("Invalid file key");
    const doc = await prisma.applicationDocument.create({ data: { ...input, applicationId: application.id } });
    return reply.code(201).send(doc);
  });

  app.delete<{ Params: { id: string; docId: string } }>("/:id/documents/:docId", async (request, reply) => {
    const { application } = await getOwnApplication(request.user.sub, request.params.id);
    if (!EDITABLE.includes(application.status)) throw badRequest("Documents can no longer be changed");
    await prisma.applicationDocument.deleteMany({ where: { id: request.params.docId, applicationId: application.id } });
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>("/:id/submit", async (request) => {
    const { application } = await getOwnApplication(request.user.sub, request.params.id);
    if (application.status !== "DRAFT") throw badRequest("Application already submitted");

    const user = await prisma.user.findUniqueOrThrow({ where: { id: request.user.sub } });
    if (!user.firstName || !user.lastName) throw badRequest("Complete your profile before submitting", "PROFILE_INCOMPLETE");

    const kinds = new Set(
      (await prisma.applicationDocument.findMany({ where: { applicationId: application.id }, select: { kind: true } })).map((d) => d.kind),
    );
    const required = ["ID_DOCUMENT", "PROOF_OF_REGISTRATION"] as const;
    const missing: string[] = required.filter((k) => !kinds.has(k));
    if ((application.fundingType === "NSFAS" || application.fundingType === "BURSARY") && !kinds.has("FUNDING_LETTER")) {
      missing.push("FUNDING_LETTER");
    }
    if (missing.length) throw badRequest(`Missing documents: ${missing.join(", ")}`, "MISSING_DOCUMENTS");

    return prisma.application.update({
      where: { id: application.id },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    });
  });

  app.post<{ Params: { id: string } }>("/:id/withdraw", async (request) => {
    const { application } = await getOwnApplication(request.user.sub, request.params.id);
    if (!WITHDRAWABLE.includes(application.status)) throw badRequest("This application can't be withdrawn");
    return prisma.application.update({ where: { id: application.id }, data: { status: "WITHDRAWN" } });
  });

  /** Student accepts or declines an offer. Accepting withdraws their other open applications for that year. */
  app.post<{ Params: { id: string } }>("/:id/respond", async (request) => {
    const { accept } = parse(z.object({ accept: z.boolean() }), request.body);
    const { student, application } = await getOwnApplication(request.user.sub, request.params.id);
    if (application.status !== "ACCEPTED") throw badRequest("There is no open offer on this application");

    return prisma.$transaction(async (tx) => {
      if (!accept) {
        await tx.lease.updateMany({ where: { applicationId: application.id }, data: { status: "TERMINATED" } });
        const declined = await tx.application.update({ where: { id: application.id }, data: { status: "DECLINED_BY_STUDENT" } });
        await audit(tx, { actorId: request.user.sub, action: "application.decline_offer", entity: "Application", entityId: application.id });
        return declined;
      }

      const others = await tx.application.findMany({
        where: {
          studentId: student.id,
          academicYear: application.academicYear,
          id: { not: application.id },
          status: { in: [...WITHDRAWABLE, "ACCEPTED"] },
        },
        select: { id: true },
      });
      const otherIds = others.map((o) => o.id);
      if (otherIds.length) {
        await tx.lease.updateMany({ where: { applicationId: { in: otherIds } }, data: { status: "TERMINATED" } });
        await tx.application.updateMany({ where: { id: { in: otherIds } }, data: { status: "WITHDRAWN" } });
      }

      const accepted = await tx.application.update({ where: { id: application.id }, data: { status: "ACCEPTED_BY_STUDENT" } });
      await audit(tx, {
        actorId: request.user.sub,
        action: "application.accept_offer",
        entity: "Application",
        entityId: application.id,
        after: { withdrawn: otherIds },
      });
      return accepted;
    });
  });
}
