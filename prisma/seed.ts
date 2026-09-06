// Ports the exact mock data from `lib/data/*.ts` on the frontend into
// Postgres, so the freshly-wired API returns the same content the app
// already showed when it was reading local arrays. Run with `npm run db:seed`
// (also runs automatically after `prisma migrate dev`).
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { authenticator } from "otplib";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const prisma = new PrismaClient();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// `npm run migrate:images` uploads the frontend's static /public/images/**
// exports to S3 and writes this mapping. Every image reference below goes
// through `img()` so seeding picks up S3 URLs automatically once that's
// been run — and still works, falling back to the local path, if it
// hasn't (e.g. a fresh clone that hasn't configured S3 yet).
const IMAGE_MAP: Record<string, string> = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, "image-migration-map.json"), "utf8"));
  } catch {
    return {};
  }
})();

function img(localPath: string): string {
  return IMAGE_MAP[localPath] ?? localPath;
}

async function hash(pw: string) {
  return bcrypt.hash(pw, 10);
}

async function main() {
  console.log("🌱 Seeding Ilkal Threads database…");

  // ---------- Categories ----------
  const categories = [
    { slug: "cotton-ilkal", name: "COTTON_ILKAL" as const, description: "100% fine cotton yarn, classic comfort for everyday elegance.", imageUrl: img("/images/customer/category-cotton-ilkal.png") },
    { slug: "silk-cotton", name: "SILK_COTTON" as const, description: "An exquisite blend of pure mulberry silk and premium long-staple cotton.", imageUrl: img("/images/customer/category-silk-cotton.png") },
    { slug: "traditional-ilkal", name: "TRADITIONAL_ILKAL" as const, description: "Time-tested weave pattern with iconic red silk pallu and Chikki border.", imageUrl: img("/images/customer/category-traditional-ilkal.png") },
    { slug: "contemporary-ilkal", name: "CONTEMPORARY_ILKAL" as const, description: "Modern pastel palettes and modified stripes suited for minimalist styling.", imageUrl: img("/images/customer/category-contemporary-ilkal.png") },
    { slug: "wedding-sarees", name: "WEDDING_SAREE" as const, description: "Opulent pure silk creations embellished with intricate Kasuti embroidery.", imageUrl: img("/images/customer/category-wedding-sarees.png") },
    { slug: "festive-sarees", name: "FESTIVE_SAREE" as const, description: "Vibrant hues and metallic border variants to elevate sacred celebrations.", imageUrl: img("/images/customer/category-festive-sarees.png") },
  ];
  for (const c of categories) {
    await prisma.category.upsert({ where: { slug: c.slug }, update: c, create: c });
  }
  console.log(`  ✓ ${categories.length} categories`);

  // ---------- Admin ----------
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@ilkalthreads.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
  const mfaSecret = authenticator.generateSecret();
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: { name: "Platform Admin", email: adminEmail, passwordHash: await hash(adminPassword), role: "ADMIN", mfaSecret, mfaEnabled: true },
  });
  console.log(`  ✓ admin account: ${adminEmail} / ${adminPassword}`);
  console.log(`    MFA otpauth URL (scan into an authenticator app): ${authenticator.keyuri(adminEmail, "Ilkal Threads Admin", mfaSecret)}`);

  // ---------- Demo customer ----------
  const customer = await prisma.user.upsert({
    where: { email: "priya@example.com" },
    update: {},
    create: { name: "Priya Sharma", email: "priya@example.com", passwordHash: await hash("Password123!"), role: "CUSTOMER" },
  });
  console.log(`  ✓ demo customer: priya@example.com / Password123!`);

  // ---------- Retailers (+ owner accounts) ----------
  const retailerSeeds = [
    { mockId: "ret_lakshmi", slug: "lakshmi-sarees", name: "Lakshmi Sarees", email: "owner@lakshmisarees.com", logoUrl: img("/images/customer/retailer-1-avatar.png"), coverUrl: img("/images/customer/retailer-1-cover.png"), location: "Ilkal, Karnataka", verified: true, rating: 4.9, reviewCount: 612, productCount: 140, memberSince: new Date("2019-03-01"), bio: "Specialized in classic Chikki Paras borders and pure silk handlooms for three generations.", specialties: ["TRADITIONAL_ILKAL", "SILK_COTTON", "WEDDING_SAREE"] as const, totalSales: 842000, heroImageUrl: img("/images/customer/retailer-profile-hero-lakshmi.png"), storyImageUrl: img("/images/customer/retailer-profile-story-lakshmi.png"), foundedYear: 1985, storyTitle: "Mastering the Loom of Karnataka", storyParagraphs: ["For nearly four decades, Lakshmi Sarees has stood as a beacon of genuine handloom excellence in the weaver town of Ilkal. Initiated by Shri. Ramappa, our workshop sustains over 50 local weaver families who work dedicatedly using ancient techniques.", "We specialize specifically in pure Mulberry Silk and hand-spun Silk Cotton blends featuring the iconic Chikki Paras star borders and rich temple tower pallus. Every piece is an heirloom produced slowly with intense devotion."], ordersFulfilled: 12000 },
    { mockId: "ret_kaveri", slug: "kaveri-handlooms", name: "Kaveri Handlooms", email: "owner@kaverihandlooms.com", logoUrl: img("/images/customer/retailer-2-avatar.png"), coverUrl: img("/images/customer/retailer-2-cover.png"), location: "Bagalkot, Karnataka", verified: true, rating: 4.8, reviewCount: 389, productCount: 95, memberSince: new Date("2020-07-14"), bio: "A cooperative of 30 weaver families dedicated to reviving organic dyes and ancient patterns.", specialties: ["COTTON_ILKAL", "FESTIVE_SAREE"] as const, totalSales: 511000 },
    { mockId: "ret_vardhaman", slug: "vardhaman-textiles", name: "Vardhaman Textiles", email: "owner@vardhamantextiles.com", logoUrl: img("/images/customer/retailer-3-avatar.png"), coverUrl: img("/images/customer/retailer-3-cover.png"), location: "Ilkal, Karnataka", verified: true, rating: 4.7, reviewCount: 264, productCount: 110, memberSince: new Date("2021-01-22"), bio: "Pioneering the blend of traditional Kasuti hand embroidery with contemporary minimalist layouts.", specialties: ["CONTEMPORARY_ILKAL", "SILK_COTTON"] as const, totalSales: 398000 },
    { mockId: "ret_karnataka_weaver", slug: "karnataka-weaver-co", name: "Karnataka Weaver Co.", email: "owner@karnatakaweaver.com", logoUrl: img("/images/customer/retailer-2-avatar.png"), coverUrl: img("/images/customer/retailer-2-cover.png"), location: "Hubballi, Karnataka", verified: true, rating: 4.6, reviewCount: 178, productCount: 72, memberSince: new Date("2021-09-10"), bio: "Modern pastel palettes and offbeat minimalist styling rooted in classic handloom technique.", specialties: ["CONTEMPORARY_ILKAL", "COTTON_ILKAL"] as const, totalSales: 265000 },
    { mockId: "ret_sri_krishna", slug: "sri-krishna-weavers", name: "Sri Krishna Weavers", email: "owner@srikrishnaweavers.com", logoUrl: img("/images/customer/retailer-5-avatar.png"), coverUrl: img("/images/customer/retailer-5-cover.png"), location: "Gadag, Karnataka", verified: true, rating: 4.8, reviewCount: 201, productCount: 120, memberSince: new Date("2018-11-05"), bio: "Authentic silk weavers featuring heavily ornamented borders and authentic zari drapes.", specialties: ["WEDDING_SAREE", "SILK_COTTON"] as const, totalSales: 693000 },
    { mockId: "ret_hemavati", slug: "hemavati-guild", name: "Hemavati Guild", email: "owner@hemavatiguild.com", logoUrl: img("/images/customer/retailer-6-avatar.png"), coverUrl: img("/images/customer/retailer-6-cover.png"), location: "Ilkal, Karnataka", verified: true, rating: 4.5, reviewCount: 96, productCount: 55, memberSince: new Date("2022-02-18"), bio: "Preserving extremely rare 12th-century hand-weaving guidelines for pure cotton luxury.", specialties: ["TRADITIONAL_ILKAL", "COTTON_ILKAL"] as const, totalSales: 187000 },
  ];

  const retailerIdByMockId = new Map<string, string>();
  for (const r of retailerSeeds) {
    const user = await prisma.user.upsert({
      where: { email: r.email },
      update: {},
      create: { name: r.name, email: r.email, passwordHash: await hash("Password123!"), role: "RETAILER" },
    });
    const retailer = await prisma.retailer.upsert({
      where: { slug: r.slug },
      update: {},
      create: {
        userId: user.id,
        slug: r.slug,
        name: r.name,
        logoUrl: r.logoUrl,
        coverUrl: r.coverUrl,
        location: r.location,
        verified: r.verified,
        rating: r.rating,
        reviewCount: r.reviewCount,
        productCount: r.productCount,
        memberSince: r.memberSince,
        bio: r.bio,
        specialties: [...r.specialties],
        status: "APPROVED",
        totalSales: r.totalSales,
        heroImageUrl: r.heroImageUrl,
        storyImageUrl: r.storyImageUrl,
        foundedYear: r.foundedYear,
        storyTitle: r.storyTitle,
        storyParagraphs: r.storyParagraphs ?? [],
        ordersFulfilled: r.ordersFulfilled ?? 0,
      },
    });
    retailerIdByMockId.set(r.mockId, retailer.id);
  }
  console.log(`  ✓ ${retailerSeeds.length} retailers (each logs in with owner@<slug-ish>.com / Password123!)`);

  // ---------- Products ----------
  const productSeeds = [
    { mockId: "prod_trad_red_border", slug: "traditional-red-border-ilkal-saree", name: "Traditional Red Border Ilkal Saree", retailer: "ret_lakshmi", weaveType: "TRADITIONAL_ILKAL", price: 2850, compareAtPrice: 3500, images: [{ url: img("/images/customer/product-trad-red-border.png"), alt: "Traditional Red Border Ilkal Saree — full drape" }, { url: img("/images/customer/pdp-gallery-main.png"), alt: "Traditional Red Border Ilkal Saree — draped detail" }, { url: img("/images/customer/pdp-gallery-thumb-1.png"), alt: "Traditional Red Border Ilkal Saree — pallu detail" }, { url: img("/images/customer/pdp-gallery-thumb-2.png"), alt: "Traditional Red Border Ilkal Saree — border close-up" }, { url: img("/images/customer/pdp-gallery-thumb-3.png"), alt: "Traditional Red Border Ilkal Saree — blouse piece" }, { url: img("/images/customer/pdp-gallery-thumb-4.png"), alt: "Traditional Red Border Ilkal Saree — styled look" }], color: "Heirloom Crimson Body & Dark Indigo Weft", borderType: "Chikki Paras (Golden zari motifs)", material: "Fine cotton body, Pure Mulberry Silk pallu", lengthWidth: "5.5 Meters Saree + 0.8 Meters Blouse Piece", rating: 4.8, reviewCount: 124, stockCount: 18, tags: ["trending", "handloom-gi"], description: "Woven painstakingly in Ilkal town, this fine cotton saree captures the soul of Karnataka's handloom culture. Featuring the renowned star-inspired Chikki Paras border and a lustrous red silk pallu detailed with temple motifs, it brings historical dignity to modern celebrations.", createdAt: new Date("2026-06-02") },
    { mockId: "prod_navy_chikki_paras", slug: "navy-blue-chikki-paras-saree", name: "Navy Blue Chikki Paras Saree", retailer: "ret_kaveri", weaveType: "COTTON_ILKAL", price: 3200, images: [{ url: img("/images/customer/product-navy-chikki-paras.png"), alt: "Navy Blue Chikki Paras Saree" }], color: "Indigo Blue Body & Classic Stripe Border", borderType: "Chikki Paras", material: "100% fine cotton yarn", lengthWidth: "5.5 Meters Saree + 0.8 Meters Blouse Piece", rating: 4.9, reviewCount: 96, stockCount: 24, tags: ["trending"], description: "A cooperative-woven cotton Ilkal saree in deep indigo blue, finished with the classic Chikki Paras stripe border — everyday elegance backed by three generations of weaving expertise.", createdAt: new Date("2026-06-18") },
    { mockId: "prod_emerald_kasuti", slug: "emerald-green-kasuti-embroidery-saree", name: "Emerald Green Kasuti Embroidery", retailer: "ret_vardhaman", weaveType: "SILK_COTTON", price: 4500, compareAtPrice: 5200, images: [{ url: img("/images/customer/product-emerald-kasuti.png"), alt: "Emerald Green Kasuti Embroidery Saree" }], color: "Sage Green Body & Antique Gold Zari", borderType: "Kasuti hand embroidery", material: "Silk-cotton blend", lengthWidth: "5.5 Meters Saree + 0.8 Meters Blouse Piece", rating: 4.7, reviewCount: 71, stockCount: 9, tags: ["trending", "new-arrival"], description: "Pioneering the blend of traditional Kasuti hand embroidery with a contemporary minimalist palette — a sage green weave finished with intricate gold-thread needlework across the pallu.", createdAt: new Date("2026-07-01") },
    { mockId: "prod_pastel_lavender", slug: "pastel-lavender-modern-blend-saree", name: "Pastel Lavender Modern Blend", retailer: "ret_karnataka_weaver", weaveType: "CONTEMPORARY_ILKAL", price: 2990, compareAtPrice: 3500, images: [{ url: img("/images/customer/product-pastel-lavender.png"), alt: "Pastel Lavender Modern Blend Saree" }], color: "Pastel Lavender Body & Silver Zari Border", borderType: "Modified minimal stripe", material: "Cotton-silk blend", lengthWidth: "5.5 Meters Saree + 0.8 Meters Blouse Piece", rating: 4.6, reviewCount: 58, stockCount: 15, tags: ["trending"], description: "Modern pastel palette with modified stripes, suited for minimalist contemporary styling while retaining the handloom weave integrity of Ilkal.", createdAt: new Date("2026-07-10") },
    { mockId: "prod_mustard_gold", slug: "mustard-gold-silk-cotton-blend-saree", name: "Mustard Gold Silk Cotton Blend Saree", retailer: "ret_lakshmi", weaveType: "SILK_COTTON", price: 3800, compareAtPrice: 4400, images: [{ url: img("/images/customer/product-mustard-gold.png"), alt: "Mustard Gold Silk Cotton Blend Saree" }], color: "Mustard Gold Body & Deep Maroon Border", borderType: "Temple zari border", material: "Silk-cotton blend", lengthWidth: "5.5 Meters Saree + 0.8 Meters Blouse Piece", rating: 4.5, reviewCount: 43, stockCount: 12, tags: ["festive"], description: "A rich mustard gold weave finished with a deep maroon temple-motif border — festive elegance rooted in three generations of Lakshmi Sarees' craft.", createdAt: new Date("2026-05-14") },
    { mockId: "prod_crimson_chikki_paras", slug: "crimson-traditional-chikki-paras-saree", name: "Crimson Traditional Chikki Paras", retailer: "ret_kaveri", weaveType: "WEDDING_SAREE", price: 5900, images: [{ url: img("/images/customer/product-crimson-chikki-paras.png"), alt: "Crimson Traditional Chikki Paras Saree" }], color: "Heirloom Crimson Body & Antique Gold Zari", borderType: "Chikki Paras (star motifs)", material: "Pure Mulberry Silk", lengthWidth: "5.5 Meters Saree + 0.8 Meters Blouse Piece", rating: 4.8, reviewCount: 87, stockCount: 6, tags: ["wedding"], description: "A heavyweight pure silk wedding weave in heirloom crimson, hand-finished with the iconic Chikki Paras star-motif border and antique gold zari work.", createdAt: new Date("2026-04-30") },
    { mockId: "prod_indigo_chikki_paras", slug: "indigo-chikki-paras-saree", name: "Indigo Chikki Paras Saree", retailer: "ret_kaveri", weaveType: "COTTON_ILKAL", price: 3200, images: [{ url: img("/images/customer/product-indigo-chikki-paras.png"), alt: "Indigo Chikki Paras Saree" }], color: "Deep Indigo Body & Chikki Paras Border", borderType: "Chikki Paras", material: "100% fine cotton yarn", lengthWidth: "5.5 Meters Saree + 0.8 Meters Blouse Piece", rating: 4.9, reviewCount: 112, stockCount: 20, tags: [], description: "A cooperative-woven indigo cotton Ilkal saree finished with the classic Chikki Paras border.", createdAt: new Date("2026-06-25") },
    { mockId: "prod_mustard_festive", slug: "mustard-festive-splendor-saree", name: "Mustard Festive Splendor", retailer: "ret_vardhaman", weaveType: "FESTIVE_SAREE", price: 3650, images: [{ url: img("/images/customer/product-mustard-festive.png"), alt: "Mustard Festive Splendor Saree" }], color: "Mustard Body & Kasuti Embroidered Pallu", borderType: "Kasuti hand embroidery", material: "Silk-cotton blend", lengthWidth: "5.5 Meters Saree + 0.8 Meters Blouse Piece", rating: 4.7, reviewCount: 64, stockCount: 11, tags: ["festive"], description: "A vibrant mustard festive weave with hand-embroidered Kasuti pallu detailing from Vardhaman Textiles.", createdAt: new Date("2026-05-02") },
    { mockId: "prod_sage_green_minimalist", slug: "sage-green-minimalist-saree", name: "Sage Green Minimalist Saree", retailer: "ret_karnataka_weaver", weaveType: "CONTEMPORARY_ILKAL", price: 2990, images: [{ url: img("/images/customer/product-sage-green-minimalist.png"), alt: "Sage Green Minimalist Saree" }], color: "Sage Green Body & Silver Zari Border", borderType: "Modified minimal stripe", material: "Cotton-silk blend", lengthWidth: "5.5 Meters Saree + 0.8 Meters Blouse Piece", rating: 4.6, reviewCount: 39, stockCount: 17, tags: [], description: "Minimalist styling in sage green with a fine silver zari border — contemporary Ilkal at its most understated.", createdAt: new Date("2026-06-11") },
    { mockId: "prod_crimson_zari_wedding", slug: "crimson-zari-wedding-edit-saree", name: "Crimson Zari Wedding Edit", retailer: "ret_lakshmi", weaveType: "WEDDING_SAREE", price: 6500, images: [{ url: img("/images/customer/product-crimson-zari-wedding.png"), alt: "Crimson Zari Wedding Edit Saree" }], color: "Heirloom Crimson Body & Antique Gold Zari", borderType: "Wide zari temple border", material: "Pure Mulberry Silk", lengthWidth: "5.5 Meters Saree + 0.8 Meters Blouse Piece", rating: 4.9, reviewCount: 98, stockCount: 5, tags: ["wedding"], description: "A statement wedding weave from Lakshmi Sarees, awash in antique gold zari against a heritage crimson body.", createdAt: new Date("2026-04-08") },
    { mockId: "prod_sri_krishna_zari_drape", slug: "ornamented-zari-wedding-drape", name: "Ornamented Zari Wedding Drape", retailer: "ret_sri_krishna", weaveType: "WEDDING_SAREE", price: 7200, images: [{ url: img("/images/customer/retailer-5-preview-1.png"), alt: "Ornamented Zari Wedding Drape" }], color: "Deep Maroon Body & Heavy Gold Zari", borderType: "Heavily ornamented temple border", material: "Pure Mulberry Silk", lengthWidth: "5.5 Meters Saree + 0.8 Meters Blouse Piece", rating: 4.8, reviewCount: 55, stockCount: 4, tags: ["wedding"], description: "Heavily ornamented borders and authentic zari drapework from the silk masters at Sri Krishna Weavers.", createdAt: new Date("2026-03-20") },
    { mockId: "prod_sri_krishna_silk_cotton", slug: "gadag-silk-cotton-drape", name: "Gadag Silk Cotton Drape", retailer: "ret_sri_krishna", weaveType: "SILK_COTTON", price: 4100, images: [{ url: img("/images/customer/retailer-5-preview-2.png"), alt: "Gadag Silk Cotton Drape" }], color: "Amber Body & Zari Border", borderType: "Ornamented zari border", material: "Silk-cotton blend", lengthWidth: "5.5 Meters Saree + 0.8 Meters Blouse Piece", rating: 4.7, reviewCount: 38, stockCount: 10, tags: [], description: "A refined silk-cotton weave from Gadag, finished with Sri Krishna Weavers' signature ornamented border.", createdAt: new Date("2026-04-15") },
    { mockId: "prod_hemavati_heritage_cotton", slug: "heritage-pure-cotton-saree", name: "Heritage Pure Cotton Saree", retailer: "ret_hemavati", weaveType: "TRADITIONAL_ILKAL", price: 2600, images: [{ url: img("/images/customer/retailer-6-preview-1.png"), alt: "Heritage Pure Cotton Saree" }], color: "Natural Ivory Body & Rust Border", borderType: "12th-century temple guideline border", material: "100% Pure Cotton", lengthWidth: "5.5 Meters Saree + 0.8 Meters Blouse Piece", rating: 4.5, reviewCount: 29, stockCount: 13, tags: [], description: "Woven to rare 12th-century guild guidelines, preserving pure cotton luxury in its most historically faithful form.", createdAt: new Date("2026-02-11") },
    { mockId: "prod_hemavati_cotton_ilkal", slug: "guild-cotton-ilkal-saree", name: "Guild Cotton Ilkal Saree", retailer: "ret_hemavati", weaveType: "COTTON_ILKAL", price: 2350, images: [{ url: img("/images/customer/retailer-6-preview-2.png"), alt: "Guild Cotton Ilkal Saree" }], color: "Sand Body & Rust Stripe", borderType: "Classic stripe border", material: "100% fine cotton yarn", lengthWidth: "5.5 Meters Saree + 0.8 Meters Blouse Piece", rating: 4.4, reviewCount: 21, stockCount: 16, tags: [], description: "An everyday cotton Ilkal weave from the Hemavati Guild's rare heritage loom techniques.", createdAt: new Date("2026-01-28") },
  ] as const;

  const productIdByMockId = new Map<string, string>();
  for (const p of productSeeds) {
    const retailerId = retailerIdByMockId.get(p.retailer);
    if (!retailerId) throw new Error(`Unknown retailer mock id ${p.retailer}`);
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        slug: p.slug,
        name: p.name,
        retailerId,
        weaveType: p.weaveType,
        price: p.price,
        compareAtPrice: "compareAtPrice" in p ? p.compareAtPrice : undefined,
        color: p.color,
        borderType: p.borderType,
        material: p.material,
        lengthWidth: p.lengthWidth,
        rating: p.rating,
        reviewCount: p.reviewCount,
        stockCount: p.stockCount,
        tags: [...p.tags],
        description: p.description,
        status: "ACTIVE",
        createdAt: p.createdAt,
        images: { create: p.images.map((img, i) => ({ ...img, position: i })) },
      },
    });
    productIdByMockId.set(p.mockId, product.id);
  }
  console.log(`  ✓ ${productSeeds.length} products`);

  // ---------- Collections ----------
  const allProductIds = [...productIdByMockId.values()];
  const collectionSeeds = [
    { slug: "handpicked-ilkal", title: "Handpicked Ilkal", description: "Direct selection of finest weaver masterpieces.", coverUrl: img("/images/customer/collection-handpicked-ilkal.png"), productMockIds: [...productIdByMockId.keys()] },
    { slug: "festive-edit", title: "Festive Edit", description: "Deep celebratory colors with rich lustrous borders.", coverUrl: img("/images/customer/collection-festive-edit.png"), productMockIds: ["prod_emerald_kasuti", "prod_trad_red_border"] },
    { slug: "heritage-collection", title: "Heritage Collection", eyebrow: "Heritage Masterpieces", description: "Timeless Ilkal sarees featuring traditional weaving patterns passed down through generations. Each piece tells a story of Karnataka's rich textile heritage.", coverUrl: img("/images/customer/collection-heritage.png"), heroImageUrl: img("/images/customer/collection-hero-heritage.png"), productMockIds: ["prod_trad_red_border", "prod_navy_chikki_paras", "prod_emerald_kasuti"] },
    { slug: "contemporary-ilkal", title: "Contemporary Ilkal", description: "Lighter weaves and offbeat pastel tones.", coverUrl: img("/images/customer/collection-contemporary.png"), productMockIds: ["prod_pastel_lavender", "prod_emerald_kasuti"] },
  ];
  for (const c of collectionSeeds) {
    const existing = await prisma.collection.findUnique({ where: { slug: c.slug } });
    if (existing) continue;
    await prisma.collection.create({
      data: {
        slug: c.slug,
        title: c.title,
        eyebrow: "eyebrow" in c ? c.eyebrow : undefined,
        description: c.description,
        coverUrl: c.coverUrl,
        heroImageUrl: "heroImageUrl" in c ? c.heroImageUrl : undefined,
        products: {
          create: c.productMockIds.map((mockId, i) => ({ productId: productIdByMockId.get(mockId) ?? allProductIds[0]!, position: i })),
        },
      },
    });
  }
  console.log(`  ✓ ${collectionSeeds.length} collections`);

  // ---------- Reviews ----------
  await prisma.review.createMany({
    data: [
      { productId: productIdByMockId.get("prod_trad_red_border")!, authorName: "Priya K.", verified: true, rating: 5, body: "The quality of the cotton is outstanding. Perfect for everyday elegance, and the Chikki Paras border looks incredibly exquisite in person. It feels soft yet has that classic handloom texture.", createdAt: new Date("2026-07-28") },
      { productId: productIdByMockId.get("prod_trad_red_border")!, authorName: "Aishwarya S.", verified: true, rating: 4, body: "Truly authentic. The loop joint between the silk pallu and cotton body is beautifully executed. Support team was helpful in tracking, delivered on time.", createdAt: new Date("2026-06-14") },
      { retailerId: retailerIdByMockId.get("ret_lakshmi")!, authorName: "Sowmya Hegde", verified: true, rating: 5, body: "The crimson Chikki Paras saree is breathtaking. Authentic weave with the iconic tope teni pallu. Truly direct from weavers, pure nostalgia.", createdAt: new Date("2026-01-12") },
      { retailerId: retailerIdByMockId.get("ret_lakshmi")!, authorName: "Priya Murthy", verified: true, rating: 5, body: "Perfect blend of tradition and comfort. The silk cotton feels light but has a premium sheen. Incredible response from Lakshmi Sarees customer service.", createdAt: new Date("2025-12-28") },
      { retailerId: retailerIdByMockId.get("ret_lakshmi")!, authorName: "Ananya Deshpande", verified: true, rating: 5, body: "The Kasuti work is extremely neat. Hard to find such meticulous craftsmanship nowadays. I am thoroughly delighted with this saree.", createdAt: new Date("2025-12-15") },
    ],
    skipDuplicates: true,
  });
  console.log("  ✓ reviews");

  // ---------- Marketplace event, entries, hall of fame ----------
  const existingEvent = await prisma.marketplaceEvent.findUnique({ where: { slug: "ilkal-style-challenge-2026" } });
  const event =
    existingEvent ??
    (await prisma.marketplaceEvent.create({
      data: {
        slug: "ilkal-style-challenge-2026",
        title: "Ilkal Style Challenge 2026",
        tagline: "Where Ilkal Fashion Comes Alive",
        bannerUrl: img("/images/customer/events-landing-hero.png"),
        status: "LIVE",
        startsAt: new Date("2026-08-01"),
        endsAt: new Date("2026-09-15"),
        prizePool: "₹5,00,000",
        description: "Discover. Create. Compete. Vote. Celebrate the absolute mastery and timeless artistry of weavers from Karnataka's ancient craft capital.",
      },
    }));

  const entrySeeds = [
    { retailer: "ret_lakshmi", product: "prod_trad_red_border", title: "Heritage in Crimson", imageUrl: img("/images/customer/product-trad-red-border.png"), votes: 3420, submittedAt: new Date("2026-08-03") },
    { retailer: "ret_kaveri", product: "prod_navy_chikki_paras", title: "Indigo Reverie", imageUrl: img("/images/customer/product-navy-chikki-paras.png"), votes: 3105, submittedAt: new Date("2026-08-02") },
    { retailer: "ret_vardhaman", product: "prod_emerald_kasuti", title: "Emerald Devotion", imageUrl: img("/images/customer/product-emerald-kasuti.png"), votes: 2876, submittedAt: new Date("2026-08-05") },
    { retailer: "ret_karnataka_weaver", product: "prod_pastel_lavender", title: "Modern Minimal", imageUrl: img("/images/customer/product-pastel-lavender.png"), votes: 2340, submittedAt: new Date("2026-08-06") },
    { retailer: "ret_lakshmi", product: "prod_mustard_gold", title: "Golden Hour", imageUrl: img("/images/customer/product-mustard-gold.png"), votes: 2108, submittedAt: new Date("2026-08-04") },
    { retailer: "ret_kaveri", product: "prod_crimson_chikki_paras", title: "Bridal Radiance", imageUrl: img("/images/customer/product-crimson-chikki-paras.png"), votes: 1980, submittedAt: new Date("2026-08-07") },
    { retailer: "ret_sri_krishna", product: "prod_sri_krishna_zari_drape", title: "Zari Legacy", imageUrl: img("/images/customer/retailer-5-preview-1.png"), votes: 1750, submittedAt: new Date("2026-08-08") },
    { retailer: "ret_hemavati", product: "prod_hemavati_heritage_cotton", title: "12th Century Revival", imageUrl: img("/images/customer/retailer-6-preview-1.png"), votes: 1522, submittedAt: new Date("2026-08-09") },
  ];
  for (const e of entrySeeds) {
    const retailerId = retailerIdByMockId.get(e.retailer)!;
    const productId = productIdByMockId.get(e.product)!;
    const existing = await prisma.eventEntry.findFirst({ where: { eventId: event.id, retailerId, productId } });
    if (!existing) {
      await prisma.eventEntry.create({ data: { eventId: event.id, retailerId, productId, title: e.title, imageUrl: e.imageUrl, votes: e.votes, submittedAt: e.submittedAt, status: "APPROVED" } });
    }
  }
  console.log(`  ✓ marketplace event + ${entrySeeds.length} entries`);

  const hallOfFameSeeds = [
    { year: 2025, entryTitle: "Threads of Tradition", retailer: "ret_lakshmi", imageUrl: img("/images/customer/product-crimson-zari-wedding.png"), votes: 4210 },
    { year: 2024, entryTitle: "Woven Sunrise", retailer: "ret_kaveri", imageUrl: img("/images/customer/product-indigo-chikki-paras.png"), votes: 3890 },
    { year: 2023, entryTitle: "Silk & Story", retailer: "ret_vardhaman", imageUrl: img("/images/customer/product-sage-green-minimalist.png"), votes: 3540 },
  ];
  for (const h of hallOfFameSeeds) {
    const retailerId = retailerIdByMockId.get(h.retailer)!;
    const existing = await prisma.hallOfFameEntry.findFirst({ where: { year: h.year, retailerId } });
    if (!existing) {
      await prisma.hallOfFameEntry.create({ data: { eventId: event.id, year: h.year, entryTitle: h.entryTitle, retailerId, imageUrl: h.imageUrl, votes: h.votes } });
    }
  }
  console.log(`  ✓ ${hallOfFameSeeds.length} hall of fame entries`);

  // ---------- A couple of seed orders for the demo customer ----------
  const existingOrder = await prisma.order.findFirst({ where: { userId: customer.id } });
  if (!existingOrder) {
    const item1 = productIdByMockId.get("prod_trad_red_border")!;
    const item2 = productIdByMockId.get("prod_navy_chikki_paras")!;
    await prisma.order.create({
      data: {
        orderNumber: `ORD-${crypto.randomInt(10000, 99999)}`,
        userId: customer.id,
        status: "DELIVERED",
        paymentMethod: "UPI",
        paymentStatus: "PAID",
        subtotal: 6050,
        shipping: 150,
        tax: 1089,
        total: 7289,
        shippingAddress: { fullName: "Priya Sharma", line1: "42 MG Road", city: "Bangalore", state: "Karnataka", postalCode: "560001", phone: "+91 98765 43210" },
        placedAt: new Date("2026-07-02T10:15:00+05:30"),
        estimatedDelivery: new Date("2026-07-09"),
        items: {
          create: [
            { productId: item1, retailerId: retailerIdByMockId.get("ret_lakshmi")!, quantity: 1, priceAtPurchase: 2850 },
            { productId: item2, retailerId: retailerIdByMockId.get("ret_kaveri")!, quantity: 1, priceAtPurchase: 3200 },
          ],
        },
        tracking: {
          create: [
            { status: "PLACED", label: "Order Placed", timestamp: new Date("2026-07-02T10:15:00+05:30"), complete: true, position: 0 },
            { status: "PROCESSING", label: "Handloom Verified & Processing", timestamp: new Date("2026-07-02T18:40:00+05:30"), complete: true, position: 1 },
            { status: "SHIPPED", label: "Shipped from Ilkal", timestamp: new Date("2026-07-04T09:00:00+05:30"), complete: true, position: 2 },
            { status: "IN_TRANSIT", label: "In Transit", timestamp: new Date("2026-07-06T14:20:00+05:30"), complete: true, position: 3 },
            { status: "DELIVERED", label: "Delivered", timestamp: new Date("2026-07-09T12:05:00+05:30"), complete: true, position: 4 },
          ],
        },
      },
    });
    console.log("  ✓ 1 seed order for the demo customer");
  }

  console.log("✅ Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
