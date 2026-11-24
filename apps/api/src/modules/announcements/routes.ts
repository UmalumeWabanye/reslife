import type { FastifyInstance } from "fastify";
import { prisma } from "@students/db";
import { announcementInputSchema, announcementUpdateSchema } from "@students/shared";
import { z } from "zod";
import { audit } from "../../lib/audit.js";
import { notFound, parse } from "../../lib/errors.js";
import { assertResidenceAccess, getLandlordOrgId, requireLandlord, requireStudent } from "../../lib/guards.js";
import { emailUsers, notifyUsers } from "../../lib/notify.js";
import { requireResidency, residentsOf } from "../../lib/residency.js";

/** Student side: news for the residence they live in. */
export async function residenceAnnouncementRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireStudent);

  app.get("/announcements", async (request) => {
    const { residenceId } = await requireResidency(request.user.sub);
    const items = await prisma.announcement.findMany({
      where: { residenceId },
      orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
      take: 50,
      include: {
        author: { select: { firstName: true, lastName: true } },
        reads: { where: { userId: request.user.sub }, select: { readAt: true } },
      },
    });
    return items.map(({ reads, ...a }) => ({ ...a, read: reads.length > 0 }));
  });

  app.post<{ Params: { id: string } }>("/announcements/:id/read", async (request) => {
    const { residenceId } = await requireResidency(request.user.sub);
    const a = await prisma.announcement.findFirst({ where: { id: request.params.id, residenceId } });
    if (!a) throw notFound("Announcement");
    await prisma.announcementRead.upsert({
      where: { announcementId_userId: { announcementId: a.id, userId: request.user.sub } },
      update: {},
      create: { announcementId: a.id, userId: request.user.sub },
    });
    return { ok: true };
  });
}

/** Landlord side: post and manage announcements. */
export async function landlordAnnouncementRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireLandlord);

  app.get("/announcements", async (request) => {
    const { residenceId } = parse(z.object({ residenceId: z.string().optional() }), request.query);
    const orgId = await getLandlordOrgId(request.user.sub);
    const items = await prisma.announcement.findMany({
      where: { residence: { organisationId: orgId }, ...(residenceId && { residenceId }) },
      orderBy: [{ publishedAt: "desc" }],
      take: 100,
      include: {
        residence: { select: { id: true, name: true } },
        author: { select: { firstName: true, lastName: true } },
        _count: { select: { reads: true } },
      },
    });
    // Audience = current residents of each residence involved.
    const residenceIds = [...new Set(items.map((i) => i.residenceId))];
    const audience = new Map<string, number>();
    await Promise.all(residenceIds.map(async (id) => audience.set(id, await prisma.lease.count({ where: residentsOf(id) }))));
    return items.map(({ _count, ...a }) => ({ ...a, readCount: _count.reads, audience: audience.get(a.residenceId) ?? 0 }));
  });

  app.post("/announcements", async (request, reply) => {
    const input = parse(announcementInputSchema, request.body);
    const residence = await assertResidenceAccess(request, input.residenceId);

    const residents = await prisma.lease.findMany({
      where: residentsOf(residence.id),
      select: { student: { select: { user: { select: { id: true, email: true } } } } },
    });
    const users = residents.map((r) => r.student.user);

    const announcement = await prisma.$transaction(async (tx) => {
      const a = await tx.announcement.create({
        data: {
          residenceId: residence.id,
          authorId: request.user.sub,
          title: input.title,
          body: input.body,
          pinned: input.pinned,
          emailed: input.sendEmail,
        },
      });
      await audit(tx, { actorId: request.user.sub, action: "announcement.create", entity: "Announcement", entityId: a.id });
      return a;
    });

    await notifyUsers(
      users.map((u) => u.id),
      { title: `${residence.name}: ${input.title}`, body: input.body.slice(0, 140), data: { type: "announcement", id: announcement.id } },
    );

    // Email after responding so a slow mail server doesn't hold up the dashboard.
    if (input.sendEmail && users.length) {
      setImmediate(() => {
        emailUsers(
          users,
          { subject: `${residence.name}: ${input.title}`, text: `${input.body}\n\n— ${residence.name}` },
          request.log,
        ).catch(() => {});
      });
    }

    return reply.code(201).send({ ...announcement, recipients: users.length });
  });

  app.patch<{ Params: { id: string } }>("/announcements/:id", async (request) => {
    const existing = await prisma.announcement.findUnique({ where: { id: request.params.id } });
    if (!existing) throw notFound("Announcement");
    await assertResidenceAccess(request, existing.residenceId);
    const input = parse(announcementUpdateSchema, request.body);
    return prisma.announcement.update({ where: { id: existing.id }, data: input });
  });

  app.delete<{ Params: { id: string } }>("/announcements/:id", async (request, reply) => {
    const existing = await prisma.announcement.findUnique({ where: { id: request.params.id } });
    if (!existing) throw notFound("Announcement");
    await assertResidenceAccess(request, existing.residenceId);
    await prisma.$transaction(async (tx) => {
      await tx.announcement.delete({ where: { id: existing.id } });
      await audit(tx, { actorId: request.user.sub, action: "announcement.delete", entity: "Announcement", entityId: existing.id, before: existing });
    });
    return reply.code(204).send();
  });
}
