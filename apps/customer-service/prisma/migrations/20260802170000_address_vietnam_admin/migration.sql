-- Non-destructive: adopt the Vietnam 2-level administrative address model
-- (province/city + ward) on top of the existing free-text Address columns.
-- Legacy columns (ward, district, city, line1, line2) are kept as-is for
-- backward compatibility with pre-2025-reform and already-seeded records.

ALTER TABLE "Address" ADD COLUMN IF NOT EXISTS "countryCode" TEXT NOT NULL DEFAULT 'VN';
ALTER TABLE "Address" ADD COLUMN IF NOT EXISTS "provinceCode" TEXT;
ALTER TABLE "Address" ADD COLUMN IF NOT EXISTS "provinceName" TEXT;
ALTER TABLE "Address" ADD COLUMN IF NOT EXISTS "wardCode" TEXT;
ALTER TABLE "Address" ADD COLUMN IF NOT EXISTS "wardName" TEXT;
-- Pre-reform district snapshot, kept only for display on legacy addresses
-- (the 2-level model has no district level going forward).
ALTER TABLE "Address" ADD COLUMN IF NOT EXISTS "legacyDistrictCode" TEXT;
ALTER TABLE "Address" ADD COLUMN IF NOT EXISTS "legacyDistrictName" TEXT;

CREATE INDEX IF NOT EXISTS "Address_provinceCode_idx" ON "Address"("provinceCode");
CREATE INDEX IF NOT EXISTS "Address_wardCode_idx" ON "Address"("wardCode");

-- Backfill snapshot columns for existing rows from the legacy free-text
-- fields so already-seeded addresses keep displaying correctly.
UPDATE "Address"
SET "legacyDistrictName" = "district"
WHERE "district" IS NOT NULL
  AND "district" <> ''
  AND ("legacyDistrictName" IS NULL OR "legacyDistrictName" = '');

UPDATE "Address"
SET "provinceName" = "city"
WHERE ("provinceName" IS NULL OR "provinceName" = '')
  AND "city" IS NOT NULL
  AND "city" <> '';

UPDATE "Address"
SET "wardName" = "ward"
WHERE ("wardName" IS NULL OR "wardName" = '')
  AND "ward" IS NOT NULL
  AND "ward" <> '';
