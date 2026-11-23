import type { FastifyInstance } from "fastify";
import { prisma } from "@students/db";

/** Public: used by the student onboarding picker and landlord residence forms. */
export async function institutionRoutes(app: FastifyInstance) {
  app.get("/", async () =>
    prisma.institution.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, shortName: true, city: true, emailDomains: true },
    }),
  );
}
