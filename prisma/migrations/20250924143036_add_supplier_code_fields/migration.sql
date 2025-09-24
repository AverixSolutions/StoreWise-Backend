-- AlterTable
ALTER TABLE "public"."Session" ALTER COLUMN "expiresAt" SET DEFAULT now() + interval '1 year';

-- AlterTable
ALTER TABLE "public"."Supplier" ADD COLUMN     "code" TEXT,
ADD COLUMN     "codeNumber" INTEGER;
