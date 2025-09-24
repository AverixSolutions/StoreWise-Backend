/*
  Warnings:

  - A unique constraint covering the columns `[licenseId,barcode]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[licenseId,slNo]` on the table `Purchase` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slNo` to the `Purchase` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "barcode" TEXT;

-- AlterTable
ALTER TABLE "public"."Purchase" ADD COLUMN     "billNo" TEXT,
ADD COLUMN     "debitAccount" TEXT,
ADD COLUMN     "department" TEXT,
ADD COLUMN     "entryTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "natureOfEntry" TEXT,
ADD COLUMN     "slNo" INTEGER NOT NULL,
ADD COLUMN     "supplierName" TEXT;

-- AlterTable
ALTER TABLE "public"."PurchaseItem" ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "billedValue" DECIMAL(10,2),
ADD COLUMN     "mrp" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "public"."Session" ALTER COLUMN "expiresAt" SET DEFAULT now() + interval '1 year';

-- CreateIndex
CREATE UNIQUE INDEX "Product_licenseId_barcode_key" ON "public"."Product"("licenseId", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_licenseId_slNo_key" ON "public"."Purchase"("licenseId", "slNo");
