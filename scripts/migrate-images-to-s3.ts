// One-off migration: uploads the frontend's static /public/images/** exports
// to S3 and repoints every already-seeded row that referenced a local path
// at the resulting S3 URL — the same thing a real "we used to ship images
// in the frontend bundle, now they live in object storage" migration looks
// like. Safe to re-run (uploads are idempotent PUTs by content-derived key
// isn't required here since paths are stable; DB updates are no-ops once
// applied).
//
// Usage (from this repo's root):
//   IMAGES_ROOT=../Practice-F/public/images npx tsx scripts/migrate-images-to-s3.ts
// IMAGES_ROOT defaults to that same relative path, since that's where this
// currently lives on this machine — pass an absolute path if yours differs.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3, publicUrlForKey } from "../src/lib/s3.js";
import { env } from "../src/config/env.js";
import { prisma } from "../src/lib/prisma.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGES_ROOT = process.env.IMAGES_ROOT
  ? path.resolve(process.cwd(), process.env.IMAGES_ROOT)
  : path.resolve(__dirname, "../../Practice-F/public/images");
const MAPPING_OUT = path.resolve(__dirname, "../prisma/image-migration-map.json");

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

function walk(dir: string, base = dir): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, base);
    return [path.relative(base, full)];
  });
}

async function uploadOne(relPath: string): Promise<string> {
  const fullPath = path.join(IMAGES_ROOT, relPath);
  const body = fs.readFileSync(fullPath);
  const ext = path.extname(relPath).toLowerCase();
  const contentType = CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream";
  // Keep the same folder shape under a seed-assets/ prefix so it's obvious
  // in the bucket which objects came from this migration vs. real uploads.
  const key = `seed-assets/${relPath.replaceAll(path.sep, "/")}`;
  await s3.send(new PutObjectCommand({ Bucket: env.S3_BUCKET_NAME, Key: key, Body: body, ContentType: contentType }));
  return publicUrlForKey(key);
}

async function main() {
  if (!fs.existsSync(IMAGES_ROOT)) {
    console.error(`❌ IMAGES_ROOT does not exist: ${IMAGES_ROOT}\nSet IMAGES_ROOT to the frontend's public/images directory.`);
    process.exit(1);
  }

  const files = walk(IMAGES_ROOT);
  console.log(`📤 Uploading ${files.length} images from ${IMAGES_ROOT} to s3://${env.S3_BUCKET_NAME}/seed-assets/ …`);

  const mapping: Record<string, string> = {};
  for (const relPath of files) {
    const url = await uploadOne(relPath);
    const localPath = `/images/${relPath.replaceAll(path.sep, "/")}`;
    mapping[localPath] = url;
    console.log(`  ✓ ${localPath} -> ${url}`);
  }

  fs.writeFileSync(MAPPING_OUT, JSON.stringify(mapping, null, 2));
  console.log(`\n📝 Wrote mapping (${Object.keys(mapping).length} entries) to ${MAPPING_OUT}`);

  console.log("\n🔁 Repointing already-seeded rows at their S3 URLs…");
  let updated = 0;

  // (model, url field(s)) pairs — every place a local /images/* path can
  // currently live in the schema.
  const singleFieldTargets: { update: (oldUrl: string, newUrl: string) => Promise<{ count: number }> }[] = [
    { update: (o, n) => prisma.productImage.updateMany({ where: { url: o }, data: { url: n } }) },
    { update: (o, n) => prisma.category.updateMany({ where: { imageUrl: o }, data: { imageUrl: n } }) },
    { update: (o, n) => prisma.collection.updateMany({ where: { coverUrl: o }, data: { coverUrl: n } }) },
    { update: (o, n) => prisma.collection.updateMany({ where: { heroImageUrl: o }, data: { heroImageUrl: n } }) },
    { update: (o, n) => prisma.retailer.updateMany({ where: { logoUrl: o }, data: { logoUrl: n } }) },
    { update: (o, n) => prisma.retailer.updateMany({ where: { coverUrl: o }, data: { coverUrl: n } }) },
    { update: (o, n) => prisma.retailer.updateMany({ where: { heroImageUrl: o }, data: { heroImageUrl: n } }) },
    { update: (o, n) => prisma.retailer.updateMany({ where: { storyImageUrl: o }, data: { storyImageUrl: n } }) },
    { update: (o, n) => prisma.marketplaceEvent.updateMany({ where: { bannerUrl: o }, data: { bannerUrl: n } }) },
    { update: (o, n) => prisma.eventEntry.updateMany({ where: { imageUrl: o }, data: { imageUrl: n } }) },
    { update: (o, n) => prisma.hallOfFameEntry.updateMany({ where: { imageUrl: o }, data: { imageUrl: n } }) },
  ];

  for (const [oldUrl, newUrl] of Object.entries(mapping)) {
    for (const target of singleFieldTargets) {
      const result = await target.update(oldUrl, newUrl);
      updated += result.count;
    }
  }

  console.log(`✅ Repointed ${updated} row(s). Re-run \`npm run db:seed\` on a fresh database and it'll seed with S3 URLs directly (see prisma/seed.ts).`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
