import type { FastifyInstance } from "fastify";
import { uploadRequestSchema } from "@students/shared";
import { badRequest, forbidden, parse } from "../../lib/errors.js";
import { getLandlordOrgId, requireAuth } from "../../lib/guards.js";
import { buildKey, presignUpload } from "../../lib/storage.js";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export async function uploadRoutes(app: FastifyInstance) {
  app.post("/presign", { preHandler: requireAuth() }, async (request) => {
    const input = parse(uploadRequestSchema, request.body);
    if (!ALLOWED_TYPES.includes(input.contentType)) throw badRequest("Unsupported file type");

    let ownerId = request.user.sub;
    if (input.purpose === "residence-photo") {
      if (request.user.role === "STUDENT") throw forbidden();
      ownerId = await getLandlordOrgId(request.user.sub);
    } else if (input.purpose === "application-document" && request.user.role !== "STUDENT") {
      throw forbidden();
    }

    const key = buildKey(input.purpose, ownerId, input.fileName);
    return { key, uploadUrl: await presignUpload(key, input.contentType), method: "PUT" };
  });
}
