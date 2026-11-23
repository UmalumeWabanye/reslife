import type { FastifyInstance } from "fastify";
import { prisma } from "@students/db";
import { studentProfileUpdateSchema } from "@students/shared";
import { parse } from "../../lib/errors.js";
import { getStudentProfile, requireStudent } from "../../lib/guards.js";

export async function meRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireStudent);

  app.patch("/profile", async (request) => {
    const { firstName, lastName, phone, ...profile } = parse(studentProfileUpdateSchema, request.body);
    const student = await getStudentProfile(request.user.sub);
    await prisma.$transaction([
      prisma.user.update({ where: { id: request.user.sub }, data: { firstName, lastName, phone } }),
      prisma.studentProfile.update({ where: { id: student.id }, data: profile }),
    ]);
    return { ok: true };
  });

  /**
   * Decides which mode the app opens in. A student is "in residence" once they've
   * accepted an offer (or a landlord added them directly) and the lease is pending or active.
   * The mobile app uses `residence` for theming (logo, colour) and the residence-space tabs.
   */
  app.get("/residency", async (request) => {
    const student = await getStudentProfile(request.user.sub);
    const lease = await prisma.lease.findFirst({
      where: {
        studentId: student.id,
        status: { in: ["PENDING_MOVE_IN", "ACTIVE"] },
        OR: [{ applicationId: null }, { application: { status: "ACCEPTED_BY_STUDENT" } }],
      },
      orderBy: { startDate: "desc" },
      include: {
        bed: {
          include: {
            room: {
              include: {
                roomType: {
                  include: {
                    residence: {
                      select: {
                        id: true,
                        name: true,
                        slug: true,
                        logoUrl: true,
                        primaryColour: true,
                        addressLine: true,
                        city: true,
                        organisation: { select: { name: true, contactEmail: true, contactPhone: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!lease) return { mode: "discover" as const };

    const { roomType } = lease.bed.room;
    return {
      mode: "residence" as const,
      residence: roomType.residence,
      lease: {
        id: lease.id,
        status: lease.status,
        startDate: lease.startDate,
        endDate: lease.endDate,
        monthlyRentCents: lease.monthlyRentCents,
        fundedBy: lease.fundedBy,
        room: lease.bed.room.label,
        bed: lease.bed.label,
        roomType: roomType.name,
      },
    };
  });
}
