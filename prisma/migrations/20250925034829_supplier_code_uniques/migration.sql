/*
  Warnings:

  - A unique constraint covering the columns `[licenseId,code]` on the table `Supplier` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[licenseId,codeNumber]` on the table `Supplier` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Supplier_licenseId_name_key";

-- AlterTable
ALTER TABLE "public"."Session" ALTER COLUMN "expiresAt" SET DEFAULT now() + interval '1 year';

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_licenseId_code_key" ON "public"."Supplier"("licenseId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_licenseId_codeNumber_key" ON "public"."Supplier"("licenseId", "codeNumber");
