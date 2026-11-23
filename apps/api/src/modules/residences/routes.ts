import type { FastifyInstance } from "fastify";
import { prisma, type Prisma } from "@students/db";
import { residenceSearchSchema } from "@students/shared";
import { notFound, parse } from "../../lib/errors.js";
import { getStudentProfile, requireStudent } from "../../lib/guards.js";
import { freeBedsByRoomType } from "./availability.js";

/** Student-facing residence discovery, scoped to the student's institution. */
export async function residenceRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: requireStudent }, async (request) => {
    const q = parse(residenceSearchSchema, request.query);
    const student = await getStudentProfile(request.user.sub);

    const where: Prisma.ResidenceWhereInput = {
      isPublished: true,
      organisation: { status: "VERIFIED" },
      institutions: {
        some: {
          institutionId: student.institutionId,
          ...(q.maxDistanceKm ? { distanceKm: { lte: q.maxDistanceKm } } : {}),
        },
      },
      ...(q.type && { type: q.type }),
      ...(q.nsfasAccredited !== undefined && { nsfasAccredited: q.nsfasAccredited }),
      ...(q.bursaryFunded !== undefined && { bursaryFunded: q.bursaryFunded }),
      ...(q.genderPolicy && { genderPolicy: q.genderPolicy }),
      ...(q.maxRentCents && { roomTypes: { some: { monthlyRentCents: { lte: q.maxRentCents } } } }),
      ...(q.q && {
        OR: [
          { name: { contains: q.q, mode: "insensitive" } },
          { addressLine: { contains: q.q, mode: "insensitive" } },
        ],
      }),
    };

    const [total, rows] = await Promise.all([
      prisma.residence.count({ where }),
      prisma.residence.findMany({
        where,
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        orderBy: { name: "asc" },
        include: {
          roomTypes: { select: { id: true, monthlyRentCents: true } },
          institutions: { where: { institutionId: student.institutionId }, select: { distanceKm: true } },
        },
      }),
    ]);

    const free = await freeBedsByRoomType(rows.flatMap((r) => r.roomTypes.map((rt) => rt.id)));

    return {
      total,
      page: q.page,
      pageSize: q.pageSize,
      items: rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        type: r.type,
        genderPolicy: r.genderPolicy,
        nsfasAccredited: r.nsfasAccredited,
        bursaryFunded: r.bursaryFunded,
        city: r.city,
        addressLine: r.addressLine,
        latitude: r.latitude,
        longitude: r.longitude,
        photo: r.photos[0] ?? null,
        primaryColour: r.primaryColour,
        amenities: r.amenities,
        distanceKm: r.institutions[0]?.distanceKm ?? null,
        fromRentCents: r.roomTypes.length ? Math.min(...r.roomTypes.map((rt) => rt.monthlyRentCents)) : null,
        availableBeds: r.roomTypes.reduce((n, rt) => n + (free.get(rt.id) ?? 0), 0),
      })),
    };
  });

  app.get<{ Params: { idOrSlug: string } }>("/:idOrSlug", { preHandler: requireStudent }, async (request) => {
    const student = await getStudentProfile(request.user.sub);
    const residence = await prisma.residence.findFirst({
      where: {
        OR: [{ id: request.params.idOrSlug }, { slug: request.params.idOrSlug }],
        isPublished: true,
        organisation: { status: "VERIFIED" },
        institutions: { some: { institutionId: student.institutionId } },
      },
      include: {
        organisation: { select: { name: true, contactEmail: true, contactPhone: true } },
        roomTypes: { orderBy: { monthlyRentCents: "asc" } },
        institutions: { include: { institution: { select: { id: true, shortName: true } } } },
      },
    });
    if (!residence) throw notFound("Residence");

    const free = await freeBedsByRoomType(residence.roomTypes.map((rt) => rt.id));
    return {
      ...residence,
      roomTypes: residence.roomTypes.map((rt) => ({ ...rt, availableBeds: free.get(rt.id) ?? 0 })),
    };
  });
}
