-- AlterTable
ALTER TABLE "ContactMethod" ADD COLUMN     "key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ContactMethod_key_key" ON "ContactMethod"("key");

