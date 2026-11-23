import Fastify, { type FastifyServerOptions } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import { Prisma } from "@students/db";
import { ZodError } from "zod";
import { env } from "./env.js";
import { HttpError } from "./lib/errors.js";
import { applicationRoutes } from "./modules/applications/routes.js";
import { landlordApplicationRoutes } from "./modules/applications/landlord-routes.js";
import { authRoutes } from "./modules/auth/routes.js";
import { institutionRoutes } from "./modules/institutions/routes.js";
import { meRoutes } from "./modules/me/routes.js";
import { landlordResidenceRoutes } from "./modules/residences/landlord-routes.js";
import { residenceRoutes } from "./modules/residences/routes.js";
import { uploadRoutes } from "./modules/uploads/routes.js";

export async function buildApp(opts: FastifyServerOptions = {}) {
  const app = Fastify({ logger: env.NODE_ENV !== "test", ...opts });

  await app.register(cors, { origin: env.CORS_ORIGINS.split(","), credentials: true });
  await app.register(jwt, { secret: env.JWT_ACCESS_SECRET });
  await app.register(rateLimit, {
    global: false,
    // Integration tests issue many requests from one IP; limits are covered by config, not by tests.
    allowList: () => env.NODE_ENV === "test",
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: "Validation failed", code: "VALIDATION", issues: error.flatten() });
    }
    if (error instanceof HttpError) {
      return reply.code(error.statusCode).send({ error: error.message, code: error.code });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return reply.code(409).send({ error: "Already exists", code: "CONFLICT" });
    }
    const { statusCode: status, message } = error as { statusCode?: number; message?: string };
    if (status && status < 500) return reply.code(status).send({ error: message });
    request.log.error(error);
    return reply.code(500).send({ error: "Internal server error" });
  });

  app.get("/health", async () => ({ ok: true }));

  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(institutionRoutes, { prefix: "/institutions" });
  await app.register(meRoutes, { prefix: "/me" });
  await app.register(residenceRoutes, { prefix: "/residences" });
  await app.register(applicationRoutes, { prefix: "/applications" });
  await app.register(uploadRoutes, { prefix: "/uploads" });
  await app.register(landlordResidenceRoutes, { prefix: "/landlord" });
  await app.register(landlordApplicationRoutes, { prefix: "/landlord" });

  return app;
}
