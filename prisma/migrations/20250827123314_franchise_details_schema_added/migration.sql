/*
  Warnings:

  - Added the required column `amountPaid` to the `License` table without a default value. This is not possible if the table is not empty.
  - Added the required column `customerName` to the `License` table without a default value. This is not possible if the table is not empty.
  - Added the required column `customerPhone` to the `License` table without a default value. This is not possible if the table is not empty.
  - Added the required column `marginForFranchise` to the `License` table without a default value. This is not possible if the table is not empty.
  - Added the required column `marginForUs` to the `License` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."SaleType" AS ENUM ('DIRECT', 'FRANCHISE');

-- AlterTable
ALTER TABLE "public"."License" ADD COLUMN     "amountPaid" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "customerName" TEXT NOT NULL,
ADD COLUMN     "customerPhone" TEXT NOT NULL,
ADD COLUMN     "franchiseId" TEXT,
ADD COLUMN     "marginForFranchise" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "marginForUs" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "saleType" "public"."SaleType" NOT NULL DEFAULT 'DIRECT';

-- AlterTable
ALTER TABLE "public"."Session" ALTER COLUMN "expiresAt" SET DEFAULT now() + interval '1 year';

-- CreateTable
CREATE TABLE "public"."Franchise" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Franchise_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Franchise_email_key" ON "public"."Franchise"("email");

-- AddForeignKey
ALTER TABLE "public"."License" ADD CONSTRAINT "License_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "public"."Franchise"("id") ON DELETE SET NULL ON UPDATE CASCADE;
