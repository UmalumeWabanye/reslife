import type { FastifyInstance, FastifyRequest } from "fastify";
import { prisma, type Prisma } from "@students/db";
import {
  MAINTENANCE_TRANSITIONS,
  maintenanceCommentSchema,
  maintenanceCreateSchema,
  maintenanceListQuerySchema,
  maintenanceUpdateSchema,
  type MaintenanceStatus,
} from "@students/shared";
import { audit } from "../../lib/audit.js";
import { badRequest, notFound, parse } from "../../lib/errors.js";
import { assertResidenceAccess, getLandlordOrgId, requireLandlord, requireStudent } from "../../lib/guards.js";
import { notifyUsers } from "../../lib/notify.js";
import { requireResidency } from "../../lib/residency.js";
import { keyBelongsTo, presignDownload } from "../../lib/storage.js";

const statusLabel: Record<MaintenanceStatus, string> = {
  OPEN: "Open",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

const detailInclude = {
  residence: { select: { id: true, name: true } },
  reporter: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
  assignee: { select: { id: true, firstName: true, lastName: true } },
  lease: { select: { bed: { select: { label: true, room: { select: { label: true } } } } } },
  comments: {
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, firstName: true, lastName: true, role: true } } },
  },
} satisfies Prisma.MaintenanceRequestInclude;

async function withPhotoUrls<T extends { photos: string[] }>(r: T) {
  return { ...r, photoUrls: await Promise.all(r.photos.map((k) => presignDownload(k))) };
}

const fullName = (u: { firstName: string | null; lastName: string | null }) =>
  [u.firstName, u.lastName].filter(Boolean).join(" ") || "Someone";

// ─── Student ───

export async function residenceMaintenanceRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireStudent);

  async function getOwn(request: FastifyRequest, id: string) {
    const r = await prisma.maintenanceRequest.findFirst({ where: { id, reporterId: request.user.sub } });
    if (!r) throw notFound("Request");
    return r;
  }

  app.get("/maintenance", async (request) => {
    const { residenceId } = await requireResidency(request.user.sub);
    return prisma.maintenanceRequest.findMany({
      where: { reporterId: request.user.sub, residenceId },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { comments: { where: { isSystem: false } } } } },
    });
  });

  app.post("/maintenance", async (request, reply) => {
    const { lease, residenceId } = await requireResidency(request.user.sub);
    if (lease.status !== "ACTIVE") {
      throw badRequest("You can log maintenance requests once you've moved in", "NOT_MOVED_IN");
    }
    const input = parse(maintenanceCreateSchema, request.body);
    if (input.photoKeys.some((k) => !keyBelongsTo(k, "maintenance-photo", request.user.sub))) {
      throw badRequest("Invalid photo");
    }
    const created = await prisma.maintenanceRequest.create({
      data: {
        residenceId,
        leaseId: lease.id,
        reporterId: request.user.sub,
        category: input.category,
        title: input.title,
        description: input.description,
        location: input.location || `Room ${lease.bed.room.label}`,
        priority: input.priority,
        photos: input.photoKeys,
      },
    });
    return reply.code(201).send(created);
  });

  app.get<{ Params: { id: string } }>("/maintenance/:id", async (request) => {
    const own = await getOwn(request, request.params.id);
    const r = await prisma.maintenanceRequest.findUniqueOrThrow({ where: { id: own.id }, include: detailInclude });
    // Students don't need staff contact details.
    return withPhotoUrls({ ...r, reporter: undefined });
  });

  app.post<{ Params: { id: string } }>("/maintenance/:id/comments", async (request, reply) => {
    const r = await getOwn(request, request.params.id);
    if (r.status === "CLOSED") throw badRequest("This request is closed");
    const { body } = parse(maintenanceCommentSchema, request.body);
    const comment = await prisma.$transaction(async (tx) => {
      const c = await tx.maintenanceComment.create({ data: { requestId: r.id, authorId: request.user.sub, body } });
      await tx.maintenanceRequest.update({ where: { id: r.id }, data: { updatedAt: new Date() } });
      return c;
    });
    return reply.code(201).send(comment);
  });

  /** Student confirms the fix (RESOLVED → CLOSED) or says it isn't fixed (RESOLVED → IN_PROGRESS). */
  app.post<{ Params: { id: string }; Body: { fixed?: boolean } }>("/maintenance/:id/confirm", async (request) => {
    const r = await getOwn(request, request.params.id);
    if (r.status !== "RESOLVED") throw badRequest("Only resolved requests can be confirmed");
    const fixed = request.body?.fixed !== false;
    const status: MaintenanceStatus = fixed ? "CLOSED" : "IN_PROGRESS";
    return prisma.$transaction(async (tx) => {
      await tx.maintenanceComment.create({
        data: {
          requestId: r.id,
          authorId: request.user.sub,
          isSystem: true,
          body: fixed ? "Student confirmed it's fixed. Closed." : "Student says it isn't fixed yet. Reopened.",
        },
      });
      return tx.maintenanceRequest.update({ where: { id: r.id }, data: { status, ...(fixed ? {} : { resolvedAt: null }) } });
    });
  });
}

// ─── Landlord ───

