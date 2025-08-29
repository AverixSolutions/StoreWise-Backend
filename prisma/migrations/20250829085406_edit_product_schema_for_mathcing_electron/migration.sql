/*
  Warnings:

  - A unique constraint covering the columns `[licenseId,code]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[licenseId,codeNumber]` on the table `Product` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."Session" ALTER COLUMN "expiresAt" SET DEFAULT now() + interval '1 year';

-- CreateIndex
CREATE UNIQUE INDEX "Product_licenseId_code_key" ON "public"."Product"("licenseId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Product_licenseId_codeNumber_key" ON "public"."Product"("licenseId", "codeNumber");
