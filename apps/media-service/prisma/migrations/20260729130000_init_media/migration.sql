-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('PENDING', 'ACTIVE', 'DELETED');

-- CreateEnum
CREATE TYPE "MediaOwnerType" AS ENUM ('product', 'sku', 'review', 'user', 'misc');

-- CreateEnum
CREATE TYPE "MediaRole" AS ENUM ('thumbnail', 'gallery', 'video');

-- CreateEnum
CREATE TYPE "MediaEntityType" AS ENUM ('product', 'sku', 'review');

-- CreateTable
CREATE TABLE "MediaObject" (
    "id" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "status" "MediaStatus" NOT NULL DEFAULT 'PENDING',
    "ownerType" "MediaOwnerType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "etag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MediaObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaLink" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "entityType" "MediaEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "role" "MediaRole" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAuditLog" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaObject_ownerType_ownerId_idx" ON "MediaObject"("ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "MediaObject_status_idx" ON "MediaObject"("status");

-- CreateIndex
CREATE INDEX "MediaObject_uploadedBy_idx" ON "MediaObject"("uploadedBy");

-- CreateIndex
CREATE UNIQUE INDEX "MediaObject_bucket_objectKey_key" ON "MediaObject"("bucket", "objectKey");

-- CreateIndex
CREATE INDEX "MediaLink_entityType_entityId_idx" ON "MediaLink"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaLink_mediaId_entityType_entityId_key" ON "MediaLink"("mediaId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "MediaAuditLog_mediaId_idx" ON "MediaAuditLog"("mediaId");

-- AddForeignKey
ALTER TABLE "MediaLink" ADD CONSTRAINT "MediaLink_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
