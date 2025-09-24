-- AlterTable
ALTER TABLE "public"."Session" ALTER COLUMN "expiresAt" SET DEFAULT now() + interval '1 year';

-- AlterTable
ALTER TABLE "public"."Supplier" ADD COLUMN     "aadhaar" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "creditLimit" DECIMAL(12,2),
ADD COLUMN     "language" TEXT,
ADD COLUMN     "license1" TEXT,
ADD COLUMN     "license2" TEXT,
ADD COLUMN     "native" TEXT,
ADD COLUMN     "pan" TEXT,
ADD COLUMN     "settlementDays" INTEGER;
