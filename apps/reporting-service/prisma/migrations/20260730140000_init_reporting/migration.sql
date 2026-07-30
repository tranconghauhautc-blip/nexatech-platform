-- CreateTable
CREATE TABLE "OrderProjection" (
    "orderId" TEXT NOT NULL,
    "orderCode" TEXT,
    "customerId" TEXT,
    "status" TEXT NOT NULL,
    "grandTotal" INTEGER NOT NULL DEFAULT 0,
    "totalQuantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastEventType" TEXT,
    "lastEventId" TEXT,

    CONSTRAINT "OrderProjection_pkey" PRIMARY KEY ("orderId")
);

-- CreateTable
CREATE TABLE "PaymentProjection" (
    "paymentId" TEXT NOT NULL,
    "orderId" TEXT,
    "status" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "method" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastEventType" TEXT,

    CONSTRAINT "PaymentProjection_pkey" PRIMARY KEY ("paymentId")
);

-- CreateTable
CREATE TABLE "ShipmentProjection" (
    "shipmentId" TEXT NOT NULL,
    "orderId" TEXT,
    "status" TEXT NOT NULL,
    "carrierCode" TEXT,
    "trackingCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastEventType" TEXT,

    CONSTRAINT "ShipmentProjection_pkey" PRIMARY KEY ("shipmentId")
);

-- CreateTable
CREATE TABLE "ReviewProjection" (
    "reviewId" TEXT NOT NULL,
    "productId" TEXT,
    "customerId" TEXT,
    "status" TEXT NOT NULL,
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "lastEventType" TEXT,

    CONSTRAINT "ReviewProjection_pkey" PRIMARY KEY ("reviewId")
);

-- CreateTable
CREATE TABLE "WarrantyClaimProjection" (
    "claimId" TEXT NOT NULL,
    "orderId" TEXT,
    "customerId" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastEventType" TEXT,

    CONSTRAINT "WarrantyClaimProjection_pkey" PRIMARY KEY ("claimId")
);

-- CreateTable
CREATE TABLE "WarrantyReturnProjection" (
    "returnId" TEXT NOT NULL,
    "orderId" TEXT,
    "customerId" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastEventType" TEXT,

    CONSTRAINT "WarrantyReturnProjection_pkey" PRIMARY KEY ("returnId")
);

-- CreateTable
CREATE TABLE "SupportTicketProjection" (
    "ticketId" TEXT NOT NULL,
    "ticketCode" TEXT,
    "customerId" TEXT,
    "status" TEXT NOT NULL,
    "priority" TEXT,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastEventType" TEXT,

    CONSTRAINT "SupportTicketProjection_pkey" PRIMARY KEY ("ticketId")
);

-- CreateTable
CREATE TABLE "DailyMetric" (
    "id" TEXT NOT NULL,
    "metricDate" DATE NOT NULL,
    "domain" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "value" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLogProjection" (
    "id" TEXT NOT NULL,
    "sourceEventId" TEXT,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRoles" TEXT,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "serviceName" TEXT,
    "detailsJson" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLogProjection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedEvent" (
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "routingKey" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resultJson" JSONB,

    CONSTRAINT "ProcessedEvent_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "ReportingIdempotency" (
    "key" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "responseJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportingIdempotency_pkey" PRIMARY KEY ("key")
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
CREATE INDEX "OrderProjection_status_idx" ON "OrderProjection"("status");

-- CreateIndex
CREATE INDEX "OrderProjection_customerId_idx" ON "OrderProjection"("customerId");

-- CreateIndex
CREATE INDEX "OrderProjection_createdAt_idx" ON "OrderProjection"("createdAt");

-- CreateIndex
CREATE INDEX "PaymentProjection_status_idx" ON "PaymentProjection"("status");

-- CreateIndex
CREATE INDEX "PaymentProjection_orderId_idx" ON "PaymentProjection"("orderId");

-- CreateIndex
CREATE INDEX "ShipmentProjection_status_idx" ON "ShipmentProjection"("status");

-- CreateIndex
CREATE INDEX "ShipmentProjection_orderId_idx" ON "ShipmentProjection"("orderId");

-- CreateIndex
CREATE INDEX "ReviewProjection_status_idx" ON "ReviewProjection"("status");

-- CreateIndex
CREATE INDEX "ReviewProjection_productId_idx" ON "ReviewProjection"("productId");

-- CreateIndex
CREATE INDEX "WarrantyClaimProjection_status_idx" ON "WarrantyClaimProjection"("status");

-- CreateIndex
CREATE INDEX "WarrantyClaimProjection_customerId_idx" ON "WarrantyClaimProjection"("customerId");

-- CreateIndex
CREATE INDEX "WarrantyReturnProjection_status_idx" ON "WarrantyReturnProjection"("status");

-- CreateIndex
CREATE INDEX "WarrantyReturnProjection_customerId_idx" ON "WarrantyReturnProjection"("customerId");

-- CreateIndex
CREATE INDEX "SupportTicketProjection_status_idx" ON "SupportTicketProjection"("status");

-- CreateIndex
CREATE INDEX "SupportTicketProjection_customerId_idx" ON "SupportTicketProjection"("customerId");

-- CreateIndex
CREATE INDEX "DailyMetric_domain_idx" ON "DailyMetric"("domain");

-- CreateIndex
CREATE INDEX "DailyMetric_metricDate_idx" ON "DailyMetric"("metricDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyMetric_metricDate_domain_metricKey_key" ON "DailyMetric"("metricDate", "domain", "metricKey");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLogProjection_sourceEventId_key" ON "AuditLogProjection"("sourceEventId");

-- CreateIndex
CREATE INDEX "AuditLogProjection_action_idx" ON "AuditLogProjection"("action");

-- CreateIndex
CREATE INDEX "AuditLogProjection_resourceType_resourceId_idx" ON "AuditLogProjection"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "AuditLogProjection_occurredAt_idx" ON "AuditLogProjection"("occurredAt");
