-- CreateEnum
CREATE TYPE "WarrantyClaimStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReturnRequestStatus" AS ENUM ('REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'AWAITING_RETURN', 'RECEIVED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReturnReason" AS ENUM ('DEFECTIVE', 'WRONG_ITEM', 'CHANGED_MIND', 'DAMAGED_SHIPPING', 'OTHER');

-- CreateEnum
CREATE TYPE "WarrantyIssueType" AS ENUM ('DEFECT', 'MALFUNCTION', 'MISSING_PARTS', 'OTHER');

-- CreateEnum
CREATE TYPE "WarrantyMediaKind" AS ENUM ('IMAGE');

-- CreateEnum
CREATE TYPE "DesiredResolution" AS ENUM ('REFUND', 'EXCHANGE', 'STORE_CREDIT');

-- CreateTable
CREATE TABLE "WarrantyClaim" (
    "id" TEXT NOT NULL,
    "claimCode" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderCode" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "skuId" TEXT,
    "skuCode" TEXT,
    "productName" TEXT NOT NULL,
    "issueType" "WarrantyIssueType" NOT NULL,
    "description" TEXT NOT NULL,
    "serialNumber" TEXT,
    "status" "WarrantyClaimStatus" NOT NULL DEFAULT 'SUBMITTED',
    "activeKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "orderSyncedStatus" TEXT,
    "orderSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarrantyClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarrantyClaimMedia" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "kind" "WarrantyMediaKind" NOT NULL DEFAULT 'IMAGE',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarrantyClaimMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarrantyClaimHistory" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "fromStatus" "WarrantyClaimStatus",
    "toStatus" "WarrantyClaimStatus" NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarrantyClaimHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnRequest" (
    "id" TEXT NOT NULL,
    "returnCode" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderCode" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "skuId" TEXT,
    "skuCode" TEXT,
    "productName" TEXT NOT NULL,
    "reason" "ReturnReason" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "desiredResolution" "DesiredResolution" NOT NULL DEFAULT 'REFUND',
    "status" "ReturnRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "activeKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "orderSyncedStatus" TEXT,
    "orderSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnRequestMedia" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "kind" "WarrantyMediaKind" NOT NULL DEFAULT 'IMAGE',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReturnRequestMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnRequestHistory" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "fromStatus" "ReturnRequestStatus",
    "toStatus" "ReturnRequestStatus" NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReturnRequestHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarrantyIdempotency" (
    "key" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "responseJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarrantyIdempotency_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "routingKey" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "traceId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WarrantyClaim_claimCode_key" ON "WarrantyClaim"("claimCode");
CREATE UNIQUE INDEX "WarrantyClaim_activeKey_key" ON "WarrantyClaim"("activeKey");
CREATE INDEX "WarrantyClaim_customerId_idx" ON "WarrantyClaim"("customerId");
CREATE INDEX "WarrantyClaim_orderId_idx" ON "WarrantyClaim"("orderId");
CREATE INDEX "WarrantyClaim_orderItemId_idx" ON "WarrantyClaim"("orderItemId");
CREATE INDEX "WarrantyClaim_status_idx" ON "WarrantyClaim"("status");
CREATE INDEX "WarrantyClaimMedia_claimId_idx" ON "WarrantyClaimMedia"("claimId");
CREATE INDEX "WarrantyClaimMedia_mediaId_idx" ON "WarrantyClaimMedia"("mediaId");
CREATE INDEX "WarrantyClaimHistory_claimId_idx" ON "WarrantyClaimHistory"("claimId");
CREATE UNIQUE INDEX "ReturnRequest_returnCode_key" ON "ReturnRequest"("returnCode");
CREATE UNIQUE INDEX "ReturnRequest_activeKey_key" ON "ReturnRequest"("activeKey");
CREATE INDEX "ReturnRequest_customerId_idx" ON "ReturnRequest"("customerId");
CREATE INDEX "ReturnRequest_orderId_idx" ON "ReturnRequest"("orderId");
CREATE INDEX "ReturnRequest_orderItemId_idx" ON "ReturnRequest"("orderItemId");
CREATE INDEX "ReturnRequest_status_idx" ON "ReturnRequest"("status");
CREATE INDEX "ReturnRequestMedia_returnId_idx" ON "ReturnRequestMedia"("returnId");
CREATE INDEX "ReturnRequestMedia_mediaId_idx" ON "ReturnRequestMedia"("mediaId");
CREATE INDEX "ReturnRequestHistory_returnId_idx" ON "ReturnRequestHistory"("returnId");
CREATE INDEX "OutboxEvent_publishedAt_idx" ON "OutboxEvent"("publishedAt");

-- AddForeignKey
ALTER TABLE "WarrantyClaimMedia" ADD CONSTRAINT "WarrantyClaimMedia_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "WarrantyClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WarrantyClaimHistory" ADD CONSTRAINT "WarrantyClaimHistory_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "WarrantyClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReturnRequestMedia" ADD CONSTRAINT "ReturnRequestMedia_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReturnRequestHistory" ADD CONSTRAINT "ReturnRequestHistory_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
