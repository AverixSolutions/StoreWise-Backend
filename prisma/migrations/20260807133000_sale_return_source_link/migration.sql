-- Link Sales Returns to their original Sale and Sale line.
ALTER TABLE "SaleReturn" ADD COLUMN "saleId" TEXT;
ALTER TABLE "SaleReturnItem" ADD COLUMN "saleItemId" TEXT;

CREATE INDEX "SaleReturn_licenseId_saleId_idx"
ON "SaleReturn"("licenseId", "saleId");

CREATE INDEX "SaleReturnItem_saleItemId_idx"
ON "SaleReturnItem"("saleItemId");

ALTER TABLE "SaleReturn"
ADD CONSTRAINT "SaleReturn_saleId_fkey"
FOREIGN KEY ("saleId") REFERENCES "Sale"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SaleReturnItem"
ADD CONSTRAINT "SaleReturnItem_saleItemId_fkey"
FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
