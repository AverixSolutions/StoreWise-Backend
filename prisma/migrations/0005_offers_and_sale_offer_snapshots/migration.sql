-- Offer Master and sale offer snapshot support

CREATE TABLE IF NOT EXISTS "Offer" (
  "id" TEXT NOT NULL,
  "licenseId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "applyScope" TEXT NOT NULL DEFAULT 'ALL_PRODUCTS',
  "priority" INTEGER NOT NULL DEFAULT 0,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "timeStart" TEXT,
  "timeEnd" TEXT,
  "minQty" DECIMAL(10,2),
  "maxQty" DECIMAL(10,2),
  "fixedUnitPrice" DECIMAL(10,2),
  "discountPercent" DECIMAL(10,2),
  "discountAmount" DECIMAL(10,2),
  "triggerKind" TEXT,
  "triggerScope" TEXT,
  "minAmount" DECIMAL(10,2),
  "maxAmount" DECIMAL(10,2),
  "unit" TEXT,
  "benefitTarget" TEXT,
  "benefitKind" TEXT,
  "benefitQtyMode" TEXT,
  "fixedBenefitQty" DECIMAL(10,2),
  "maxBenefitQty" DECIMAL(10,2),
  "maxBenefitAmount" DECIMAL(10,2),
  "customerRequired" BOOLEAN NOT NULL DEFAULT false,
  "oncePerBill" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "isSynced" BOOLEAN NOT NULL DEFAULT false,
  "syncedAt" TIMESTAMP(3),
  CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OfferTargetProduct" (
  "id" TEXT NOT NULL,
  "licenseId" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "targetRole" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "isSynced" BOOLEAN NOT NULL DEFAULT false,
  "syncedAt" TIMESTAMP(3),
  CONSTRAINT "OfferTargetProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SaleSequence" (
  "licenseId" TEXT NOT NULL,
  "lastSlNo" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "SaleSequence_pkey" PRIMARY KEY ("licenseId")
);

ALTER TABLE "Sale"
  ADD COLUMN IF NOT EXISTS "offerSummaryJson" TEXT,
  ADD COLUMN IF NOT EXISTS "offerSavings" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "offerOverridesJson" TEXT;

ALTER TABLE "SaleItem"
  ADD COLUMN IF NOT EXISTS "originalRate" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "originalSalePrice" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "appliedRate" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "offerId" TEXT,
  ADD COLUMN IF NOT EXISTS "offerName" TEXT,
  ADD COLUMN IF NOT EXISTS "offerType" TEXT,
  ADD COLUMN IF NOT EXISTS "offerDiscountAmount" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "offerMeta" TEXT;

CREATE INDEX IF NOT EXISTS "Offer_licenseId_type_isActive_idx" ON "Offer"("licenseId", "type", "isActive");
CREATE INDEX IF NOT EXISTS "Offer_isSynced_idx" ON "Offer"("isSynced");
CREATE INDEX IF NOT EXISTS "OfferTargetProduct_licenseId_offerId_idx" ON "OfferTargetProduct"("licenseId", "offerId");
CREATE INDEX IF NOT EXISTS "OfferTargetProduct_offerId_targetRole_idx" ON "OfferTargetProduct"("offerId", "targetRole");
CREATE INDEX IF NOT EXISTS "OfferTargetProduct_isSynced_idx" ON "OfferTargetProduct"("isSynced");

ALTER TABLE "Offer"
  ADD CONSTRAINT "Offer_licenseId_fkey"
  FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OfferTargetProduct"
  ADD CONSTRAINT "OfferTargetProduct_licenseId_fkey"
  FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OfferTargetProduct"
  ADD CONSTRAINT "OfferTargetProduct_offerId_fkey"
  FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OfferTargetProduct"
  ADD CONSTRAINT "OfferTargetProduct_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SaleSequence"
  ADD CONSTRAINT "SaleSequence_licenseId_fkey"
  FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE CASCADE ON UPDATE CASCADE;
