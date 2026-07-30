-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('CREATED', 'QUOTED', 'BOOKED', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED', 'CANCELLED', 'RETURN_TO_SENDER', 'RETURNED');

-- CreateEnum
CREATE TYPE "ShippingProvider" AS ENUM ('MOCK', 'GHN');

-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('STANDARD', 'EXPRESS', 'STORE_PICKUP');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SlotReservationStatus" AS ENUM ('HELD', 'RELEASED', 'CONSUMED');

-- CreateEnum
CREATE TYPE "CallbackStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');

-- CreateTable
CREATE TABLE "ShippingQuote" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderCode" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "deliveryMethod" "DeliveryMethod" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "totalFee" INTEGER NOT NULL,
    "packageFees" JSONB NOT NULL,
    "provider" "ShippingProvider" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliverySlot" (
    "id" TEXT NOT NULL,
    "deliveryDate" DATE NOT NULL,
    "windowStart" TEXT NOT NULL,
    "windowEnd" TEXT NOT NULL,
    "deliveryMethod" "DeliveryMethod" NOT NULL,
    "locationType" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "reservedCount" INTEGER NOT NULL DEFAULT 0,
    "cutoffAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliverySlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliverySlotReservation" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "orderId" TEXT,
    "shipmentId" TEXT,
    "customerId" TEXT NOT NULL,
    "status" "SlotReservationStatus" NOT NULL DEFAULT 'HELD',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliverySlotReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderCode" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "deliveryMethod" "DeliveryMethod" NOT NULL,
    "provider" "ShippingProvider" NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'CREATED',
    "sourceLocationType" TEXT NOT NULL,
    "sourceLocationId" TEXT NOT NULL,
    "destinationJson" JSONB,
    "shippingFee" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "quoteId" TEXT,
    "slotReservationId" TEXT,
    "providerShipmentRef" TEXT,
    "trackingCode" TEXT,
    "estimatedDeliveryAt" TIMESTAMP(3),
    "pickupCodeHash" TEXT,
    "pickupCodeHint" TEXT,
    "failureAttempts" INTEGER NOT NULL DEFAULT 0,
    "orderSyncedAt" TIMESTAMP(3),
    "stockCommittedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentItem" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "skuCode" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "orderItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentStatusHistory" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "fromStatus" "ShipmentStatus",
    "toStatus" "ShipmentStatus" NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingEvent" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "providerStatus" TEXT NOT NULL,
    "normalizedStatus" "ShipmentStatus" NOT NULL,
    "eventTime" TIMESTAMP(3) NOT NULL,
    "locationText" TEXT,
    "note" TEXT,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderCallback" (
    "id" TEXT NOT NULL,
    "provider" "ShippingProvider" NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "signatureValid" BOOLEAN NOT NULL,
    "rawPayloadJson" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "resultStatus" "CallbackStatus" NOT NULL DEFAULT 'RECEIVED',
    "shipmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderCallback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentIdempotency" (
    "key" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "responseJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentIdempotency_pkey" PRIMARY KEY ("key")
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
CREATE INDEX "ShippingQuote_orderId_idx" ON "ShippingQuote"("orderId");
CREATE INDEX "ShippingQuote_customerId_idx" ON "ShippingQuote"("customerId");
CREATE INDEX "ShippingQuote_expiresAt_idx" ON "ShippingQuote"("expiresAt");
CREATE INDEX "DeliverySlot_deliveryDate_deliveryMethod_idx" ON "DeliverySlot"("deliveryDate", "deliveryMethod");
CREATE INDEX "DeliverySlot_locationType_locationId_idx" ON "DeliverySlot"("locationType", "locationId");
CREATE UNIQUE INDEX "DeliverySlotReservation_idempotencyKey_key" ON "DeliverySlotReservation"("idempotencyKey");
CREATE INDEX "DeliverySlotReservation_slotId_idx" ON "DeliverySlotReservation"("slotId");
CREATE INDEX "DeliverySlotReservation_orderId_idx" ON "DeliverySlotReservation"("orderId");
CREATE INDEX "DeliverySlotReservation_customerId_idx" ON "DeliverySlotReservation"("customerId");
CREATE UNIQUE INDEX "Shipment_packageId_key" ON "Shipment"("packageId");
CREATE INDEX "Shipment_orderId_idx" ON "Shipment"("orderId");
CREATE INDEX "Shipment_customerId_idx" ON "Shipment"("customerId");
CREATE INDEX "Shipment_status_idx" ON "Shipment"("status");
CREATE INDEX "Shipment_trackingCode_idx" ON "Shipment"("trackingCode");
CREATE INDEX "ShipmentItem_shipmentId_idx" ON "ShipmentItem"("shipmentId");
CREATE INDEX "ShipmentStatusHistory_shipmentId_idx" ON "ShipmentStatusHistory"("shipmentId");
CREATE INDEX "TrackingEvent_shipmentId_idx" ON "TrackingEvent"("shipmentId");
CREATE UNIQUE INDEX "ProviderCallback_provider_payloadHash_key" ON "ProviderCallback"("provider", "payloadHash");
CREATE INDEX "ProviderCallback_shipmentId_idx" ON "ProviderCallback"("shipmentId");
CREATE INDEX "OutboxEvent_publishedAt_idx" ON "OutboxEvent"("publishedAt");

-- AddForeignKey
ALTER TABLE "DeliverySlotReservation" ADD CONSTRAINT "DeliverySlotReservation_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "DeliverySlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "ShippingQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_slotReservationId_fkey" FOREIGN KEY ("slotReservationId") REFERENCES "DeliverySlotReservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShipmentStatusHistory" ADD CONSTRAINT "ShipmentStatusHistory_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackingEvent" ADD CONSTRAINT "TrackingEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderCallback" ADD CONSTRAINT "ProviderCallback_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
