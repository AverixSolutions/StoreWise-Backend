-- Normalized, license-scoped selling-rate master with transaction snapshots.
CREATE TABLE "RateType" (
  "id" TEXT NOT NULL,
  "licenseId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  "isSynced" BOOLEAN NOT NULL DEFAULT false,
  "syncedAt" TIMESTAMP(3),
  CONSTRAINT "RateType_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RateType_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ProductRate" (
  "id" TEXT NOT NULL,
  "licenseId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "rateTypeId" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  "isSynced" BOOLEAN NOT NULL DEFAULT false,
  "syncedAt" TIMESTAMP(3),
  CONSTRAINT "ProductRate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductRate_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductRate_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductRate_rateTypeId_fkey" FOREIGN KEY ("rateTypeId") REFERENCES "RateType"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ProductBatchRate" (
  "id" TEXT NOT NULL,
  "licenseId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "rateTypeId" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  "isSynced" BOOLEAN NOT NULL DEFAULT false,
  "syncedAt" TIMESTAMP(3),
  CONSTRAINT "ProductBatchRate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductBatchRate_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductBatchRate_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductBatchRate_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductBatchRate_rateTypeId_fkey" FOREIGN KEY ("rateTypeId") REFERENCES "RateType"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "PurchaseItem" ADD COLUMN "sellingRatesJson" TEXT;
ALTER TABLE "PurchaseReturnItem" ADD COLUMN "sellingRatesJson" TEXT;

ALTER TABLE "SaleItem" ADD COLUMN "rateTypeId" TEXT;
ALTER TABLE "SaleItem" ADD COLUMN "rateTypeCode" TEXT;
ALTER TABLE "SaleItem" ADD COLUMN "rateTypeName" TEXT;
ALTER TABLE "SaleItem" ADD COLUMN "rateSource" TEXT DEFAULT 'LEGACY';

ALTER TABLE "SaleReturnItem" ADD COLUMN "rateTypeId" TEXT;
ALTER TABLE "SaleReturnItem" ADD COLUMN "rateTypeCode" TEXT;
ALTER TABLE "SaleReturnItem" ADD COLUMN "rateTypeName" TEXT;
ALTER TABLE "SaleReturnItem" ADD COLUMN "rateSource" TEXT DEFAULT 'LEGACY';

ALTER TABLE "QuotationItem" ADD COLUMN "rateTypeId" TEXT;
ALTER TABLE "QuotationItem" ADD COLUMN "rateTypeCode" TEXT;
ALTER TABLE "QuotationItem" ADD COLUMN "rateTypeName" TEXT;
ALTER TABLE "QuotationItem" ADD COLUMN "rateSource" TEXT DEFAULT 'LEGACY';

CREATE UNIQUE INDEX "RateType_license_code_ci_live_key" ON "RateType" ("licenseId", lower("code")) WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX "RateType_license_name_ci_live_key" ON "RateType" ("licenseId", lower("name")) WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX "RateType_one_active_default_per_license" ON "RateType" ("licenseId") WHERE "isDefault" = true AND "isActive" = true AND "deletedAt" IS NULL;
CREATE INDEX "RateType_licenseId_isActive_sortOrder_idx" ON "RateType" ("licenseId", "isActive", "sortOrder");
CREATE INDEX "RateType_licenseId_updatedAt_idx" ON "RateType" ("licenseId", "updatedAt");
CREATE INDEX "RateType_isSynced_idx" ON "RateType" ("isSynced");

CREATE UNIQUE INDEX "ProductRate_productId_rateTypeId_key" ON "ProductRate" ("productId", "rateTypeId");
CREATE INDEX "ProductRate_licenseId_productId_idx" ON "ProductRate" ("licenseId", "productId");
CREATE INDEX "ProductRate_licenseId_rateTypeId_idx" ON "ProductRate" ("licenseId", "rateTypeId");
CREATE INDEX "ProductRate_isSynced_idx" ON "ProductRate" ("isSynced");

CREATE UNIQUE INDEX "ProductBatchRate_batchId_rateTypeId_key" ON "ProductBatchRate" ("batchId", "rateTypeId");
CREATE INDEX "ProductBatchRate_licenseId_productId_idx" ON "ProductBatchRate" ("licenseId", "productId");
CREATE INDEX "ProductBatchRate_licenseId_rateTypeId_idx" ON "ProductBatchRate" ("licenseId", "rateTypeId");
CREATE INDEX "ProductBatchRate_isSynced_idx" ON "ProductBatchRate" ("isSynced");

INSERT INTO "RateType" (
  "id", "licenseId", "code", "name", "isDefault", "isActive", "sortOrder",
  "createdAt", "updatedAt", "isSynced"
)
SELECT 'retail-' || l."id", l."id", 'RETAIL', 'Retail', true, true, 0,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, false
FROM "License" l
WHERE NOT EXISTS (
  SELECT 1 FROM "RateType" rt
  WHERE rt."licenseId" = l."id" AND lower(rt."code") = 'retail' AND rt."deletedAt" IS NULL
);

INSERT INTO "ProductRate" (
  "id", "licenseId", "productId", "rateTypeId", "amount",
  "createdAt", "updatedAt", "isSynced"
)
SELECT 'pr:' || p."id" || ':' || rt."id", p."licenseId", p."id", rt."id", p."salePrice",
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, false
FROM "Product" p
JOIN "RateType" rt ON rt."licenseId" = p."licenseId" AND rt."code" = 'RETAIL' AND rt."deletedAt" IS NULL
WHERE p."salePrice" IS NOT NULL
ON CONFLICT ("productId", "rateTypeId") DO NOTHING;

INSERT INTO "ProductBatchRate" (
  "id", "licenseId", "productId", "batchId", "rateTypeId", "amount",
  "createdAt", "updatedAt", "isSynced"
)
SELECT 'pbr:' || pb."id" || ':' || rt."id", pb."licenseId", pb."productId", pb."id", rt."id", pb."salePrice",
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, false
FROM "ProductBatch" pb
JOIN "RateType" rt ON rt."licenseId" = pb."licenseId" AND rt."code" = 'RETAIL' AND rt."deletedAt" IS NULL
WHERE pb."salePrice" IS NOT NULL
ON CONFLICT ("batchId", "rateTypeId") DO NOTHING;
