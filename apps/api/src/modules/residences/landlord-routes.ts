import type { FastifyInstance } from "fastify";
import { prisma } from "@students/db";
import { residenceInputSchema, roomInputSchema, roomTypeInputSchema } from "@students/shared";
import { audit } from "../../lib/audit.js";
import { conflict, notFound, parse } from "../../lib/errors.js";
import { assertResidenceAccess, getLandlordOrgId, requireLandlord } from "../../lib/guards.js";
import { OCCUPYING_LEASE_STATUSES, freeBedsByRoomType } from "./availability.js";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function uniqueSlug(name: string) {
  const base = slugify(name) || "residence";
  let slug = base;
  for (let i = 2; await prisma.residence.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;
  return slug;
}

async function assertRoomTypeAccess(request: Parameters<typeof assertResidenceAccess>[0], roomTypeId: string) {
  const rt = await prisma.roomType.findUnique({ where: { id: roomTypeId } });
  if (!rt) throw notFound("Room type");
  await assertResidenceAccess(request, rt.residenceId);
  return rt;
}

/** Landlord residence management. Every route is tenant-scoped to the caller's organisation. */
export async function landlordResidenceRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireLandlord);

  app.get("/residences", async (request) => {
    const orgId = await getLandlordOrgId(request.user.sub);
    const residences = await prisma.residence.findMany({
      where: { organisationId: orgId },
      orderBy: { createdAt: "desc" },
      include: {
        roomTypes: { select: { id: true } },
        _count: { select: { applications: { where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } } } },
      },
    });
    const free = await freeBedsByRoomType(residences.flatMap((r) => r.roomTypes.map((rt) => rt.id)));
    return residences.map(({ roomTypes, _count, ...r }) => ({
      ...r,
      pendingApplications: _count.applications,
      availableBeds: roomTypes.reduce((n, rt) => n + (free.get(rt.id) ?? 0), 0),
    }));
  });

  app.get<{ Params: { id: string } }>("/residences/:id", async (request) => {
    await assertResidenceAccess(request, request.params.id);
    return prisma.residence.findUniqueOrThrow({
      where: { id: request.params.id },
      include: {
        institutions: { include: { institution: { select: { id: true, name: true, shortName: true } } } },
        roomTypes: { include: { rooms: { include: { beds: true }, orderBy: { label: "asc" } } } },
      },
    });
  });

  app.post("/residences", async (request, reply) => {
    const orgId = await getLandlordOrgId(request.user.sub);
    const { institutions, ...input } = parse(residenceInputSchema, request.body);
    const residence = await prisma.$transaction(async (tx) => {
      const r = await tx.residence.create({
        data: {
          ...input,
          organisationId: orgId,
          slug: await uniqueSlug(input.name),
          institutions: { create: institutions },
        },
      });
      await audit(tx, { actorId: request.user.sub, action: "residence.create", entity: "Residence", entityId: r.id, after: r });
      return r;
    });
    return reply.code(201).send(residence);
  });

  app.patch<{ Params: { id: string } }>("/residences/:id", async (request) => {
    const before = await assertResidenceAccess(request, request.params.id);
    const { institutions, ...input } = parse(residenceInputSchema.partial(), request.body);
    return prisma.$transaction(async (tx) => {
      if (institutions) {
        await tx.residenceInstitution.deleteMany({ where: { residenceId: before.id } });
        await tx.residenceInstitution.createMany({
          data: institutions.map((i) => ({ ...i, residenceId: before.id })),
        });
      }
      const after = await tx.residence.update({ where: { id: before.id }, data: input });
      await audit(tx, { actorId: request.user.sub, action: "residence.update", entity: "Residence", entityId: before.id, before, after });
      return after;
    });
  });

  // ─── Room types ───

  app.post<{ Params: { id: string } }>("/residences/:id/room-types", async (request, reply) => {
    await assertResidenceAccess(request, request.params.id);
    const input = parse(roomTypeInputSchema, request.body);
    const rt = await prisma.roomType.create({ data: { ...input, residenceId: request.params.id } });
    return reply.code(201).send(rt);
  });

  app.patch<{ Params: { id: string } }>("/room-types/:id", async (request) => {
    await assertRoomTypeAccess(request, request.params.id);
    const input = parse(roomTypeInputSchema.partial(), request.body);
    return prisma.roomType.update({ where: { id: request.params.id }, data: input });
  });

  // ─── Rooms & beds ───

  app.post<{ Params: { id: string } }>("/room-types/:id/rooms", async (request, reply) => {
    await assertRoomTypeAccess(request, request.params.id);
    const input = parse(roomInputSchema, request.body);
    const exists = await prisma.room.findUnique({
      where: { roomTypeId_label: { roomTypeId: request.params.id, label: input.label } },
    });
    if (exists) throw conflict(`Room ${input.label} already exists`);
    const room = await prisma.room.create({
      data: {
        roomTypeId: request.params.id,
        label: input.label,
        beds: { create: [...new Set(input.bedLabels)].map((label) => ({ label })) },
      },
      include: { beds: true },
    });
    return reply.code(201).send(room);
  });

  /** Beds with their current occupant, for allocation when accepting applications. */
  app.get<{ Params: { id: string }; Querystring: { roomTypeId?: string; available?: string } }>(
    "/residences/:id/beds",
    async (request) => {
      await assertResidenceAccess(request, request.params.id);
      const beds = await prisma.bed.findMany({
        where: {
          room: {
            roomType: {
              residenceId: request.params.id,
              ...(request.query.roomTypeId && { id: request.query.roomTypeId }),
            },
          },
        },
        orderBy: [{ room: { label: "asc" } }, { label: "asc" }],
        include: {
          room: { select: { label: true, roomType: { select: { id: true, name: true } } } },
          leases: {
            where: { status: { in: [...OCCUPYING_LEASE_STATUSES] } },
            select: {
              id: true,
              startDate: true,
              endDate: true,
              status: true,
              student: { select: { studentNumber: true, user: { select: { firstName: true, lastName: true } } } },
            },
          },
        },
      });
      const out = beds.map(({ leases, ...b }) => ({ ...b, occupant: leases[0] ?? null }));
      return request.query.available === "true" ? out.filter((b) => !b.occupant) : out;
    },
  );
}
