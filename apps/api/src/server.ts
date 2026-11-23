import { buildApp } from "./app.js";
import { env } from "./env.js";
import { ensureBucket } from "./lib/storage.js";

const app = await buildApp();

if (env.NODE_ENV === "development") {
  await ensureBucket().catch((err) => app.log.warn({ err }, "Could not ensure S3 bucket; uploads will fail"));
}

try {
  await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
