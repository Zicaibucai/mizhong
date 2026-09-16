-- CreateEnum
CREATE TYPE "PriceMode" AS ENUM ('NEGOTIABLE', 'FIXED', 'RANGE');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "hoverVideoAssetId" TEXT,
ADD COLUMN     "moq" INTEGER,
ADD COLUMN     "moqUnit" TEXT,
ADD COLUMN     "priceMax" DECIMAL(12,2),
ADD COLUMN     "priceMin" DECIMAL(12,2),
ADD COLUMN     "priceMode" "PriceMode" NOT NULL DEFAULT 'NEGOTIABLE',
ADD COLUMN     "priceUnit" TEXT;

-- AlterTable
ALTER TABLE "ProductTranslation" ADD COLUMN     "sizeSummary" TEXT;

-- CreateTable
CREATE TABLE "ProductSpecification" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSpecification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSpecificationTranslation" (
    "id" TEXT NOT NULL,
    "specificationId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT,

    CONSTRAINT "ProductSpecificationTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductSpecification_productId_sortOrder_idx" ON "ProductSpecification"("productId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSpecificationTranslation_specificationId_locale_key" ON "ProductSpecificationTranslation"("specificationId", "locale");

-- CreateIndex
CREATE INDEX "Product_hoverVideoAssetId_idx" ON "Product"("hoverVideoAssetId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_hoverVideoAssetId_fkey" FOREIGN KEY ("hoverVideoAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSpecification" ADD CONSTRAINT "ProductSpecification_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSpecificationTranslation" ADD CONSTRAINT "ProductSpecificationTranslation_specificationId_fkey" FOREIGN KEY ("specificationId") REFERENCES "ProductSpecification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

