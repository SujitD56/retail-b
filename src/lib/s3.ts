import crypto from "node:crypto";
import { S3Client, DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/config/env.js";

export const s3 = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export function isAllowedImageContentType(contentType: string): boolean {
  return ALLOWED_CONTENT_TYPES.has(contentType);
}

export function publicUrlForKey(key: string): string {
  if (env.S3_PUBLIC_BASE_URL) return `${env.S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
  return `https://${env.S3_BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
}

/**
 * Issues a short-lived presigned PUT URL so the browser uploads the image
 * bytes directly to S3 — the API server never proxies file bodies through
 * itself. `folder` namespaces keys per domain (products/, retailers/, …).
 */
export async function createPresignedUploadUrl(params: { folder: string; contentType: string; extension: string }) {
  const { folder, contentType, extension } = params;
  const key = `${folder}/${new Date().getUTCFullYear()}/${crypto.randomUUID()}.${extension}`;

  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 * 5 }); // 5 minutes
  return { uploadUrl, key, publicUrl: publicUrlForKey(key) };
}

export async function deleteObject(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET_NAME, Key: key }));
}
