-- Non-destructive: add pickup metadata for store locations.
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "openingHours" TEXT;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "pickupEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Store_pickupEnabled_isActive_idx" ON "Store"("pickupEnabled", "isActive");
