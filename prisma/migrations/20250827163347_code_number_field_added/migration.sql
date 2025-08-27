/*
  Warnings:

  - Added the required column `codeNumber` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `PurchaseItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "codeNumber" INTEGER NOT NULL,
ADD COLUMN     "isSynced" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "syncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."Purchase" ADD COLUMN     "isSynced" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "syncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."PurchaseItem" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isSynced" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "syncedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "public"."Session" ALTER COLUMN "expiresAt" SET DEFAULT now() + interval '1 year';

-- CreateIndex
CREATE INDEX "Product_isSynced_idx" ON "public"."Product"("isSynced");

-- CreateIndex
CREATE INDEX "Purchase_isSynced_idx" ON "public"."Purchase"("isSynced");

-- CreateIndex
CREATE INDEX "PurchaseItem_isSynced_idx" ON "public"."PurchaseItem"("isSynced");
