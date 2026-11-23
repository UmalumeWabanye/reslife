import { randomUUID } from "node:crypto";
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../env.js";

const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: true, // required for MinIO/RustFS
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
  // Otherwise presigned PUTs embed a CRC32 of an empty body and every real upload is rejected.
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

/**
 * Dev convenience: create the bucket in local S3 if missing, and allow browser uploads
 * (Expo web, dashboard) from the dev origins. Production buckets are configured in infra.
 */
export async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
  }
  await s3.send(
    new PutBucketCorsCommand({
      Bucket: env.S3_BUCKET,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: env.CORS_ORIGINS.split(","),
            AllowedMethods: ["GET", "PUT"],
            AllowedHeaders: ["*"],
            MaxAgeSeconds: 3000,
          },
        ],
      },
    }),
  );
}

/** Object keys are namespaced by purpose and owner so ownership can be checked from the key. */
export function buildKey(purpose: string, ownerId: string, fileName: string) {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  return `${purpose}/${ownerId}/${randomUUID()}-${safe}`;
}

export function keyBelongsTo(key: string, purpose: string, ownerId: string) {
  return key.startsWith(`${purpose}/${ownerId}/`) && !key.includes("..");
}

export async function presignUpload(key: string, contentType: string) {
  return getSignedUrl(s3, new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, ContentType: contentType }), {
    expiresIn: 300,
  });
}

export async function presignDownload(key: string) {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), { expiresIn: 300 });
}