export async function landlordMaintenanceRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireLandlord);

  async function getScoped(request: FastifyRequest, id: string) {
    const r = await prisma.maintenanceRequest.findUnique({ where: { id } });
    if (!r) throw notFound("Request");
    await assertResidenceAccess(request, r.residenceId);
    return r;
  }

  app.get("/maintenance", async (request) => {
    const q = parse(maintenanceListQuerySchema, request.query);
    const orgId = await getLandlordOrgId(request.user.sub);
    return prisma.maintenanceRequest.findMany({
      where: {
        residence: { organisationId: orgId },
        ...(q.residenceId && { residenceId: q.residenceId }),
        ...(q.priority && { priority: q.priority }),
        ...(q.status ? { status: q.status } : q.view === "open" ? { status: { notIn: ["RESOLVED", "CLOSED"] } } : {}),
      },
      // Most urgent first, then oldest first so nothing waits forever.
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      include: {
        residence: { select: { id: true, name: true } },
        reporter: { select: { firstName: true, lastName: true } },
        assignee: { select: { firstName: true, lastName: true } },
        lease: { select: { bed: { select: { label: true, room: { select: { label: true } } } } } },
        _count: { select: { comments: { where: { isSystem: false } } } },
      },
    });
  });

  app.get<{ Params: { id: string } }>("/maintenance/:id", async (request) => {
    const scoped = await getScoped(request, request.params.id);
    const r = await prisma.maintenanceRequest.findUniqueOrThrow({ where: { id: scoped.id }, include: detailInclude });
    const orgId = await prisma.residence.findUniqueOrThrow({ where: { id: r.residenceId }, select: { organisationId: true } });
    const staff = await prisma.organisationMember.findMany({
      where: { organisationId: orgId.organisationId },
      select: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
    return { ...(await withPhotoUrls(r)), staff: staff.map((s) => s.user), allowedStatuses: MAINTENANCE_TRANSITIONS[r.status] };
  });

  app.patch<{ Params: { id: string } }>("/maintenance/:id", async (request) => {
    const r = await getScoped(request, request.params.id);
    const input = parse(maintenanceUpdateSchema, request.body);
    const data: Prisma.MaintenanceRequestUncheckedUpdateInput = {};
    const changes: string[] = [];

    if (input.assigneeId !== undefined && input.assigneeId !== r.assigneeId) {
      if (input.assigneeId) {
        const residence = await prisma.residence.findUniqueOrThrow({ where: { id: r.residenceId } });
        const member = await prisma.organisationMember.findFirst({
          where: { organisationId: residence.organisationId, userId: input.assigneeId },
          include: { user: true },
        });
        if (!member) throw badRequest("That person isn't on your team");
        changes.push(`Assigned to ${fullName(member.user)}`);
      } else {
        changes.push("Unassigned");
      }
      data.assigneeId = input.assigneeId;
      // Assigning an open request moves it along automatically.
      if (input.assigneeId && r.status === "OPEN" && !input.status) data.status = "ASSIGNED";
    }

    if (input.priority && input.priority !== r.priority) {
      data.priority = input.priority;
      changes.push(`Priority set to ${input.priority.toLowerCase()}`);
    }

    const nextStatus = input.status ?? (data.status as MaintenanceStatus | undefined);
    if (nextStatus && nextStatus !== r.status) {
      if (!MAINTENANCE_TRANSITIONS[r.status].includes(nextStatus)) {
        throw badRequest(`Can't move from ${statusLabel[r.status]} to ${statusLabel[nextStatus]}`, "INVALID_TRANSITION");
      }
      data.status = nextStatus;
      if (nextStatus === "RESOLVED") data.resolvedAt = new Date();
      if (nextStatus === "IN_PROGRESS" || nextStatus === "OPEN" || nextStatus === "ASSIGNED") data.resolvedAt = null;
      changes.push(`Status: ${statusLabel[nextStatus]}`);
    }

    if (!changes.length) return r;

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.maintenanceRequest.update({ where: { id: r.id }, data });
      await tx.maintenanceComment.create({
        data: { requestId: r.id, authorId: request.user.sub, isSystem: true, body: changes.join(" · ") },
      });
      await audit(tx, { actorId: request.user.sub, action: "maintenance.update", entity: "MaintenanceRequest", entityId: r.id, before: r, after: u });
      return u;
    });

    if (data.status) {
      const resolved = data.status === "RESOLVED";
      await notifyUsers([r.reporterId], {
        title: resolved ? `Fixed? "${r.title}"` : `Update on "${r.title}"`,
        body: resolved ? "Marked as resolved. Let us know if it's sorted." : `Status: ${statusLabel[data.status as MaintenanceStatus]}`,
        data: { type: "maintenance", id: r.id },
      });
    }
    return updated;
  });

  app.post<{ Params: { id: string } }>("/maintenance/:id/comments", async (request, reply) => {
    const r = await getScoped(request, request.params.id);
    const { body } = parse(maintenanceCommentSchema, request.body);
    const comment = await prisma.$transaction(async (tx) => {
      const c = await tx.maintenanceComment.create({ data: { requestId: r.id, authorId: request.user.sub, body } });
      await tx.maintenanceRequest.update({ where: { id: r.id }, data: { updatedAt: new Date() } });
      return c;
    });
    await notifyUsers([r.reporterId], {
      title: `New reply on "${r.title}"`,
      body: body.slice(0, 140),
      data: { type: "maintenance", id: r.id },
    });
    return reply.code(201).send(comment);
  });
}
