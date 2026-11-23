import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(8),
  JWT_REFRESH_SECRET: z.string().min(8),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().default(1025),
  // Optional: set to send real email (e.g. Gmail: smtp.gmail.com, port 465, an App Password).
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default("Res Platform <no-reply@resplatform.local>"),
  S3_ENDPOINT: z.string().default("http://localhost:9000"),
  // Local RustFS only accepts us-east-1; set af-south-1 (Cape Town) for production AWS.
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().default("students"),
  S3_ACCESS_KEY: z.string().default("minio"),
  S3_SECRET_KEY: z.string().default("minio12345"),
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:8081"),
});

export const env = envSchema.parse(process.env);
export type Env = typeof env;
