-- CreateEnum
CREATE TYPE "TranslationStatus" AS ENUM ('SYNCED', 'STALE', 'TRANSLATING', 'FAILED');

-- CreateEnum
CREATE TYPE "ReleaseStatus" AS ENUM ('PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "TranslationJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TranslationJobKind" AS ENUM ('PUBLISH', 'SYNC_ONE', 'SYNC_ALL', 'RETRY_FAILED');

-- CreateEnum
CREATE TYPE "TranslationItemStatus" AS ENUM ('PENDING', 'RUNNING', 'SYNCED', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "Page" ADD COLUMN     "draftData" JSONB,
ADD COLUMN     "draftUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ProductVersion" ADD COLUMN     "releaseId" TEXT;

-- CreateTable
CREATE TABLE "ContentRevision" (
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "sourceHash" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentRevision_pkey" PRIMARY KEY ("entityType","entityId")
);

-- CreateTable
CREATE TABLE "TranslationState" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "sourceRevision" INTEGER NOT NULL DEFAULT 0,
    "fields" JSONB NOT NULL DEFAULT '{}',
    "status" "TranslationStatus" NOT NULL DEFAULT 'STALE',
    "translatedAt" TIMESTAMP(3),
    "translationModel" TEXT,
    "lastError" TEXT,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TranslationState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentRelease" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "locales" "Locale"[],
    "result" JSONB,
    "status" "ReleaseStatus" NOT NULL DEFAULT 'PUBLISHED',
    "model" TEXT,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentRelease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlugHistory" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlugHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranslationJob" (
    "id" TEXT NOT NULL,
    "kind" "TranslationJobKind" NOT NULL,
    "status" "TranslationJobStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "completedItems" INTEGER NOT NULL DEFAULT 0,
    "failedItems" INTEGER NOT NULL DEFAULT 0,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "tokenEstimate" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TranslationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranslationJobItem" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "revision" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "TranslationItemStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "tokenEstimate" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "TranslationJobItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageVersion" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "kind" "ProductVersionKind" NOT NULL,
    "snapshot" JSONB NOT NULL,
    "releaseId" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TranslationState_entityType_status_idx" ON "TranslationState"("entityType", "status");

-- CreateIndex
CREATE INDEX "TranslationState_entityType_entityId_idx" ON "TranslationState"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "TranslationState_entityType_entityId_locale_key" ON "TranslationState"("entityType", "entityId", "locale");

-- CreateIndex
CREATE INDEX "ContentRelease_entityType_entityId_publishedAt_idx" ON "ContentRelease"("entityType", "entityId", "publishedAt");

-- CreateIndex
CREATE INDEX "ContentRelease_publishedById_idx" ON "ContentRelease"("publishedById");

-- CreateIndex
CREATE INDEX "SlugHistory_entityType_entityId_idx" ON "SlugHistory"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "SlugHistory_entityType_slug_key" ON "SlugHistory"("entityType", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "TranslationJob_idempotencyKey_key" ON "TranslationJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "TranslationJob_status_createdAt_idx" ON "TranslationJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TranslationJob_kind_createdAt_idx" ON "TranslationJob"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "TranslationJob_createdById_idx" ON "TranslationJob"("createdById");

-- CreateIndex
CREATE INDEX "TranslationJobItem_jobId_status_idx" ON "TranslationJobItem"("jobId", "status");

-- CreateIndex
CREATE INDEX "TranslationJobItem_jobId_sortOrder_idx" ON "TranslationJobItem"("jobId", "sortOrder");

-- CreateIndex
CREATE INDEX "TranslationJobItem_entityType_entityId_idx" ON "TranslationJobItem"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "TranslationJobItem_jobId_entityType_entityId_locale_key" ON "TranslationJobItem"("jobId", "entityType", "entityId", "locale");

-- CreateIndex
CREATE INDEX "PageVersion_pageId_createdAt_idx" ON "PageVersion"("pageId", "createdAt");

-- CreateIndex
CREATE INDEX "PageVersion_createdById_idx" ON "PageVersion"("createdById");

-- AddForeignKey
ALTER TABLE "ContentRelease" ADD CONSTRAINT "ContentRelease_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranslationJob" ADD CONSTRAINT "TranslationJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranslationJobItem" ADD CONSTRAINT "TranslationJobItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "TranslationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageVersion" ADD CONSTRAINT "PageVersion_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageVersion" ADD CONSTRAINT "PageVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

