// backend/src/lib/r2.ts
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env";

export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Generate a presigned PUT URL.
 * The client uploads directly to R2 — image never passes through our server.
 */
export async function getPresignedUploadUrl(params: {
  key: string; // e.g. "products/licenseId/uuid.jpg"
  contentType: string; // e.g. "image/jpeg"
  expiresIn?: number; // seconds, default 120
}): Promise<{ uploadUrl: string; publicUrl: string }> {
  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: params.key,
    ContentType: params.contentType,
  });

  const uploadUrl = await getSignedUrl(r2Client, command, {
    expiresIn: params.expiresIn ?? 120,
  });

  const publicUrl = `${env.R2_PUBLIC_URL}/${params.key}`;

  return { uploadUrl, publicUrl };
}
