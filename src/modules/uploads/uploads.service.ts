import { prisma } from "@/lib/prisma.js";
import { createPresignedUploadUrl, deleteObject } from "@/lib/s3.js";
import { NotFoundError } from "@/lib/errors.js";
import { logger } from "@/lib/logger.js";
import type { AssetPurpose } from "@prisma/client";
import type { PresignInput } from "./uploads.schemas.js";

const FOLDER_BY_PURPOSE: Record<AssetPurpose, string> = {
  PRODUCT_IMAGE: "products",
  RETAILER_LOGO: "retailers/logos",
  RETAILER_COVER: "retailers/covers",
  RETAILER_DOCUMENT: "retailers/documents",
  EVENT_BANNER: "events/banners",
  EVENT_ENTRY: "events/entries",
  AVATAR: "avatars",
};

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

/**
 * Issues a presigned S3 PUT URL for direct-from-browser upload and records a
 * bookkeeping Asset row up front. The row is created optimistically (before
 * the browser has actually PUT the bytes) — acceptable for this scope, but a
 * production build would want a periodic sweep for Asset rows whose S3 key
 * never received an upload (e.g. via S3 event notifications or a TTL check).
 */
export async function presignUpload(userId: string, input: PresignInput) {
  const folder = FOLDER_BY_PURPOSE[input.purpose as AssetPurpose];
  const extension = EXTENSION_BY_CONTENT_TYPE[input.contentType] ?? "jpg";

  const { uploadUrl, key, publicUrl } = await createPresignedUploadUrl({ folder, contentType: input.contentType, extension });

  await prisma.asset.create({
    data: { key, url: publicUrl, purpose: input.purpose as AssetPurpose, uploadedByUserId: userId },
  });

  return { uploadUrl, publicUrl, key };
}

export async function deleteAsset(userId: string, key: string) {
  const asset = await prisma.asset.findUnique({ where: { key } });
  if (!asset) throw new NotFoundError("Asset not found");
  if (asset.uploadedByUserId && asset.uploadedByUserId !== userId) {
    // Admins can still clean up any asset via the admin module; this service
    // fn is the "owner self-service" path.
    throw new NotFoundError("Asset not found");
  }
  try {
    await deleteObject(key);
  } catch (err) {
    // Some deployments' IAM policy for the API's S3 credentials only grants
    // PutObject/GetObject (upload + serve), not DeleteObject — in that case
    // the object is orphaned in the bucket rather than actually removed.
    // Still drop the bookkeeping row so the app's own state is consistent;
    // orphan cleanup then needs a separate process with delete permission
    // (e.g. an S3 lifecycle rule, or a periodic job with broader IAM access).
    logger.warn({ err, key }, "S3 delete failed (likely missing s3:DeleteObject permission) — removing Asset row anyway");
  }
  await prisma.asset.delete({ where: { key } });
}
