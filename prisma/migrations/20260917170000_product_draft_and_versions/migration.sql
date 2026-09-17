-- 商品编辑草稿 + 版本历史
--
-- 纯新增：Product 加两个可空列，新建 ProductVersion 表与新枚举。
-- 不删列、不改列、不触碰任何现有数据；线上内容（Product 各列、
-- ProductTranslation、ProductSpecification、ProductMedia）保持原样。

-- CreateEnum
CREATE TYPE "ProductVersionKind" AS ENUM ('PUBLISHED', 'MANUAL');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "draftData" JSONB,
ADD COLUMN     "draftUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ProductVersion" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "kind" "ProductVersionKind" NOT NULL,
    "snapshot" JSONB NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductVersion_productId_createdAt_idx" ON "ProductVersion"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductVersion_createdById_idx" ON "ProductVersion"("createdById");

-- AddForeignKey
ALTER TABLE "ProductVersion" ADD CONSTRAINT "ProductVersion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVersion" ADD CONSTRAINT "ProductVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

