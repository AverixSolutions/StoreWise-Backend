-- Link Purchase Returns to their original Purchase and Purchase lines.
ALTER TABLE "PurchaseReturn"
ADD COLUMN "purchaseId" TEXT;

ALTER TABLE "PurchaseReturnItem"
ADD COLUMN "purchaseItemId" TEXT;

CREATE INDEX "PurchaseReturn_licenseId_purchaseId_idx"
ON "PurchaseReturn"("licenseId", "purchaseId");

CREATE INDEX "PurchaseReturnItem_purchaseItemId_idx"
ON "PurchaseReturnItem"("purchaseItemId");

ALTER TABLE "PurchaseReturn"
ADD CONSTRAINT "PurchaseReturn_purchaseId_fkey"
FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PurchaseReturnItem"
ADD CONSTRAINT "PurchaseReturnItem_purchaseItemId_fkey"
FOREIGN KEY ("purchaseItemId") REFERENCES "PurchaseItem"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
