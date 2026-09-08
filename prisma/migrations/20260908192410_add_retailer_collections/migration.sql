-- CreateEnum
CREATE TYPE "RetailerCollectionStatus" AS ENUM ('draft', 'active');

-- CreateTable
CREATE TABLE "retailer_collections" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "RetailerCollectionStatus" NOT NULL DEFAULT 'draft',
    "coverImageUrl" TEXT,
    "productIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retailer_collections_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "retailer_collections" ADD CONSTRAINT "retailer_collections_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
