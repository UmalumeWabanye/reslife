import type { ZodTypeAny, z } from "zod";

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, code?: string) => new HttpError(400, msg, code);
export const unauthorized = (msg = "Unauthorized") => new HttpError(401, msg, "UNAUTHORIZED");
export const forbidden = (msg = "Forbidden") => new HttpError(403, msg, "FORBIDDEN");
export const notFound = (what = "Resource") => new HttpError(404, `${what} not found`, "NOT_FOUND");
export const conflict = (msg: string, code?: string) => new HttpError(409, msg, code ?? "CONFLICT");

/** Parse with zod; ZodErrors are turned into 400s by the global error handler. */
export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  return schema.parse(data);
}
