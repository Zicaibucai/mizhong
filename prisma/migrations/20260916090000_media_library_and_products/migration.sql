-- CreateEnum
CREATE TYPE "StorageDriver" AS ENUM ('LOCAL', 'OSS');

-- CreateEnum
CREATE TYPE "ProductMediaRole" AS ENUM ('GALLERY', 'VIDEO');

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "driver" "StorageDriver" NOT NULL DEFAULT 'LOCAL',
ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "originalName" TEXT,
ADD COLUMN     "thumbnailUrl" TEXT;

-- AlterTable
ALTER TABLE "ProductCategory" ADD COLUMN     "coverAssetId" TEXT,
ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "coverAssetId" TEXT,
ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slug" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ProductTranslation" ADD COLUMN     "application" TEXT,
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoTitle" TEXT,
ADD COLUMN     "shortDescription" TEXT;

-- CreateTable
CREATE TABLE "ProductMedia" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "role" "ProductMediaRole" NOT NULL DEFAULT 'GALLERY',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductMedia_productId_sortOrder_idx" ON "ProductMedia"("productId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProductMedia_assetId_idx" ON "ProductMedia"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductMedia_productId_assetId_role_key" ON "ProductMedia"("productId", "assetId", "role");

-- CreateIndex
CREATE INDEX "Asset_type_idx" ON "Asset"("type");

-- CreateIndex
CREATE INDEX "Asset_enabled_idx" ON "Asset"("enabled");

-- CreateIndex
CREATE INDEX "Asset_sortOrder_idx" ON "Asset"("sortOrder");

-- CreateIndex
CREATE INDEX "SlotBinding_assetId_idx" ON "SlotBinding"("assetId");

-- CreateIndex
CREATE INDEX "ProductCategory_enabled_idx" ON "ProductCategory"("enabled");

-- CreateIndex
CREATE INDEX "ProductCategory_sortOrder_idx" ON "ProductCategory"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_published_idx" ON "Product"("published");

-- CreateIndex
CREATE INDEX "Product_featured_idx" ON "Product"("featured");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_sortOrder_idx" ON "Product"("sortOrder");

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_coverAssetId_fkey" FOREIGN KEY ("coverAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_coverAssetId_fkey" FOREIGN KEY ("coverAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

