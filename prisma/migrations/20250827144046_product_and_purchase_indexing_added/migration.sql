-- AlterTable
ALTER TABLE "public"."Session" ALTER COLUMN "expiresAt" SET DEFAULT now() + interval '1 year';

-- CreateIndex
CREATE INDEX "Product_licenseId_code_idx" ON "public"."Product"("licenseId", "code");

-- CreateIndex
CREATE INDEX "Product_licenseId_name_idx" ON "public"."Product"("licenseId", "name");

-- CreateIndex
CREATE INDEX "Purchase_licenseId_purchaseDate_idx" ON "public"."Purchase"("licenseId", "purchaseDate");
